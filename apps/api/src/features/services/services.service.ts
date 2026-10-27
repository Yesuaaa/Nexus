import { isForeignKeyViolation, isUniqueConflict } from "../../lib/errors.js"
import { servicesRepository } from "./services.repository.js"
import { validateServiceInput } from "./services.schema.js"

export class ServicesError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "ServicesError"
  }
}

export const servicesService = {
  async getAvailable() {
    return servicesRepository.findAvailable()
  },

  async getAll() {
    return servicesRepository.findAll()
  },

  async getById(id: string) {
    const service = await servicesRepository.findById(id)
    if (!service) {
      throw new ServicesError(404, "Service not found")
    }
    return service
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

    try {
      return await servicesRepository.create(parsed.value)
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ServicesError(409, "A service with this name already exists")
      }
      throw error
    }
  },

  async update(id: string, body: unknown) {
    const parsed = validateServiceInput(body)
    if (!parsed.value) {
      throw new ServicesError(400, parsed.error)
    }

    const [existing, departments] = await Promise.all([
      servicesRepository.findHeaderById(id),
      servicesRepository.findDepartmentsByIds(parsed.value.departmentIds),
    ])
    if (!existing) {
      throw new ServicesError(404, "Service not found")
    }
    if (departments.length !== parsed.value.departmentIds.length) {
      throw new ServicesError(
        400,
        "One or more selected departments do not exist",
      )
    }

    try {
      return await servicesRepository.update(id, parsed.value)
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ServicesError(409, "A service with this name already exists")
      }
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

    return servicesRepository.updateStatus(id, isActive)
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
