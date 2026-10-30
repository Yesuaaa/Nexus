import assert from "node:assert/strict"
import { test } from "node:test"
import { validateServiceInput } from "./services.schema.js"

test("service input trims and accepts all required fields", () => {
  assert.deepEqual(
    validateServiceInput({
      name: "  Website Development  ",
      description: "  Custom websites for clients.  ",
      departmentIds: [" dept-1 ", "dept-2", "dept-1"],
      isActive: true,
    }),
    {
      value: {
        name: "Website Development",
        description: "Custom websites for clients.",
        iconKey: "code",
        departmentIds: ["dept-1", "dept-2"],
        isActive: true,
        imageDataUrl: null,
        imageAltText: null,
        removeImage: false,
        clientRequirements: [],
        requiresConsultation: false,
        consultationNotes: null,
        keyBenefits: [],
        pricingTemplateId: null,
        pricingTemplate: null,
        packages: [],
      },
    },
  )
})

test("service input validates images, reusable pricing, and packages", () => {
  const imageDataUrl = `data:image/png;base64,${Buffer.from("image").toString("base64")}`
  const result = validateServiceInput({
    name: "Website Development",
    description: "Custom websites for clients.",
    departmentIds: ["dept-1"],
    isActive: true,
    imageDataUrl,
    imageAltText: "A responsive website on a laptop",
    clientRequirements: [" Brand guidelines ", "Project brief"],
    requiresConsultation: true,
    consultationNotes: "Schedule a discovery call.",
    keyBenefits: [
      {
        title: "Launch with confidence",
        description: "A tested website ready for real customers.",
      },
    ],
    pricingTemplate: {
      name: "Website starting price",
      pricingModel: "STARTING",
      currency: "php",
      amount: 25000,
      billingInterval: null,
      isPublic: true,
    },
    packages: [
      {
        name: "Starter",
        description: "A focused starter website.",
        includedFeatures: ["Five pages", "Responsive design"],
        pricingModel: "FIXED",
        currency: "PHP",
        amount: 30000,
        billingInterval: null,
        isPricingPublic: true,
        isActive: true,
        displayOrder: 1,
        isRecommended: true,
      },
    ],
  })
  assert.equal(result.error, undefined)
  assert.equal(result.value?.imageDataUrl, imageDataUrl)
  assert.equal(result.value?.iconKey, "code")
  assert.equal(result.value?.pricingTemplate?.currency, "PHP")
  assert.equal(result.value?.packages[0]?.amount, 30000)
  assert.deepEqual(result.value?.clientRequirements, [
    "Brand guidelines",
    "Project brief",
  ])
  assert.equal(result.value?.requiresConsultation, true)
  assert.equal(result.value?.keyBenefits[0]?.title, "Launch with confidence")
})

test("pricing rules reject invalid amounts and recurring intervals", () => {
  const base = {
    name: "Website Development",
    description: "Custom websites for clients.",
    departmentIds: ["dept-1"],
    isActive: true,
  }
  assert.match(
    validateServiceInput({
      ...base,
      pricingTemplate: {
        name: "Invalid fixed price",
        pricingModel: "FIXED",
        currency: "PHP",
        amount: null,
        billingInterval: null,
        isPublic: true,
      },
    }).error ?? "",
    /greater than zero/,
  )
  assert.match(
    validateServiceInput({
      ...base,
      packages: [
        {
          name: "Subscription",
          description: "Ongoing service",
          includedFeatures: ["Monthly report"],
          pricingModel: "RECURRING",
          currency: "PHP",
          amount: 1000,
          billingInterval: null,
          isPricingPublic: true,
          isActive: true,
          displayOrder: 0,
          isRecommended: false,
        },
      ],
    }).error ?? "",
    /billing interval/,
  )
})

test("service input rejects missing and invalid required fields", () => {
  assert.equal(
    validateServiceInput(null).error,
    "Service information is required",
  )
  assert.match(
    validateServiceInput({
      name: "",
      description: "Description",
      departmentIds: ["dept-1"],
      isActive: true,
    }).error ?? "",
    /Service name/,
  )
  assert.match(
    validateServiceInput({
      name: "Service",
      description: "",
      departmentIds: ["dept-1"],
      isActive: true,
    }).error ?? "",
    /Description/,
  )
  assert.match(
    validateServiceInput({
      name: "Service",
      description: "Description",
      departmentIds: [],
      isActive: true,
    }).error ?? "",
    /department/,
  )
  assert.match(
    validateServiceInput({
      name: "Service",
      description: "Description",
      departmentIds: ["dept-1", 42],
      isActive: true,
    }).error ?? "",
    /department/,
  )
  assert.match(
    validateServiceInput({
      name: "Service",
      description: "Description",
      departmentIds: ["dept-1"],
      isActive: "yes",
    }).error ?? "",
    /status/,
  )
  assert.match(
    validateServiceInput({
      name: "Service",
      description: "Description",
      iconKey: "unknown",
      departmentIds: ["dept-1"],
      isActive: true,
    }).error ?? "",
    /icon category/,
  )
})
