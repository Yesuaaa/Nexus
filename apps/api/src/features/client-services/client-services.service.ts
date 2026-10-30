import { servicesService } from "../services/services.service.js"
import { clientServicesRepository } from "./client-services.repository.js"
import type { ClientRequestFilters } from "./client-services.schema.js"

export const clientServicesService = {
  getServices: () => servicesService.getAvailable(),
  getServiceById: (id: string) => servicesService.getAvailableById(id),
  async getSpecialists(id: string) {
    return { specialists: await servicesService.getSpecialists(id) }
  },
  getClientRequests: (clientId: string, filters: ClientRequestFilters) =>
    clientServicesRepository.findClientRequests(clientId, filters),
}
