import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import type { ClientServiceRequestInput } from "./client-services.schema.js"

export const clientServicesRepository = {
  async findActiveServices() {
    const prisma = getPrisma()!
    return prisma.service.findMany({
      where: { isActive: true },
      include: {
        departments: {
          select: { id: true, name: true, code: true, color: true },
        },
        pricingTemplate: true,
        packages: {
          where: { isActive: true },
          orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        },
      },
      orderBy: { name: "asc" },
    })
  },

  async findActiveServiceById(id: string) {
    const prisma = getPrisma()!
    return prisma.service.findFirst({
      where: { id, isActive: true },
      include: {
        departments: {
          select: { id: true, name: true, code: true, color: true },
        },
        pricingTemplate: true,
        packages: {
          where: { isActive: true },
          orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        },
      },
    })
  },

  async findServiceSpecialists(serviceId: string) {
    const prisma = getPrisma()!
    const service = await prisma.service.findFirst({
      where: { id: serviceId, isActive: true },
      include: { departments: { select: { id: true } } },
    })
    if (!service) return null

    const departmentIds = service.departments.map((dept) => dept.id)
    if (departmentIds.length === 0) return []

    return prisma.employee.findMany({
      where: {
        departmentId: { in: departmentIds },
        status: "ACTIVE",
      },
      select: {
        id: true,
        fullName: true,
        position: true,
        department: {
          select: { id: true, name: true, code: true, color: true },
        },
      },
      orderBy: { fullName: "asc" },
    })
  },

  async createServiceRequest(
    clientId: string,
    input: ClientServiceRequestInput,
    referenceNumber: string,
    packageSnapshot?: {
      packageName?: string
      pricingModel?:
        "FIXED" | "STARTING" | "CUSTOM_QUOTE" | "RECURRING" | "HOURLY"
      agreedPrice?: number | null
      currency?: string
      billingInterval?: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" | null
    },
  ) {
    const prisma = getPrisma()!
    return prisma.serviceRequest.create({
      data: {
        referenceNumber,
        clientId,
        serviceId: input.serviceId,
        packageId: input.packageId ?? null,
        preferredSpecialistId: input.preferredSpecialistId ?? null,
        title: input.title,
        description: input.description ?? null,
        requirementsPayload: input.requirementsPayload
          ? (input.requirementsPayload as unknown as Prisma.InputJsonValue)
          : undefined,
        packageName: packageSnapshot?.packageName ?? null,
        pricingModel: packageSnapshot?.pricingModel ?? null,
        agreedPrice: packageSnapshot?.agreedPrice ?? null,
        currency: packageSnapshot?.currency ?? "PHP",
        billingInterval: packageSnapshot?.billingInterval ?? null,
        status: "PENDING",
      },
      include: {
        service: {
          select: { id: true, name: true },
        },
        package: {
          select: { id: true, name: true },
        },
        preferredSpecialist: {
          select: { id: true, fullName: true, position: true },
        },
      },
    })
  },

  async findClientRequests(clientId: string, page = 1, pageSize = 10) {
    const prisma = getPrisma()!
    const skip = (page - 1) * pageSize
    const where = { clientId }

    const [requests, total] = await Promise.all([
      prisma.serviceRequest.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          service: { select: { id: true, name: true } },
          package: { select: { id: true, name: true } },
          preferredSpecialist: {
            select: { id: true, fullName: true, position: true },
          },
        },
      }),
      prisma.serviceRequest.count({ where }),
    ])

    return { requests, total, page, pageSize }
  },
}
