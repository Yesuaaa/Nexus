import { expect, test, type Page } from "@playwright/test"
import type {
  Client,
  ClientSort,
} from "../src/features/clients/api/clients-api"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"

configureRegressionTest()

const clients: Client[] = [
  {
    id: "client-alpha",
    fullName: "Alpha Client",
    email: "alpha@example.com",
    contactNumber: "09111111111",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "client-zeta",
    fullName: "Zeta Client",
    email: "zeta@example.com",
    contactNumber: "09222222222",
    isActive: false,
    createdAt: "2026-02-01T00:00:00.000Z",
  },
]

async function mockClientTable(page: Page, holdFirstRequest = false) {
  await restoreSession(page, "ADMIN")
  let failNextRequest = false
  let releaseFirstRequest: (() => void) | null = null
  let firstRequest = holdFirstRequest

  await page.route("**/api/clients?**", async (route) => {
    const url = new URL(route.request().url())
    if (firstRequest) {
      firstRequest = false
      await new Promise<void>((resolve) => {
        releaseFirstRequest = resolve
      })
    }
    if (failNextRequest) {
      failNextRequest = false
      await route.fulfill({
        status: 503,
        json: { error: "Client directory temporarily unavailable." },
      })
      return
    }

    const search = (url.searchParams.get("search") ?? "").toLowerCase()
    const status = url.searchParams.get("status")
    const sortBy = (url.searchParams.get("sortBy") ?? "createdAt") as ClientSort
    const direction = url.searchParams.get("sortOrder") === "asc" ? 1 : -1
    const value = (client: Client) => {
      if (sortBy === "isActive") return client.isActive ? "1" : "0"
      return String(client[sortBy] ?? "").toLowerCase()
    }
    const visible = clients
      .filter(
        (client) =>
          `${client.fullName ?? ""} ${client.email}`
            .toLowerCase()
            .includes(search) &&
          (!status ||
            (status === "ACTIVE" ? client.isActive : !client.isActive)),
      )
      .sort(
        (left, right) =>
          value(left).localeCompare(value(right)) * direction ||
          left.id.localeCompare(right.id),
      )

    await route.fulfill({
      json: {
        clients: visible,
        total: visible.length,
        page: 1,
        pageSize: 10,
      },
    })
  })

  await page.route("**/api/clients/client-*", (route) => {
    const client = clients.find((item) =>
      route.request().url().endsWith(item.id),
    )
    return client
      ? route.fulfill({
          json: { client, serviceRequestCount: 0, projectCount: 0 },
        })
      : route.fallback()
  })

  return {
    failNextRequest() {
      failNextRequest = true
    },
    releaseFirstRequest() {
      releaseFirstRequest?.()
    },
  }
}

test.describe("Responsive data table pilot", () => {
  test.skip(live, "The table foundation is exercised against mocked states")

  test("preserves client sorting, filtering, actions, states, and accessibility", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const state = await mockClientTable(page, true)
    await page.goto("/clients")

    const table = page.getByRole("table", { name: "Clients" })
    await expect(table).toHaveAttribute("aria-busy", "true")
    await expect(table.getByRole("status")).toHaveText("Loading clients…")

    state.releaseFirstRequest()
    await expect(table).toHaveAttribute("aria-busy", "false")
    await expect(table.getByText("Zeta Client", { exact: true })).toBeVisible()
    await expect(
      table.getByRole("columnheader", { name: /Date registered/i }),
    ).toHaveAttribute("aria-sort", "descending")

    await table.getByRole("button", { name: /^Sort by Client name$/i }).click()
    await expect(
      table.getByRole("columnheader", { name: /Client name/i }),
    ).toHaveAttribute("aria-sort", "ascending")
    await expect(table.getByRole("row").nth(1)).toContainText("Alpha Client")

    const search = page.getByRole("searchbox", { name: "Search clients" })
    await search.fill("alpha")
    await expect(table.getByText("Alpha Client", { exact: true })).toBeVisible()
    await expect(table.getByText("Zeta Client", { exact: true })).toHaveCount(0)
    await search.fill("missing client")
    await expect(
      table.getByRole("status").filter({ hasText: "missing client" }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Clear filters" }).click()

    state.failNextRequest()
    await table
      .getByRole("button", { name: /^Sort by Email address$/i })
      .click()
    await expect(table.getByRole("alert")).toHaveText(
      /Client directory temporarily unavailable/,
    )
    await table.getByRole("button", { name: "Try again" }).click()
    await expect(table.getByText("Alpha Client", { exact: true })).toBeVisible()

    const view = table.getByRole("button", {
      name: "View Alpha Client",
      exact: true,
    })
    await view.click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toContainText("Alpha Client")
    await dialog
      .getByRole("button", { name: "Close client details", exact: true })
      .click()
    await expect(view).toBeFocused()
  })

  test("keeps client rows usable without horizontal page overflow on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mockClientTable(page)
    await page.goto("/clients")

    const table = page.getByRole("table", { name: "Clients" })
    await expect(table.getByText("Alpha Client", { exact: true })).toBeVisible()
    await expect(
      table.getByRole("button", { name: "View Alpha Client" }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    const actionSize = await table
      .getByRole("button", { name: "View Alpha Client" })
      .evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        return { width: bounds.width, height: bounds.height }
      })
    expect(actionSize.width).toBeGreaterThanOrEqual(32)
    expect(actionSize.height).toBeGreaterThanOrEqual(32)
  })
})
