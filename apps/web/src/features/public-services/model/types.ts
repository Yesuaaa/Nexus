export type PublicPrice = {
  pricingModel: "FIXED" | "STARTING" | "CUSTOM_QUOTE" | "RECURRING" | "HOURLY"
  currency: string
  amount: string | null
  billingInterval: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" | null
}

export type PublicService = {
  id: string
  name: string
  description: string
  iconKey: string
  imageUrl: string | null
  imageAltText: string | null
  clientRequirements: string[]
  keyBenefits: { id: string; title: string; description: string }[]
  pricing: PublicPrice | null
  packages: {
    id: string
    name: string
    description: string
    includedFeatures: string[]
    isRecommended: boolean
    pricing: PublicPrice | null
  }[]
}

export type ServiceListing = {
  services: PublicService[]
  total: number
  page: number
  pageSize: number
}

export const inquiryStatuses = [
  "PENDING",
  "CONTACTED",
  "CLOSED",
  "SPAM",
] as const
export type InquiryStatus = (typeof inquiryStatuses)[number]

export type InquiryRecord = {
  id: string
  fullName: string
  email: string
  contactNumber: string
  subject: string
  message: string
  status: InquiryStatus
  internalNote: string | null
  version: number
  reviewedById: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  service: { id: string; name: string }
}
export type InquiryListing = {
  inquiries: InquiryRecord[]
  total: number
  page: number
  pageSize: number
}

export type InquiryInput = {
  fullName: string
  email: string
  contactNumber: string
  subject: string
  message: string
  agreed: boolean
  website: string
  submissionKey: string
}

export function priceLabel(price: PublicPrice | null): string {
  if (!price || price.pricingModel === "CUSTOM_QUOTE" || price.amount === null)
    return "Pricing on inquiry"
  let amount: string
  try {
    amount = new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: price.currency,
      maximumFractionDigits: 2,
    }).format(Number(price.amount))
  } catch {
    amount = price.currency + " " + price.amount
  }
  const prefix = price.pricingModel === "STARTING" ? "From " : ""
  const intervals = {
    WEEKLY: "week",
    MONTHLY: "month",
    QUARTERLY: "quarter",
    YEARLY: "year",
  }
  const interval =
    price.pricingModel === "HOURLY"
      ? "hour"
      : price.billingInterval
        ? intervals[price.billingInterval]
        : null
  return prefix + amount + (interval ? " / " + interval : "")
}
