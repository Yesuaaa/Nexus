import { randomInt } from "node:crypto"
import { clientServicesRepository } from "./client-services.repository.js"
import type { ClientServiceRequestInput } from "./client-services.schema.js"

export class ClientServicesError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "ClientServicesError"
  }
}

function generateReferenceNumber(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  const randomSuffix = randomInt(1000, 9999)
  return `SR-${year}${month}${day}-${randomSuffix}`
}

export const clientServicesService = {
  async getServices() {
    return clientServicesRepository.findActiveServices()
  },

  async getServiceById(id: string) {
    const service = await clientServicesRepository.findActiveServiceById(id)
    if (!service) {
      throw new ClientServicesError(404, "Service not found or is unavailable")
    }
    return service
  },

  async getSpecialists(serviceId: string) {
    const specialists =
      await clientServicesRepository.findServiceSpecialists(serviceId)
    if (specialists === null) {
      throw new ClientServicesError(404, "Service not found or is unavailable")
    }
    return { specialists }
  },

  async submitRequest(clientId: string, input: ClientServiceRequestInput) {
    // 1. Verify service exists and is active
    const service = await clientServicesRepository.findActiveServiceById(
      input.serviceId,
    )
    if (!service) {
      throw new ClientServicesError(
        400,
        "The selected service is not available for request",
      )
    }

    // 2. Verify package if provided
    let packageSnapshot:
      | {
          packageName?: string
          pricingModel?:
            "FIXED" | "STARTING" | "CUSTOM_QUOTE" | "RECURRING" | "HOURLY"
          agreedPrice?: number | null
          currency?: string
          billingInterval?: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" | null
        }
      | undefined

    if (input.packageId) {
      const pkg = service.packages.find((p) => p.id === input.packageId)
      if (!pkg) {
        throw new ClientServicesError(
          400,
          "The selected package does not belong to this service or is unavailable",
        )
      }
      packageSnapshot = {
        packageName: pkg.name,
        pricingModel: pkg.pricingModel,
        agreedPrice: pkg.amount ? Number(pkg.amount) : null,
        currency: pkg.currency,
        billingInterval: pkg.billingInterval,
      }
    } else if (service.pricingTemplate) {
      packageSnapshot = {
        pricingModel: service.pricingTemplate.pricingModel,
        agreedPrice: service.pricingTemplate.amount
          ? Number(service.pricingTemplate.amount)
          : null,
        currency: service.pricingTemplate.currency,
        billingInterval: service.pricingTemplate.billingInterval,
      }
    }

    // 3. Verify preferred specialist if selected
    if (input.preferredSpecialistId) {
      const eligibleSpecialists =
        await clientServicesRepository.findServiceSpecialists(service.id)
      const isEligible = eligibleSpecialists?.some(
        (s) => s.id === input.preferredSpecialistId,
      )
      if (!isEligible) {
        throw new ClientServicesError(
          400,
          "The selected specialist is not eligible for this service",
        )
      }
    }

    // 4. Generate unique reference number and persist
    const referenceNumber = generateReferenceNumber()
    const request = await clientServicesRepository.createServiceRequest(
      clientId,
      input,
      referenceNumber,
      packageSnapshot,
    )

    return { serviceRequest: request }
  },

  async getClientRequests(clientId: string, page = 1) {
    return clientServicesRepository.findClientRequests(clientId, page)
  },
}
