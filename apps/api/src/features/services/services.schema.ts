import { BillingInterval, PricingModel } from "../../generated/prisma/client.js"

const imageDataUrlPattern =
  /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/
const maxImageBytes = 2 * 1024 * 1024

export type PricingConfigurationInput = {
  name: string
  pricingModel: PricingModel
  currency: string
  amount: number | null
  billingInterval: BillingInterval | null
  isPublic: boolean
}

export type ServicePackageInput = {
  id?: string
  name: string
  description: string
  includedFeatures: string[]
  pricingModel: PricingModel
  currency: string
  amount: number | null
  billingInterval: BillingInterval | null
  isPricingPublic: boolean
  isActive: boolean
  displayOrder: number
  isRecommended: boolean
}

export type ServiceInput = {
  name: string
  description: string
  departmentIds: string[]
  isActive: boolean
  imageDataUrl: string | null
  imageAltText: string | null
  removeImage: boolean
  clientRequirements: string[]
  requiresConsultation: boolean
  consultationNotes: string | null
  pricingTemplateId: string | null
  pricingTemplate: PricingConfigurationInput | null
  packages: ServicePackageInput[]
}

export type ServicePersistenceInput = Omit<
  ServiceInput,
  "imageDataUrl" | "removeImage"
> & {
  imagePath: string | null
}

export type ValidationResult =
  { value: ServiceInput; error?: never } | { value?: never; error: string }

type PricingValidationResult =
  | { value: Omit<PricingConfigurationInput, "name">; error?: never }
  | { value?: never; error: string }

function nonEmptyString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function parseOptionalAmount(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  return typeof value === "number" && Number.isFinite(value) ? value : NaN
}

function validatePricing(
  input: Record<string, unknown>,
  subject: string,
): PricingValidationResult {
  const pricingModel = input.pricingModel
  if (!Object.values(PricingModel).includes(pricingModel as PricingModel)) {
    return { error: `${subject} pricing model is invalid` }
  }

  const currency = nonEmptyString(input.currency || "PHP").toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { error: `${subject} currency must use a three-letter code` }
  }

  const amount = parseOptionalAmount(input.amount)
  const requiresAmount = pricingModel !== PricingModel.CUSTOM_QUOTE
  if (
    (requiresAmount && (!Number.isFinite(amount) || Number(amount) <= 0)) ||
    (Number.isFinite(amount) && Number(amount) > 99_999_999_999.99)
  ) {
    return { error: `${subject} price must be greater than zero` }
  }

  const billingInterval = input.billingInterval
  if (
    pricingModel === PricingModel.RECURRING &&
    !Object.values(BillingInterval).includes(billingInterval as BillingInterval)
  ) {
    return { error: `${subject} recurring pricing requires a billing interval` }
  }
  if (
    pricingModel !== PricingModel.RECURRING &&
    billingInterval !== null &&
    billingInterval !== undefined &&
    billingInterval !== ""
  ) {
    return {
      error: `${subject} billing interval is only valid for recurring pricing`,
    }
  }
  if (typeof input.isPublic !== "boolean") {
    return { error: `${subject} public pricing setting is required` }
  }

  return {
    value: {
      pricingModel: pricingModel as PricingModel,
      currency,
      amount: requiresAmount ? Number(amount) : null,
      billingInterval:
        pricingModel === PricingModel.RECURRING
          ? (billingInterval as BillingInterval)
          : null,
      isPublic: input.isPublic,
    },
  }
}

