import assert from "node:assert/strict"
import { test } from "node:test"
import {
  formatServicePrice,
  getServicePricingOptions,
} from "../src/features/services/model/service-pricing.ts"

const pricing = {
  pricingModel: "FIXED",
  currency: "PHP",
  amount: "2500.00",
  billingInterval: null,
  isPublic: true,
}

test("client pricing hides private, missing, and custom quote amounts", () => {
  for (const input of [
    null,
    { ...pricing, isPublic: false },
    { ...pricing, amount: null },
    { ...pricing, pricingModel: "CUSTOM_QUOTE" },
  ]) {
    assert.deepEqual(formatServicePrice(input), {
      label: "Custom quotation",
      amount: "Contact for pricing",
      suffix: "",
    })
  }
})

test("client pricing preserves zero and fractional amounts", () => {
  assert.deepEqual(formatServicePrice({ ...pricing, amount: "0.00" }), {
    label: "Package price",
    amount: "₱0",
    suffix: "one-time",
  })
  assert.equal(
    formatServicePrice({ ...pricing, amount: "1250.50" }).amount,
    "₱1,250.50",
  )
})

test("client pricing distinguishes starting prices, hourly rates, and recurring intervals", () => {
  assert.equal(
    formatServicePrice({ ...pricing, pricingModel: "STARTING" }).label,
    "Starting at",
  )
  assert.equal(
    formatServicePrice({ ...pricing, pricingModel: "HOURLY" }).suffix,
    "/ hour",
  )
  for (const [billingInterval, suffix] of [
    ["WEEKLY", "/ week"],
    ["MONTHLY", "/ month"],
    ["QUARTERLY", "/ quarter"],
    ["YEARLY", "/ year"],
  ]) {
    assert.equal(
      formatServicePrice({
        ...pricing,
        pricingModel: "RECURRING",
        billingInterval,
      }).suffix,
      suffix,
    )
  }
})

test("package options include only active packages in display order and hide private prices", () => {
  const servicePackage = {
    ...pricing,
    description: "Monthly social media support.",
    includedFeatures: ["Content calendar"],
    isPricingPublic: true,
    isActive: true,
    isRecommended: false,
  }
  const service = {
    packages: [
      { ...servicePackage, id: "later", name: "Growth", displayOrder: 2 },
      {
        ...servicePackage,
        id: "inactive",
        name: "Retired",
        displayOrder: 0,
        isActive: false,
      },
      {
        ...servicePackage,
        id: "first",
        name: "Starter",
        displayOrder: 1,
        isRecommended: true,
        isPricingPublic: false,
      },
    ],
  }
  const options = getServicePricingOptions(service)
  assert.deepEqual(
    options.map((option) => option.id),
    ["first", "later"],
  )
  assert.equal(options[0].price.amount, "Contact for pricing")
  assert.equal(options[0].isRecommended, true)
  assert.deepEqual(options[1].includedFeatures, ["Content calendar"])
  assert.equal(service.packages.length, 3)
})

test("services without active packages fall back to service pricing or a custom quote", () => {
  const service = {
    description: "Build your brand.",
    packages: [{ isActive: false }],
    pricingTemplate: pricing,
  }
  const options = getServicePricingOptions(service)
  assert.equal(options.length, 1)
  assert.equal(options[0].price.amount, "₱2,500")
  assert.deepEqual(options[0].includedFeatures, [])
  assert.equal(
    getServicePricingOptions({ ...service, pricingTemplate: null })[0].price
      .amount,
    "Contact for pricing",
  )
})
