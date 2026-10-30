import { randomUUID } from "node:crypto"
import { getPrisma } from "../../lib/db.js"
import { isUniqueConflict } from "../../lib/errors.js"
import {
  validateServiceRequestInput,
  type ServiceRequestInput,
} from "./service-requests.schema.js"

export class ServiceRequestsError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "ServiceRequestsError"
  }
}

const receiptSelect = {
  id: true,
  referenceNumber: true,
  status: true,
  createdAt: true,
} as const

async function findExisting(clientId: string, input: ServiceRequestInput) {
  const existing = await getPrisma()!.serviceRequest.findUnique({
    where: {
      clientId_submissionKey: { clientId, submissionKey: input.submissionKey },
    },
  })
  if (!existing) return null
  if (
    existing.serviceId !== input.serviceId ||
    existing.packageId !== input.packageId ||
    existing.preferredSpecialistId !== input.preferredSpecialistId ||
    existing.projectGoals !== input.goals ||
    existing.projectRequirements !== input.requirements ||
    existing.expectedTimeline !== input.expectedTimeline ||
    (existing.additionalDetails ?? "") !== input.additionalDetails
  ) {
    throw new ServiceRequestsError(
      409,
      "This request was already submitted with different details. Start a new request to make changes.",
    )
  }
  return {
    id: existing.id,
    referenceNumber: existing.referenceNumber,
    status: existing.status,
    createdAt: existing.createdAt,
  }
}

export async function submitServiceRequest(clientId: string, body: unknown) {
  const validation = validateServiceRequestInput(body)
  if (!validation.value) throw new ServiceRequestsError(400, validation.error)
  const input = validation.value
  const existing = await findExisting(clientId, input)
  if (existing) return existing
  try {
    return await getPrisma()!.$transaction(
      async (tx) => {
        const service = await tx.service.findFirst({
          where: { id: input.serviceId, isActive: true },
          include: {
            pricingTemplate: true,
            packages: { where: { isActive: true } },
          },
        })
        if (!service)
          throw new ServiceRequestsError(
            409,
            "This service is no longer available. Choose another service.",
          )
        const selectedPackage = input.packageId
          ? service.packages.find((item) => item.id === input.packageId)
          : null
        if (
          (input.packageId && !selectedPackage) ||
          (!input.packageId && service.packages.length > 0)
        )
          throw new ServiceRequestsError(
            409,
            "This package is no longer available. Go back and choose a current package.",
          )
        const specialist = input.preferredSpecialistId
          ? await tx.employee.findFirst({
              where: {
                id: input.preferredSpecialistId,
                status: "ACTIVE",
                department: { services: { some: { id: service.id } } },
                user: { role: "STAFF", isActive: true, accountDeletedAt: null },
              },
              select: { id: true, fullName: true },
            })
          : null
        if (input.preferredSpecialistId && !specialist)
          throw new ServiceRequestsError(
            409,
            "Your preferred specialist is no longer listed for this service. Choose another specialist or let the department assign one.",
          )
        const pricing = selectedPackage
          ? { ...selectedPackage, isPublic: selectedPackage.isPricingPublic }
          : service.pricingTemplate
        const publicPricing = pricing?.isPublic ? pricing : null
        return tx.serviceRequest.create({
          data: {
            clientId,
            referenceNumber: `SR-${randomUUID().toUpperCase()}`,
            serviceId: service.id,
            title: `${service.name} request`,
            description: input.requirements,
            status: "PENDING",
            packageId: selectedPackage?.id ?? null,
            packageName: selectedPackage?.name ?? "Standard service",
            projectGoals: input.goals,
            projectRequirements: input.requirements,
            expectedTimeline: input.expectedTimeline,
            additionalDetails: input.additionalDetails || null,
            preferredSpecialistId: specialist?.id ?? null,
            preferredSpecialistName: specialist?.fullName ?? null,
            pricingModel: publicPricing?.pricingModel ?? "CUSTOM_QUOTE",
            quotedPrice:
              publicPricing?.pricingModel === "CUSTOM_QUOTE"
                ? null
                : (publicPricing?.amount ?? null),
            currency: publicPricing?.currency ?? null,
            billingInterval: publicPricing?.billingInterval ?? null,
            submissionKey: input.submissionKey,
          },
          select: receiptSelect,
        })
      },
      { isolationLevel: "RepeatableRead" },
    )
  } catch (error) {
    if (isUniqueConflict(error)) {
      const replay = await findExisting(clientId, input)
      if (replay) return replay
    }
    throw error
  }
}
