import { isForeignKeyViolation, isUniqueConflict } from "../../lib/errors.js"
import {
  getServiceImageStorage,
  ServiceImageStorageError,
  serviceImagePublicUrl,
} from "./service-image-storage.js"
import { servicesRepository } from "./services.repository.js"
import {
  validateServiceInput,
  type ServiceInput,
  type ServicePersistenceInput,
} from "./services.schema.js"

export class ServicesError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "ServicesError"
  }
}

function presentService<T extends { imagePath: string | null }>(service: T) {
  const { imagePath, ...data } = service
  return { ...data, imageUrl: serviceImagePublicUrl(imagePath) }
}

function persistenceInput(
  input: ServiceInput,
  imagePath: string | null,
): ServicePersistenceInput {
  const {
    imageDataUrl: _imageDataUrl,
    removeImage: _removeImage,
    ...data
  } = input
  void _imageDataUrl
  void _removeImage
  return {
    ...data,
    imagePath,
    imageAltText: imagePath ? data.imageAltText : null,
  }
}

async function uploadImage(dataUrl: string) {
  try {
    return await getServiceImageStorage().upload(dataUrl)
  } catch (error) {
    if (error instanceof ServiceImageStorageError) {
      throw new ServicesError(503, error.message)
    }
    throw error
  }
}

async function removeImageBestEffort(path: string | null) {
  if (!path) return
  try {
    await getServiceImageStorage().remove(path)
  } catch (error) {
    console.error(`Failed to remove obsolete service image ${path}`, error)
  }
}

function uniqueConflict() {
  return new ServicesError(
    409,
    "A service, pricing template, or package with this name already exists",
  )
}

