import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { isUniqueConflict } from "../../lib/errors.js"
import { HttpError } from "../../shared/http-error.js"
import { containsText } from "../../shared/query/pagination.js"
import type {
  InquiryStatus,
  validateInquiry,
} from "./public-services.schema.js"

function db() {
  const prisma = getPrisma()
  if (!prisma)
    throw new HttpError(
      503,
      "Services are temporarily unavailable. Please try again later.",
    )
  return prisma
}

export const publicServiceSelect = {
  id: true,
  name: true,
  description: true,
  iconKey: true,
  imagePath: true,
  imageAltText: true,
  clientRequirements: true,
  keyBenefits: {
    take: 30,
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    select: { id: true, title: true, description: true },
  },
  pricingTemplate: {
    select: {
      isPublic: true,
      pricingModel: true,
      currency: true,
      amount: true,
      billingInterval: true,
    },
  },
  packages: {
    where: { isActive: true },
    take: 30,
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      includedFeatures: true,
      isPricingPublic: true,
      pricingModel: true,
      currency: true,
      amount: true,
      billingInterval: true,
      isRecommended: true,
    },
  },
} satisfies Prisma.ServiceSelect

const receiptSelect = { id: true, status: true, createdAt: true } as const
const reviewSelect = {
  id: true,
  fullName: true,
  email: true,
  contactNumber: true,
  subject: true,
  message: true,
  status: true,
  internalNote: true,
  reviewedAt: true,
  reviewedById: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  service: { select: { id: true, name: true } },
} satisfies Prisma.ServiceInquirySelect

type Submission = ReturnType<typeof validateInquiry> & {
  serviceId: string
  fingerprint: string
}

function replay(
  existing: {
    fingerprint: string
    id: string
    status: InquiryStatus
    createdAt: Date
  },
  fingerprint: string,
) {
  if (existing.fingerprint !== fingerprint)
    throw new HttpError(409, "This submission changed. Start a new inquiry.")
  const { id, status, createdAt } = existing
  return { inquiry: { id, status, createdAt }, replayed: true }
}

export const publicServicesRepository = {
  async list(query: string, page: number, category?: string) {
    const where: Prisma.ServiceWhereInput = {
      isActive: true,
      ...(category ? { iconKey: category } : {}),
      ...(query
        ? {
            OR: [
              { name: containsText(query) },
              { description: containsText(query) },
            ],
          }
        : {}),
    }
    const [services, total] = await db().$transaction([
      db().service.findMany({
        where,
        select: publicServiceSelect,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: (page - 1) * 12,
        take: 12,
      }),
      db().service.count({ where }),
    ])
    return { services, total, page, pageSize: 12 }
  },

  async detail(id: string) {
    const service = await db().service.findFirst({
      where: { id, isActive: true },
      select: publicServiceSelect,
    })
    if (!service) throw new HttpError(404, "This service is unavailable.")
    return service
  },

  async submit(data: Submission) {
    const prisma = db()
    try {
      return await prisma.$transaction(
        async (tx) => {
          // Serialize per sender across replicas for durable rate and duplicate protection.
          await tx.$queryRaw<
            Array<{ locked: string }>
          >`SELECT pg_advisory_xact_lock(hashtextextended(${"public-inquiry:" + data.email}, 0))::text AS locked`
          const previous = await tx.serviceInquiry.findUnique({
            where: { submissionKey: data.submissionKey },
            select: { ...receiptSelect, fingerprint: true },
          })
          if (previous) return replay(previous, data.fingerprint)

          const available = await tx.$queryRaw<
            Array<{ id: string }>
          >`SELECT "id" FROM "Service" WHERE "id" = ${data.serviceId} AND "isActive" = true FOR SHARE`
          if (!available.length)
            throw new HttpError(404, "This service is no longer available.")
          const now = Date.now()
          const duplicate = await tx.serviceInquiry.findFirst({
            where: {
              fingerprint: data.fingerprint,
              createdAt: { gte: new Date(now - 10 * 60_000) },
            },
            select: { id: true },
          })
          if (duplicate)
            throw new HttpError(
              409,
              "We already received this inquiry. Please allow time for a reply.",
            )
          const sent = await tx.serviceInquiry.count({
            where: {
              email: data.email,
              createdAt: { gte: new Date(now - 60 * 60_000) },
            },
          })
          if (sent >= 5)
            throw new HttpError(
              429,
              "Too many inquiries. Please try again in an hour.",
            )
          const inquiry = await tx.serviceInquiry.create({
            data,
            select: receiptSelect,
          })
          return { inquiry, replayed: false }
        },
        { timeout: 15_000 },
      )
    } catch (error) {
      if (isUniqueConflict(error)) {
        const existing = await prisma.serviceInquiry.findUnique({
          where: { submissionKey: data.submissionKey },
          select: { ...receiptSelect, fingerprint: true },
        })
        if (existing) return replay(existing, data.fingerprint)
      }
      throw error
    }
  },

  async listInquiries(page: number, status?: InquiryStatus) {
    const where: Prisma.ServiceInquiryWhereInput = status ? { status } : {}
    const [inquiries, total] = await db().$transaction([
      db().serviceInquiry.findMany({
        where,
        select: reviewSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * 25,
        take: 25,
      }),
      db().serviceInquiry.count({ where }),
    ])
    return { inquiries, total, page, pageSize: 25 }
  },

  async review(
    id: string,
    actorId: string,
    input: {
      status: InquiryStatus
      internalNote: string | null
      version: number
    },
  ) {
    return db().$transaction(async (tx) => {
      const changed = await tx.serviceInquiry.updateMany({
        where: { id, version: input.version },
        data: {
          status: input.status,
          internalNote: input.internalNote,
          reviewedById: actorId,
          reviewedAt: new Date(),
          version: { increment: 1 },
        },
      })
      if (!changed.count)
        throw new HttpError(
          409,
          "This inquiry changed. Refresh the inbox before saving.",
        )
      return tx.serviceInquiry.findUniqueOrThrow({
        where: { id },
        select: reviewSelect,
      })
    })
  },
}
