import { expect, test } from "@playwright/test"
import type { Account } from "../../src/features/auth/model/types"
import type { BookedService } from "../../src/features/bookings/api/bookings-api"

test("combined search and status filters reset pagination and clear together", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const bookings: BookedService[] = Array.from({ length: 12 }, (_, offset) => {
    const index = offset + 1
    return {
      id: `request-${index}`,
      referenceNumber: `SR-COMBINED-${index}`,
      title: `Service ${index} request`,
      status: index % 2 === 0 ? "UNDER_REVIEW" : "SUBMITTED",
      packageName: "Standard service",
      expectedTimeline: "Four weeks",
      preferredSpecialistName: null,
      createdAt: `2026-10-${String(index).padStart(2, "0")}T08:00:00.000Z`,
      updatedAt: `2026-10-${String(index).padStart(2, "0")}T08:00:00.000Z`,
      service: { id: `service-${index}`, name: `Service ${index}` },
    }
  })
  const queries: { search: string; status: string; page: number }[] = []

  await page.addInitScript(() => {
    sessionStorage.setItem("nexus.auth.token", "test-session")
  })
  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    expect(request.headers().authorization).toBe("Bearer test-session")
    if (url.pathname === "/api/auth/me") {
      const user: Account = {
        id: "client-1",
        email: "client@example.com",
        fullName: "Mara Client",
        contactNumber: null,
        role: "USER",
        isActive: true,
        permissions: ["dashboard:read", "profile:read"],
        createdAt: "2026-01-01T00:00:00.000Z",
      }
      return route.fulfill({ json: { user } })
    }
    if (
      url.pathname === "/api/service-requests" &&
      request.method() === "GET"
    ) {
      const search = url.searchParams.get("search") ?? ""
      const status = url.searchParams.get("status") ?? ""
      const currentPage = Number(url.searchParams.get("page") ?? 1)
      queries.push({ search, status, page: currentPage })
      const filtered = bookings.filter(
        (booking) =>
          (!status || booking.status === status) &&
          `${booking.id} ${booking.referenceNumber ?? ""} ${booking.title} ${booking.service.name} ${booking.packageName ?? ""}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
      return route.fulfill({
        json: {
          serviceRequests: filtered.slice(
            (currentPage - 1) * 10,
            currentPage * 10,
          ),
          total: filtered.length,
          page: currentPage,
          pageSize: 10,
        },
      })
    }
    return route.fulfill({ status: 404, json: { error: "Unexpected request" } })
  })

  await page.goto("/booked-services")
  const main = page.getByRole("main", {
    name: "Booked services",
    exact: true,
  })
  const table = main.getByRole("table", {
    name: "Booked services",
    exact: true,
  })
  await expect(
    main.getByText("Showing 1–10 of 12", { exact: true }),
  ).toBeVisible()
  await main.getByRole("button", { name: "Next page", exact: true }).click()
  await expect(
    main.getByText("Showing 11–12 of 12", { exact: true }),
  ).toBeVisible()

  await main
    .getByRole("combobox", { name: "Filter bookings by status", exact: true })
    .click()
  await page.getByRole("option", { name: "Under review", exact: true }).click()
  await expect(
    main.getByText("Showing 1–6 of 6", { exact: true }),
  ).toBeVisible()
  await main
    .getByRole("searchbox", { name: "Search booked services", exact: true })
    .fill("Service 10")
  await expect(
    table.getByRole("button", { name: "View booking request-10", exact: true }),
  ).toBeVisible()
  expect(queries.at(-1)).toEqual({
    search: "Service 10",
    status: "UNDER_REVIEW",
    page: 1,
  })

  await main.getByRole("button", { name: "Clear filters", exact: true }).click()
  await expect(
    main.getByText("Showing 1–10 of 12", { exact: true }),
  ).toBeVisible()
  await expect(
    table.getByRole("button", { name: /^View booking / }),
  ).toHaveCount(10)
  expect(queries.at(-1)).toEqual({ search: "", status: "", page: 1 })
})
