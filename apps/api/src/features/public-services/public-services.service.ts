import { createHash } from "node:crypto"
import { serviceImagePublicUrl } from "../services/service-image-storage.js"
import { safeHttpsUrl } from "../../shared/validation.js"
import { publicServicesRepository } from "./public-services.repository.js"
import {
  idInput,
  pageInput,
  searchInput,
  statusInput,
  validateInquiry,
  validateReview,
} from "./public-services.schema.js"

function present(
  service: Awaited<ReturnType<typeof publicServicesRepository.detail>>,
) {
  const { imagePath, pricingTemplate, packages, ...publicData } = service
  const price = (item: NonNullable<typeof pricingTemplate>) => ({
    pricingModel: item.pricingModel,
    currency: item.currency,
    amount: item.amount?.toString() ?? null,
    billingInterval: item.billingInterval,
  })
  return {
    ...publicData,
    imageUrl: safeHttpsUrl(serviceImagePublicUrl(imagePath)),
    pricing: pricingTemplate?.isPublic ? price(pricingTemplate) : null,
    packages: packages.map(
      ({
        isPricingPublic,
        amount,
        currency,
        pricingModel,
        billingInterval,
        ...item
      }) => ({
        ...item,
        pricing: isPricingPublic
          ? {
              amount: amount?.toString() ?? null,
              currency,
              pricingModel,
              billingInterval,
            }
          : null,
      }),
    ),
  }
}

export const publicServicesService = {
  async list(query: unknown, page: unknown) {
    const result = await publicServicesRepository.list(
      searchInput(query),
      pageInput(page),
    )
    return { ...result, services: result.services.map(present) }
  },
  async detail(id: unknown) {
    return present(await publicServicesRepository.detail(idInput(id)))
  },
  async submit(serviceId: unknown, body: unknown) {
    const input = validateInquiry(body)
    const id = idInput(serviceId)
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify([
          id,
          input.email,
          input.fullName,
          input.contactNumber,
          input.subject,
          input.message,
        ]),
      )
      .digest("hex")
    return publicServicesRepository.submit({
      ...input,
      serviceId: id,
      fingerprint,
    })
  },
  async listInquiries(page: unknown, status: unknown) {
    return publicServicesRepository.listInquiries(
      pageInput(page),
      status === undefined || status === "ALL"
        ? undefined
        : statusInput(status),
    )
  },
  async review(id: unknown, actorId: string, body: unknown) {
    return publicServicesRepository.review(
      idInput(id),
      actorId,
      validateReview(body),
    )
  },
}
