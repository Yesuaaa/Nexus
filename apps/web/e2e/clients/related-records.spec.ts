import { expect, test } from "@playwright/test"
import type { Client } from "../../src/features/clients/api/clients-api"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

test("[NEX-012] admin can browse paginated client requests and projects in read-only details", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")

  const client: Client = {
    id: "client-nex012",
    fullName: "Morgan Client",
    email: "morgan@example.com",
    contactNumber: "09123456789",
    isActive: true,
    createdAt: "2026-11-10T08:00:00.000Z",
  }
  const requestRows = (pageNumber: number) => {
    const start = pageNumber === 1 ? 1 : 11
    const end = pageNumber === 1 ? 10 : 11
    return Array.from({ length: end - start + 1 }, (_, index) => {
      const number = start + index
      return {
        id: `request-${number}`,
        title: `Service request ${number}`,
        status: "SUBMITTED",
        createdAt: `2026-10-${String(number).padStart(2, "0")}T08:00:00.000Z`,
        service: { id: "service-branding", name: "Branding" },
      }
    })
  }
  const projectRows = (pageNumber: number) => {
    const start = pageNumber === 1 ? 1 : 11
    const end = pageNumber === 1 ? 10 : 11
    return Array.from({ length: end - start + 1 }, (_, index) => {
      const number = start + index
      return {
        id: `project-${number}`,
        name: `Client project ${number}`,
        status: "IN_PROGRESS",
        startDate: `2026-09-${String(number).padStart(2, "0")}T08:00:00.000Z`,
        createdAt: `2026-09-${String(number).padStart(2, "0")}T08:00:00.000Z`,
      }
    })
  }

  await page.route("**/api/clients?**", (route) =>
    route.fulfill({
      json: { clients: [client], total: 1, page: 1, pageSize: 10 },
    }),
  )
  await page.route("**/api/clients/client-nex012**", (route) => {
    const url = new URL(route.request().url())
    const { pathname, searchParams } = url
    if (pathname === "/api/clients/client-nex012")
      return route.fulfill({
        json: { client, serviceRequestCount: 11, projectCount: 11 },
      })
    if (pathname === "/api/clients/client-nex012/service-requests") {
      const pageNumber = Number(searchParams.get("page") ?? "1")
      return route.fulfill({
        json: {
          serviceRequests: requestRows(pageNumber),
          total: 11,
          page: pageNumber,
          pageSize: 10,
        },
      })
    }
    if (pathname === "/api/clients/client-nex012/projects") {
      const pageNumber = Number(searchParams.get("page") ?? "1")
      return route.fulfill({
        json: {
          projects: projectRows(pageNumber),
          total: 11,
          page: pageNumber,
          pageSize: 10,
        },
      })
    }
    return route.fallback()
  })

  await page.goto("/clients")
  const directory = page.getByRole("table", { name: "Clients" })
  const view = directory.getByRole("button", {
    name: "View Morgan Client",
    exact: true,
  })
  await view.click()
  const details = page.getByRole("dialog")
  await expect(
    details.getByRole("region", { name: "Personal information" }),
  ).toContainText("Morgan Client")
  await details.getByRole("tab", { name: /Service requests/ }).click()
  await expect(
    details.getByRole("cell", { name: "Service request 1", exact: true }),
  ).toBeVisible()
  await expect(details.getByText("Page 1 of 2", { exact: true })).toBeVisible()
  await details.getByRole("button", { name: "Next", exact: true }).click()
  await expect(
    details.getByRole("cell", { name: "Service request 11", exact: true }),
  ).toBeVisible()
  await expect(details.getByText("Page 2 of 2", { exact: true })).toBeVisible()

  await details.getByRole("tab", { name: /Projects/ }).click()
  await expect(
    details.getByRole("cell", { name: "Client project 1", exact: true }),
  ).toBeVisible()
  await expect(details.getByText("Page 1 of 2", { exact: true })).toBeVisible()
  await details.getByRole("button", { name: "Next", exact: true }).click()
  await expect(
    details.getByRole("cell", { name: "Client project 11", exact: true }),
  ).toBeVisible()
  await expect(details.getByText("Page 2 of 2", { exact: true })).toBeVisible()

  await details.getByRole("button", { name: "Close client details" }).click()
  await expect(details).toHaveCount(0)
  await expect(
    directory.getByText("Morgan Client", { exact: true }),
  ).toBeVisible()
  await expect(
    directory.getByRole("button", { name: /Edit|Delete/i }),
  ).toHaveCount(0)
})