function validateImage(input: Record<string, unknown>) {
  const removeImage = input.removeImage ?? false
  if (typeof removeImage !== "boolean") {
    return { error: "Remove image setting must be true or false" }
  }
  const imageDataUrl = input.imageDataUrl
  if (removeImage && imageDataUrl) {
    return { error: "A service image cannot be uploaded and removed together" }
  }
  const imageAltText = nonEmptyString(input.imageAltText) || null
  if (
    imageAltText !== null &&
    (imageAltText.length < 2 || imageAltText.length > 160)
  ) {
    return {
      error: "Image alternative text must be between 2 and 160 characters",
    }
  }
  if (imageDataUrl === null || imageDataUrl === undefined) {
    return {
      imageDataUrl: null,
      imageAltText: removeImage ? null : imageAltText,
      removeImage,
    }
  }
  if (typeof imageDataUrl !== "string") {
    return { error: "Service image must be a JPG, PNG, or WebP file" }
  }
  const match = imageDataUrl.match(imageDataUrlPattern)
  if (!match || Buffer.byteLength(match[2]!, "base64") > maxImageBytes) {
    return {
      error: "Service image must be a JPG, PNG, or WebP file up to 2 MB",
    }
  }
  if (!imageAltText) {
    return {
      error: "Image alternative text must be between 2 and 160 characters",
    }
  }
  return { imageDataUrl, imageAltText, removeImage: false }
}

function validatePackages(value: unknown) {
  if (value === undefined) return { packages: [] as ServicePackageInput[] }
  if (!Array.isArray(value)) return { error: "Service packages must be a list" }
  if (value.length > 20)
    return { error: "A service can have up to 20 packages" }

  const packages: ServicePackageInput[] = []
  const names = new Set<string>()
  let recommendedCount = 0
  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index]
    const subject = `Package ${index + 1}`
    if (!raw || typeof raw !== "object")
      return { error: `${subject} is invalid` }
    const item = raw as Record<string, unknown>
    const id = item.id === undefined ? undefined : nonEmptyString(item.id)
    const name = nonEmptyString(item.name)
    const description = nonEmptyString(item.description)
    if (id !== undefined && (id.length < 1 || id.length > 80)) {
      return { error: `${subject} identifier is invalid` }
    }
    if (name.length < 2 || name.length > 80) {
      return { error: `${subject} name must be between 2 and 80 characters` }
    }
    const normalizedName = name.toLocaleLowerCase()
    if (names.has(normalizedName)) {
      return { error: "Package names must be unique within a service" }
    }
    names.add(normalizedName)
    if (description.length < 2 || description.length > 500) {
      return {
        error: `${subject} description must be between 2 and 500 characters`,
      }
    }
    if (
      !Array.isArray(item.includedFeatures) ||
      item.includedFeatures.length === 0 ||
      item.includedFeatures.length > 30
    ) {
      return { error: `${subject} must include between 1 and 30 features` }
    }
    const includedFeatures = item.includedFeatures.map(nonEmptyString)
    if (
      includedFeatures.some(
        (feature) => feature.length < 1 || feature.length > 160,
      )
    ) {
      return {
        error: `${subject} features must be between 1 and 160 characters`,
      }
    }
    if (
      typeof item.isActive !== "boolean" ||
      typeof item.isRecommended !== "boolean" ||
      typeof item.isPricingPublic !== "boolean"
    ) {
      return { error: `${subject} status settings are invalid` }
    }
    if (
      typeof item.displayOrder !== "number" ||
      !Number.isInteger(item.displayOrder) ||
      item.displayOrder < 0 ||
      item.displayOrder > 10_000
    ) {
      return {
        error: `${subject} display order must be a non-negative integer`,
      }
    }
    if (item.isRecommended) recommendedCount += 1
    if (recommendedCount > 1) {
      return { error: "Only one package can be recommended for a service" }
    }
    const pricing = validatePricing(
      { ...item, isPublic: item.isPricingPublic },
      subject,
    )
    if (!pricing.value) return { error: pricing.error }
    packages.push({
      ...(id ? { id } : {}),
      name,
      description,
      includedFeatures,
      pricingModel: pricing.value.pricingModel,
      currency: pricing.value.currency,
      amount: pricing.value.amount,
      billingInterval: pricing.value.billingInterval,
      isPricingPublic: item.isPricingPublic,
      isActive: item.isActive,
      displayOrder: item.displayOrder,
      isRecommended: item.isRecommended,
    })
  }
  return { packages }
}

