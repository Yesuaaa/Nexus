import { expect, test } from "@playwright/test"
import type { Account } from "../../src/features/auth/model/types"
import type { BookingDetails } from "../../src/features/bookings/api/bookings-api"
import type { InboxRequest } from "../../src/features/request-inbox/api/request-inbox-api"

test("decline failure is announced and preserves the request", async ({
  page,
}) => {
  const request: InboxRequest & BookingDetails = {
    id: "booking-1",
    referenceNumber: "SR-INBOX-1",
    title: "Website request",
    status: "SUBMITTED",
    packageName: "Business Website",
    expectedTimeline: "Launch in six weeks",
    preferredSpecialistName: "Sam Developer",
    createdAt: "2026-10-30T08:01:00.000Z",
    updatedAt: "2026-10-30T08:00:00.000Z",
    service: { id: "service-1", name: "Website Development" },
    client: {
      fullName: "Mara Client",
      email: "client@example.com",
      contactNumber: "09123456789",
    },
    projectGoals: "Reach more customers.",
    projectRequirements: "Five accessible pages and a contact form.",
    additionalDetails: "Follow the brand guidelines.",
  }
  const mutations: string[] = []
  await page.addInitScript(() =>
    sessionStorage.setItem("nexus.auth.token", "test-session"),
  )
  await page.route("**/api/**", async (route) => {
    const apiRequest = route.request()
    const url = new URL(apiRequest.url())
    expect(apiRequest.headers().authorization).toBe("Bearer test-session")

    if (url.pathname === "/api/auth/me")
      return route.fulfill({
        json: {
          user: {
            id: "head-1",
            email: "head@example.com",
            fullName: "Dani Head",
            contactNumber: null,
            role: "STAFF",
            isActive: true,
            permissions: ["dashboard:read", "profile:read"],
            createdAt: "2026-01-01T00:00:00Z",
            headOf: { id: "design", name: "Design" },
          } satisfies Account,
        },
      })
    if (url.pathname === "/api/request-inbox")
      return route.fulfill({
        json: {
          department: { id: "design", name: "Design" },
          serviceRequests: [request],
          total: 1,
          page: 1,
          pageSize: 10,
        },
      })
    if (url.pathname === "/api/request-inbox/booking-1/decline") {
      expect(apiRequest.method()).toBe("POST")
      mutations.push(`${apiRequest.method()} ${url.pathname}`)
      return route.fulfill({ status: 404, json: { error: "Not found" } })
    }
    if (url.pathname === "/api/request-inbox/booking-1")
      return route.fulfill({ json: { serviceRequest: request } })
    return route.fulfill({ status: 404, json: { error: "Unexpected request" } })
  })

  await page.goto("/request-inbox")
  await page
    .getByRole("button", { name: "Review request booking-1", exact: true })
    .click()

  const details = page.getByRole("dialog", { name: "Booking details" })
  await details.getByRole("button", { name: "Decline request" }).click()
  const confirmation = page.getByRole("dialog", {
    name: "Decline this request?",
  })
  await expect(confirmation).toContainText("Website Development")
  await confirmation
    .getByRole("button", { name: "Decline request", exact: true })
    .click()

  await expect.poll(() => mutations.length).toBe(1)
  await expect(
    page
      .locator('[data-sileo-viewport][aria-live="polite"]')
      .getByText("Couldn't decline request", { exact: true }),
  ).toBeVisible()
  await expect(
    page
      .locator('[data-sileo-viewport][aria-live="polite"]')
      .getByText("Request declined", { exact: true }),
  ).toHaveCount(0)
  await expect(confirmation).not.toBeVisible()
  expect(mutations).toEqual(["POST /api/request-inbox/booking-1/decline"])
  expect(request.status).toBe("SUBMITTED")
  await expect(
    page.getByRole("button", { name: "Review request booking-1", exact: true }),
  ).toBeVisible()
})