export const servicesService = {
  async getSpecialists(serviceId: string) {
    const service = await servicesRepository.findHeaderById(serviceId)
    if (!service?.isActive) throw new ServicesError(404, "Service not found")
    return servicesRepository.findSpecialists(serviceId)
  },

  async getAvailable() {
    const services = await servicesRepository.findAvailable()
    return services.map((service) =>
      presentService({
        ...service,
        pricingTemplateId: service.pricingTemplate?.isPublic
          ? service.pricingTemplateId
          : null,
        pricingTemplate: service.pricingTemplate?.isPublic
          ? service.pricingTemplate
          : null,
        packages: service.packages.map((servicePackage) =>
          servicePackage.isPricingPublic
            ? servicePackage
            : {
                ...servicePackage,
                amount: null,
                billingInterval: null,
              },
        ),
      }),
    )
  },

  async getAll() {
    return (await servicesRepository.findAll()).map(presentService)
  },

  async getPricingTemplates() {
    return servicesRepository.findPricingTemplates()
  },

  async getById(id: string) {
    const service = await servicesRepository.findById(id)
    if (!service) {
      throw new ServicesError(404, "Service not found")
    }
    return presentService(service)
  },

  async create(body: unknown) {
    const parsed = validateServiceInput(body)
    if (!parsed.value) {
      throw new ServicesError(400, parsed.error)
    }

    const departments = await servicesRepository.findDepartmentsByIds(
      parsed.value.departmentIds,
    )
    if (departments.length !== parsed.value.departmentIds.length) {
      throw new ServicesError(
        400,
        "One or more selected departments do not exist",
      )
    }
    if (
      parsed.value.pricingTemplateId &&
      !(await servicesRepository.findPricingTemplateById(
        parsed.value.pricingTemplateId,
      ))
    ) {
      throw new ServicesError(
        400,
        "The selected pricing template does not exist",
      )
    }

    let uploadedPath: string | null = null
    try {
      if (parsed.value.imageDataUrl) {
        uploadedPath = await uploadImage(parsed.value.imageDataUrl)
      }
      return presentService(
        await servicesRepository.create({
          ...persistenceInput(parsed.value, uploadedPath),
          isActive: true,
        }),
      )
    } catch (error) {
      await removeImageBestEffort(uploadedPath)
      if (isUniqueConflict(error)) throw uniqueConflict()
      throw error
    }
  },

  async update(id: string, body: unknown) {
    const current = await servicesRepository.findById(id)
    if (!current) {
      throw new ServicesError(404, "Service not found")
    }
    const bodyRecord =
      body && typeof body === "object"
        ? (body as Record<string, unknown>)
        : null
    const keepsExistingPricing =
      bodyRecord !== null &&
      !Object.hasOwn(bodyRecord, "pricingTemplateId") &&
      !Object.hasOwn(bodyRecord, "pricingTemplate")
    const compatibleBody = bodyRecord
      ? {
          imageDataUrl: null,
          iconKey: current.iconKey,
          imageAltText: current.imageAltText,
          removeImage: false,
          clientRequirements: current.clientRequirements,
          requiresConsultation: current.requiresConsultation,
          consultationNotes: current.consultationNotes,
          keyBenefits: current.keyBenefits.map((benefit) => ({
            title: benefit.title,
            description: benefit.description,
          })),
          pricingTemplateId: keepsExistingPricing
            ? current.pricingTemplateId
            : null,
          pricingTemplate: null,
          packages: current.packages.map((servicePackage) => ({
            id: servicePackage.id,
            name: servicePackage.name,
            description: servicePackage.description,
            includedFeatures: servicePackage.includedFeatures,
            pricingModel: servicePackage.pricingModel,
            currency: servicePackage.currency,
            amount:
              servicePackage.amount === null
                ? null
                : Number(servicePackage.amount),
            billingInterval: servicePackage.billingInterval,
            isPricingPublic: servicePackage.isPricingPublic,
            isActive: servicePackage.isActive,
            displayOrder: servicePackage.displayOrder,
            isRecommended: servicePackage.isRecommended,
          })),
          ...bodyRecord,
        }
      : body
    const parsed = validateServiceInput(compatibleBody)
    if (!parsed.value) {
      throw new ServicesError(400, parsed.error)
    }

    const [existing, departments, existingPackages] = await Promise.all([
      servicesRepository.findHeaderById(id),
      servicesRepository.findDepartmentsByIds(parsed.value.departmentIds),
      servicesRepository.findPackageIds(id),
    ])
    if (!existing) throw new ServicesError(404, "Service not found")
    if (departments.length !== parsed.value.departmentIds.length) {
      throw new ServicesError(
        400,
        "One or more selected departments do not exist",
      )
    }
    if (
      parsed.value.pricingTemplateId &&
      !(await servicesRepository.findPricingTemplateById(
        parsed.value.pricingTemplateId,
      ))
    ) {
      throw new ServicesError(
        400,
        "The selected pricing template does not exist",
      )
    }
    const existingPackageIds = new Set(
      existingPackages.map((servicePackage) => servicePackage.id),
    )
    if (
      parsed.value.packages.some(
        (servicePackage) =>
          servicePackage.id && !existingPackageIds.has(servicePackage.id),
      )
    ) {
      throw new ServicesError(
        400,
        "One or more packages do not belong to this service",
      )
    }

    let nextPath = parsed.value.removeImage ? null : current.imagePath
    let uploadedPath: string | null = null
    if (nextPath && !parsed.value.imageAltText) {
      throw new ServicesError(
        400,
        "Image alternative text must be between 2 and 160 characters",
      )
    }
    try {
      if (parsed.value.imageDataUrl) {
        uploadedPath = await uploadImage(parsed.value.imageDataUrl)
        nextPath = uploadedPath
      }
      const saved = await servicesRepository.update(
        id,
        persistenceInput(parsed.value, nextPath),
      )
      if (current.imagePath && current.imagePath !== nextPath) {
        await removeImageBestEffort(current.imagePath)
      }
      return presentService(saved)
    } catch (error) {
      await removeImageBestEffort(uploadedPath)
      if (isUniqueConflict(error)) throw uniqueConflict()
      throw error
    }
  },

  async updateStatus(id: string, isActive: unknown) {
    if (typeof isActive !== "boolean") {
      throw new ServicesError(400, "isActive must be a boolean")
    }

    const existing = await servicesRepository.findHeaderById(id)
    if (!existing) {
      throw new ServicesError(404, "Service not found")
    }

    return presentService(await servicesRepository.updateStatus(id, isActive))
  },

  async delete(id: string) {
    const existing = await servicesRepository.findHeaderById(id)
    if (!existing) {
      throw new ServicesError(404, "Service not found")
    }
    if (existing.isActive) {
      throw new ServicesError(409, "Deactivate the service before deleting it")
    }

    try {
      const deleted = await servicesRepository.deleteInactive(id)
      if (deleted.count === 0) {
        throw new ServicesError(
          409,
          "Deactivate the service before deleting it",
        )
      }
      await removeImageBestEffort(existing.imagePath)
      return { message: "Service deleted successfully" }
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ServicesError(
          409,
          "This service cannot be deleted because existing records use it",
        )
      }
      throw error
    }
  },
}