export function validateServiceInput(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { error: "Service information is required" }
  }

  const input = body as Record<string, unknown>
  const name = nonEmptyString(input.name)
  const description = nonEmptyString(input.description)
  const hasInvalidDepartmentIds =
    !Array.isArray(input.departmentIds) ||
    input.departmentIds.some(
      (id) => typeof id !== "string" || id.trim().length === 0,
    )
  const departmentIds = Array.isArray(input.departmentIds)
    ? [
        ...new Set(
          input.departmentIds
            .filter((id): id is string => typeof id === "string")
            .map((id) => id.trim())
            .filter(Boolean),
        ),
      ]
    : []

  if (name.length < 2 || name.length > 100) {
    return { error: "Service name must be between 2 and 100 characters" }
  }
  if (description.length < 2 || description.length > 500) {
    return { error: "Description must be between 2 and 500 characters" }
  }
  if (hasInvalidDepartmentIds || departmentIds.length === 0) {
    return { error: "At least one responsible department is required" }
  }
  if (typeof input.isActive !== "boolean") {
    return { error: "Service status must be active or inactive" }
  }

  const image = validateImage(input)
  if ("error" in image) {
    return { error: image.error ?? "Service image is invalid" }
  }

  const clientRequirements =
    input.clientRequirements === undefined ? [] : input.clientRequirements
  if (
    !Array.isArray(clientRequirements) ||
    clientRequirements.length > 20 ||
    clientRequirements.some(
      (requirement) =>
        typeof requirement !== "string" ||
        requirement.trim().length < 1 ||
        requirement.trim().length > 200,
    )
  ) {
    return {
      error:
        "Client requirements must contain up to 20 items of 200 characters each",
    }
  }
  const requiresConsultation = input.requiresConsultation ?? false
  if (typeof requiresConsultation !== "boolean") {
    return { error: "Consultation setting must be true or false" }
  }
  const consultationNotes =
    input.consultationNotes === null || input.consultationNotes === undefined
      ? null
      : nonEmptyString(input.consultationNotes)
  if (consultationNotes !== null && consultationNotes.length > 500) {
    return { error: "Consultation notes must not exceed 500 characters" }
  }

  const pricingTemplateId =
    input.pricingTemplateId === null || input.pricingTemplateId === undefined
      ? null
      : nonEmptyString(input.pricingTemplateId)
  if (
    pricingTemplateId !== null &&
    (pricingTemplateId.length < 1 || pricingTemplateId.length > 80)
  ) {
    return { error: "Pricing template identifier is invalid" }
  }

  let pricingTemplate: PricingConfigurationInput | null = null
  if (input.pricingTemplate !== null && input.pricingTemplate !== undefined) {
    if (pricingTemplateId) {
      return {
        error:
          "Choose an existing pricing template or create a new one, not both",
      }
    }
    if (typeof input.pricingTemplate !== "object") {
      return { error: "Pricing configuration is invalid" }
    }
    const rawPricing = input.pricingTemplate as Record<string, unknown>
    const templateName = nonEmptyString(rawPricing.name)
    if (templateName.length < 2 || templateName.length > 100) {
      return {
        error: "Pricing template name must be between 2 and 100 characters",
      }
    }
    const parsedPricing = validatePricing(rawPricing, "Service")
    if (!parsedPricing.value) return { error: parsedPricing.error }
    pricingTemplate = { name: templateName, ...parsedPricing.value }
  }

  const packageResult = validatePackages(input.packages)
  if ("error" in packageResult) {
    return { error: packageResult.error ?? "Service packages are invalid" }
  }

  return {
    value: {
      name,
      description,
      departmentIds,
      isActive: input.isActive,
      imageDataUrl: image.imageDataUrl,
      imageAltText: image.imageAltText,
      removeImage: image.removeImage,
      clientRequirements: clientRequirements.map((requirement) =>
        requirement.trim(),
      ),
      requiresConsultation,
      consultationNotes: requiresConsultation ? consultationNotes : null,
      pricingTemplateId,
      pricingTemplate,
      packages: packageResult.packages,
    },
  }
}
