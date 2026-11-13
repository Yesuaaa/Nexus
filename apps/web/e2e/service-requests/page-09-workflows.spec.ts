import { expect, test } from "@playwright/test"
import type {
  ClientRequestsResponse,
  ServiceRequestSummary,
} from "../../src/features/services/api/client-services-api"
import type { Service } from "../../src/features/services/api/services-api"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "../regression-support"

configureRegressionTest()
test.skip(live, "Uses deterministic client service-request fixtures")

const timestamp = "2026-11-13T02:00:00.000Z"

function serviceFixture(): Service {
  return {
    id: "page-9-cross-page-service",
    name: "Conversion Support",
    description: "Support for a measured website launch.",
    iconKey: "business",
    imageUrl: null,
    imageAltText: null,
    clientRequirements: [],
    requiresConsultation: false,
    consultationNotes: null,
    keyBenefits: [],
    isActive: true,
    pricingTemplateId: null,
    pricingTemplate: null,
    packages: [],
    departments: [
      {
        id: "page-9-department",
        name: "Engineering",
        code: "ENG",
        color: "teal",
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function requestFixture(
  overrides: Partial<ServiceRequestSummary> = {},
): ServiceRequestSummary {
  return {
    id: "page-9-request",
    referenceNumber: "SR-PAGE9-001",
    title: "Conversion Support request",
    description: "Build an accessible landing page.",
    status: "SUBMITTED",
    acceptedDepartmentId: null,
    packageName: "Standard service",
    preferredSpecialistName: null,
    projectGoals: "Launch an accessible campaign page.",
    projectRequirements: "Build a landing page with a clear booking flow.",
    expectedTimeline: "Within six weeks.",
    additionalDetails: "Use the current brand guidelines.",
    pricingModel: "CUSTOM_QUOTE",
    quotedPrice: null,
    currency: null,
    billingInterval: null,
    service: { id: "service-9", name: "Conversion Support" },
    package: null,
    preferredSpecialist: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  }
}

function historyResponse(
  requests: ServiceRequestSummary[],
): ClientRequestsResponse {
  return {
    requests,
    total: requests.length,
    page: 1,
    pageSize: 10,
    summary: {
      total: requests.length,
      pending: requests.filter((request) => request.status === "SUBMITTED")
        .length,
      inProgress: requests.filter(
        (request) =>
          request.status === "UNDER_REVIEW" ||
          request.status === "AWAITING_CLIENT_INFO" ||
          request.status === "READY_FOR_QUOTATION",
      ).length,
      completed: requests.filter((request) => request.status === "CLOSED")
        .length,
      cancelled: requests.filter((request) => request.status === "CANCELLED")
        .length,
    },
  }
}

test("submitted service request is reachable from confirmation in client history", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const service = serviceFixture()
  await restoreSession(page, "USER", { initialServices: [service] })

  await page.route(
    "**/api/client/services/page-9-cross-page-service/specialists",
    (route) => route.fulfill({ json: { specialists: [] } }),
  )

  let history: ServiceRequestSummary[] = []
  await page.route("**/api/client/service-requests**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (
      url.pathname === "/api/client/service-requests" &&
      request.method() === "POST"
    ) {
      const submitted = request.postDataJSON() as {
        serviceId: string
        packageId: string | null
        preferredSpecialistId: string | null
        goals: string
        requirements: string
        expectedTimeline: string
        additionalDetails: string
      }
      expect(submitted).toMatchObject({
        serviceId: service.id,
        packageId: null,
        preferredSpecialistId: null,
        goals: "Launch an accessible campaign page.",
        requirements: "Build a landing page with a clear booking flow.",
        expectedTimeline: "Within six weeks.",
      })
      expect(request.postDataJSON()).not.toHaveProperty("clientId")
      history = [
        requestFixture({
          id: "page-9-request-created",
          referenceNumber: "SR-PAGE9-20261113-001",
          projectGoals: submitted.goals,
          projectRequirements: submitted.requirements,
          expectedTimeline: submitted.expectedTimeline,
          additionalDetails: submitted.additionalDetails || null,
          service: { id: service.id, name: service.name },
        }),
      ]
      await route.fulfill({
        status: 201,
        json: {
          serviceRequest: {
            id: history[0]!.id,
            referenceNumber: history[0]!.referenceNumber,
            status: history[0]!.status,
            createdAt: timestamp,
          },
        },
      })
      return
    }
    if (
      url.pathname === "/api/client/service-requests" &&
      request.method() === "GET"
    ) {
      await route.fulfill({ json: historyResponse(history) })
      return
    }
    await route.fallback()
  })

  await page.goto("/services")
  await page
    .getByRole("button", { name: "Explore Conversion Support", exact: true })
    .click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "EXPlore", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Select Standard service", exact: true })
    .click()
  await page.getByRole("button", { name: "Continue", exact: true }).click()
  await page
    .getByRole("textbox", { name: "Project goals", exact: true })
    .fill("Launch an accessible campaign page.")
  await page
    .getByRole("textbox", { name: "Project requirements", exact: true })
    .fill("Build a landing page with a clear booking flow.")
  await page
    .getByRole("textbox", { name: "Expected timeline", exact: true })
    .fill("Within six weeks.")
  await page.getByRole("button", { name: "Continue", exact: true }).click()
  await page
    .getByRole("button", {
      name: "Submit service request for review",
      exact: true,
    })
    .click()

  await expect(
    page.getByRole("heading", { name: "Request submitted", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText("SR-PAGE9-20261113-001", { exact: true }),
  ).toBeVisible()
  await page
    .getByRole("link", { name: "View booked requests", exact: true })
    .click()
  await expect(page).toHaveURL(/\/service-requests$/)

  const row = page.getByRole("row").filter({ hasText: "SR-PAGE9-20261113-001" })
  await expect(row).toContainText("Conversion Support")
  await expect(row).toContainText("Pending review")
  await row
    .getByRole("button", {
      name: "View request: Conversion Support",
      exact: true,
    })
    .click()
  const details = page.getByRole("dialog")
  await expect(details).toContainText("Launch an accessible campaign page.")
  await expect(details).toContainText(
    "Build a landing page with a clear booking flow.",
  )
  await expect(details).toContainText("Within six weeks.")
})

test("client cancellation shows a rejected response and succeeds on retry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await restoreSession(page, "USER")
  let request = requestFixture({
    id: "page-9-cancel-request",
    referenceNumber: "SR-PAGE9-CANCEL",
    title: "Brand Strategy request",
    service: { id: "service-brand", name: "Brand Strategy" },
  })
  let attempts = 0

  await page.route("**/api/client/service-requests**", async (route) => {
    const url = new URL(route.request().url())
    if (
      url.pathname === "/api/client/service-requests" &&
      route.request().method() === "GET"
    ) {
      await route.fulfill({ json: historyResponse([request]) })
      return
    }
    await route.fallback()
  })
  await page.route(
    "**/api/client/service-requests/page-9-cancel-request/cancel",
    async (route) => {
      expect(route.request().method()).toBe("POST")
      attempts += 1
      if (attempts === 1) {
        await route.fulfill({
          status: 409,
          json: {
            error:
              "This request is no longer available for cancellation. Refresh and try again.",
          },
        })
        return
      }
      request = { ...request, status: "CANCELLED" }
      await route.fulfill({ json: { success: true } })
    },
  )

  await page.goto("/service-requests")
  const row = page.getByRole("row").filter({ hasText: "SR-PAGE9-CANCEL" })
  await row
    .getByRole("button", {
      name: "More actions for Brand Strategy",
      exact: true,
    })
    .click()
  await page
    .getByRole("menuitem", { name: "Cancel request", exact: true })
    .click()
  const confirmation = page.getByRole("dialog")
  await confirmation
    .getByRole("button", { name: "Cancel request", exact: true })
    .click()
  await expect(confirmation.getByRole("alert")).toContainText(
    "This request is no longer available for cancellation",
  )
  await confirmation
    .getByRole("button", { name: "Cancel request", exact: true })
    .click()

  await expect.poll(() => attempts).toBe(2)
  await expect(confirmation).toHaveCount(0)
  await expect(row).toContainText("Cancelled")
  await expect(
    row.getByRole("button", {
      name: "More actions for Brand Strategy",
      exact: true,
    }),
  ).toHaveCount(0)
})

test("request chat action is available only after department acceptance", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await restoreSession(page, "USER")
  const unaccepted = requestFixture({
    id: "page-9-unaccepted",
    referenceNumber: "SR-PAGE9-UNACCEPTED",
    service: { id: "service-unaccepted", name: "Unaccepted Service" },
  })
  const accepted = requestFixture({
    id: "page-9-accepted",
    referenceNumber: "SR-PAGE9-ACCEPTED",
    title: "Accepted Service request",
    status: "UNDER_REVIEW",
    acceptedDepartmentId: "department-9",
    service: { id: "service-accepted", name: "Accepted Service" },
  })
  await page.route("**/api/client/service-requests?*", (route) =>
    route.fulfill({ json: historyResponse([unaccepted, accepted]) }),
  )
  await page.goto("/service-requests")

  const pendingRow = page
    .getByRole("row")
    .filter({ hasText: "SR-PAGE9-UNACCEPTED" })
  const acceptedRow = page
    .getByRole("row")
    .filter({ hasText: "SR-PAGE9-ACCEPTED" })
  await expect(
    pendingRow.getByRole("button", {
      name: /Go to chat unavailable/,
    }),
  ).toBeDisabled()
  await expect(
    acceptedRow.getByRole("link", {
      name: "Go to chat: Accepted Service",
      exact: true,
    }),
  ).toHaveAttribute("href", "/messages?request=page-9-accepted")
})
