import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import type {
  ServicePackageInput,
  ServicePersistenceInput,
} from "./services.schema.js"

export const departmentSelect = {
  id: true,
  name: true,
  code: true,
  color: true,
} as const
export const serviceInclude = {
  departments: {
    orderBy: { name: "asc" as const },
    select: departmentSelect,
  },
  pricingTemplate: true,
  keyBenefits: {
    orderBy: { displayOrder: "asc" as const },
  },
  packages: {
    orderBy: [{ displayOrder: "asc" as const }, { name: "asc" as const }],
  },
} satisfies Prisma.ServiceInclude

const availableServiceInclude = {
  ...serviceInclude,
  packages: {
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" as const }, { name: "asc" as const }],
  },
} satisfies Prisma.ServiceInclude

function packageData(item: ServicePackageInput) {
  return {
    name: item.name,
    description: item.description,
    includedFeatures: item.includedFeatures,
    pricingModel: item.pricingModel,
    currency: item.currency,
    amount: item.amount,
    billingInterval: item.billingInterval,
    isPricingPublic: item.isPricingPublic,
    isActive: item.isActive,
    displayOrder: item.displayOrder,
    isRecommended: item.isRecommended,
  }
}

function keyBenefitData(
  item: ServicePersistenceInput["keyBenefits"][number],
  displayOrder: number,
) {
  return {
    title: item.title,
    description: item.description,
    displayOrder,
  }
}

export const servicesRepository = {
  async findSpecialistProfile(serviceId: string, specialistId: string) {
    return getPrisma()!.employee.findFirst({
      where: {
        id: specialistId,
        status: "ACTIVE",
        department: { services: { some: { id: serviceId, isActive: true } } },
        user: { role: "STAFF", isActive: true, accountDeletedAt: null },
      },
      select: {
        id: true,
        fullName: true,
        position: true,
        department: { select: { id: true, name: true } },
        profileBio: true,
        profileImageUrl: true,
        profileSpecialties: true,
        portfolioProjects: {
          where: { isPublished: true },
          orderBy: [
            { displayOrder: "asc" },
            { createdAt: "desc" },
            { id: "asc" },
          ],
          take: 12,
          select: {
            id: true,
            title: true,
            summary: true,
            contribution: true,
            thumbnailUrl: true,
            projectUrl: true,
          },
        },
        socialLinks: {
          orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
          take: 8,
          select: { platform: true, url: true },
        },
      },
    })
  },
  async findSpecialists(serviceId: string) {
    return getPrisma()!.employee.findMany({
      where: {
        status: "ACTIVE",
        department: { services: { some: { id: serviceId, isActive: true } } },
        user: { role: "STAFF", isActive: true, accountDeletedAt: null },
      },
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
      select: {
        id: true,
        fullName: true,
        position: true,
        department: { select: { id: true, name: true } },
      },
    })
  },

  async findAvailable() {
    return getPrisma()!.service.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: availableServiceInclude,
    })
  },

  async findAvailableById(id: string) {
    return getPrisma()!.service.findFirst({
      where: { id, isActive: true },
      include: availableServiceInclude,
    })
  },

  async findAll() {
    return getPrisma()!.service.findMany({
      orderBy: [{ createdAt: "desc" }, { name: "asc" }],
      include: serviceInclude,
    })
  },

  async findById(id: string) {
    return getPrisma()!.service.findUnique({
      where: { id },
      include: serviceInclude,
    })
  },

  async findHeaderById(id: string) {
    return getPrisma()!.service.findUnique({
      where: { id },
      select: { id: true, isActive: true, imagePath: true },
    })
  },

  async findDepartmentsByIds(ids: string[]) {
    return getPrisma()!.department.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    })
  },

  async findPricingTemplateById(id: string) {
    return getPrisma()!.pricingTemplate.findUnique({
      where: { id },
      select: { id: true },
    })
  },

  async findPricingTemplates() {
    return getPrisma()!.pricingTemplate.findMany({
      orderBy: [{ name: "asc" }],
    })
  },

  async findPackageIds(serviceId: string) {
    return getPrisma()!.servicePackage.findMany({
      where: { serviceId },
      select: { id: true },
    })
  },

  async create(data: ServicePersistenceInput) {
    const prisma = getPrisma()!
    return prisma.$transaction(async (tx) => {
      const {
        departmentIds,
        packages,
        pricingTemplate,
        pricingTemplateId,
        keyBenefits,
        ...serviceInput
      } = data
      const createdTemplate = pricingTemplate
        ? await tx.pricingTemplate.create({ data: pricingTemplate })
        : null
      return tx.service.create({
        data: {
          ...serviceInput,
          pricingTemplateId: createdTemplate?.id ?? pricingTemplateId,
          departments: {
            connect: departmentIds.map((id) => ({ id })),
          },
          keyBenefits: {
            create: keyBenefits.map(keyBenefitData),
          },
          packages: {
            create: packages.map(packageData),
          },
        },
        include: serviceInclude,
      })
    })
  },

  async update(id: string, data: ServicePersistenceInput) {
    const prisma = getPrisma()!
    return prisma.$transaction(async (tx) => {
      const {
        departmentIds,
        packages,
        pricingTemplate,
        pricingTemplateId,
        keyBenefits,
        ...serviceInput
      } = data
      const createdTemplate = pricingTemplate
        ? await tx.pricingTemplate.create({ data: pricingTemplate })
        : null

      if (packages.some((item) => item.isRecommended)) {
        await tx.servicePackage.updateMany({
          where: { serviceId: id },
          data: { isRecommended: false },
        })
      }
      for (const item of packages) {
        if (item.id) {
          await tx.servicePackage.update({
            where: { id: item.id },
            data: packageData(item),
          })
        } else {
          await tx.servicePackage.create({
            data: { ...packageData(item), serviceId: id },
          })
        }
      }

      return tx.service.update({
        where: { id },
        data: {
          ...serviceInput,
          pricingTemplateId: createdTemplate?.id ?? pricingTemplateId,
          departments: {
            set: departmentIds.map((departmentId) => ({ id: departmentId })),
          },
          keyBenefits: {
            deleteMany: {},
            create: keyBenefits.map(keyBenefitData),
          },
        },
        include: serviceInclude,
      })
    })
  },

  async updateStatus(id: string, isActive: boolean) {
    return getPrisma()!.service.update({
      where: { id },
      data: { isActive },
      include: serviceInclude,
    })
  },

  async deleteInactive(id: string) {
    return getPrisma()!.service.deleteMany({
      where: { id, isActive: false },
    })
  },
}
