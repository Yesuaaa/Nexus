import type {
  BillingInterval,
  PricingModel,
  Service,
} from "../api/services-api"

type PriceInput = {
  pricingModel: PricingModel
  currency: string
  amount: string | null
  billingInterval: BillingInterval | null
  isPublic: boolean
}

const intervalLabels: Record<BillingInterval, string> = {
  WEEKLY: "/ week",
  MONTHLY: "/ month",
  QUARTERLY: "/ quarter",
  YEARLY: "/ year",
}

export function formatServicePrice(pricing: PriceInput | null) {
  if (
    !pricing?.isPublic ||
    pricing.pricingModel === "CUSTOM_QUOTE" ||
    pricing.amount === null
  ) {
    return {
      label: "Custom quotation",
      amount: "Contact for pricing",
      suffix: "",
    }
  }

  const amount = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: pricing.currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: Number(pricing.amount) % 1 === 0 ? 0 : 2,
  }).format(Number(pricing.amount))

  return {
    label:
      pricing.pricingModel === "STARTING" ? "Starting at" : "Package price",
    amount,
    suffix:
      pricing.pricingModel === "HOURLY"
        ? "/ hour"
        : pricing.pricingModel === "RECURRING" && pricing.billingInterval
          ? intervalLabels[pricing.billingInterval]
          : pricing.pricingModel === "FIXED"
            ? "one-time"
            : "",
  }
}

export function getServicePricingOptions(service: Service) {
  const packages = service.packages
    .filter((item) => item.isActive)
    .sort(
      (left, right) =>
        left.displayOrder - right.displayOrder ||
        left.name.localeCompare(right.name),
    )

  if (packages.length === 0) {
    return [
      {
        id: "standard-service",
        name: "Standard service",
        description: service.description,
        includedFeatures: [] as string[],
        isRecommended: false,
        billingInterval: service.pricingTemplate?.isPublic
          ? service.pricingTemplate.billingInterval
          : null,
        price: formatServicePrice(service.pricingTemplate),
      },
    ]
  }

  return packages.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    includedFeatures: item.includedFeatures,
    isRecommended: item.isRecommended,
    billingInterval: item.billingInterval,
    price: formatServicePrice({ ...item, isPublic: item.isPricingPublic }),
  }))
}

export type ServicePricingOption = ReturnType<
  typeof getServicePricingOptions
>[number]
