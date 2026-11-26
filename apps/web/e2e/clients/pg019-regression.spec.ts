import { test, expect, type Page, type Route } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "../regression-support"
import type { Client } from "../../src/features/clients/api/clients-api"
configureRegressionTest()
const client = (id: string, overrides: Partial<Client> = {}): Client => ({
  id,
  fullName: id,
  email: id + "@example.test",
  contactNumber: "09123456789",
  isActive: true,
  createdAt: "2032-02-29T16:00:00Z",
  ...overrides,
})
const table = (page: Page) =>
  page.getByRole("table", { name: "Clients", exact: true })
const list = (clients: Client[], page = 1, total = clients.length) => ({
  clients,
  page,
  total,
  pageSize: 10,
})
async function setup(page: Page, handler: (route: Route) => Promise<unknown>) {
  await restoreSession(page, "ADMIN")
  await page.route("**/api/clients**", handler)
}
function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}
async function detail(route: Route, clients: Client[]) {
  const url = new URL(route.request().url()),
    target = clients.find((c) =>
      decodeURIComponent(url.pathname).endsWith("/" + c.id),
    )
  if (target)
    return route.fulfill({
      json: { client: target, projectCount: 1, serviceRequestCount: 1 },
    })
  return route.fallback()
}
async function fill(page: Page) {
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Full Name").fill("Renewal client")
  await dialog.getByLabel("Email Address").fill("renewal@example.test")
  await dialog.getByLabel("Contact Number").fill("09123456789")
  await dialog.getByLabel("Initial Password").fill("SyntheticClient123!")
  return dialog
}

test("[PG-019-F001-A003-T002] late list results and unmount cannot replace accepted search state", async ({
  page,
}) => {
  const old = gate(),
    unmounted = gate()
  let started = false,
    oldDone = false,
    unmountStarted = false,
    unmountDone = false
  await setup(page, async (route) => {
    const query = new URL(route.request().url()).searchParams.get("search")
    if (query === "Old" || query === "Unmounted") {
      if (query === "Old") started = true
      else unmountStarted = true
      await (query === "Old" ? old : unmounted).promise
      try {
        await route.fulfill({ json: list([client(query)]) })
      } catch {
        /* Aborted superseded reads may no longer be fulfilled. */
      } finally {
        if (query === "Old") oldDone = true
        else unmountDone = true
      }
      return
    }
    await route.fulfill({ json: list([client(query || "Initial")]) })
  })
  try {
    await page.goto("/clients")
    await expect(
      table(page).getByText("Initial", { exact: true }),
    ).toBeVisible()
    const search = page.getByRole("searchbox", { name: "Search clients" })
    await search.fill("Old")
    await expect.poll(() => started).toBe(true)
    await search.fill("Current")
    await expect(
      table(page).getByText("Current", { exact: true }),
    ).toBeVisible()
    old.release()
    await expect.poll(() => oldDone).toBe(true)
    await expect(table(page).getByText("Old", { exact: true })).toHaveCount(0)
    await search.fill("Unmounted")
    await expect.poll(() => unmountStarted).toBe(true)
    await page.goto("/module")
    unmounted.release()
    await expect.poll(() => unmountDone).toBe(true)
    await page.goto("/clients")
    await expect(
      table(page).getByText("Initial", { exact: true }),
    ).toBeVisible()
    await expect(
      table(page).getByText("Unmounted", { exact: true }),
    ).toHaveCount(0)
  } finally {
    old.release()
    unmounted.release()
  }
})

test("[PG-019-F001-A006-T003] directory clamps a disappeared last page while retaining sort and filters", async ({
  page,
}) => {
  const reads: number[] = []
  const queries: URLSearchParams[] = []
  await setup(page, async (route) => {
    const url = new URL(route.request().url()),
      n = Number(url.searchParams.get("page"))
    reads.push(n)
    queries.push(url.searchParams)
    return route.fulfill({
      json:
        n === 1
          ? list(
              Array.from({ length: 10 }, (_, i) => client("Client " + i)),
              1,
              21,
            )
          : n === 3
            ? list([], 3, 11)
            : list([client("Remaining client")], 2, 11),
    })
  })
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto("/clients")
  await expect(table(page).getByText("Client 0", { exact: true })).toBeVisible()
  const filtered = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      url.pathname === "/api/clients" &&
      url.searchParams.get("status") === "ACTIVE"
    )
  })
  await page.getByRole("combobox", { name: "Filter by account status" }).click()
  await page.getByRole("option", { name: "Active", exact: true }).click()
  await filtered
  const sorted = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      url.pathname === "/api/clients" &&
      url.searchParams.get("sortBy") === "email"
    )
  })
  await page.getByRole("combobox", { name: "Sort clients" }).click()
  await page.getByRole("option", { name: "Email: A to Z", exact: true }).click()
  await sorted
  await expect(table(page)).toHaveAttribute("aria-busy", "false")
  await page.getByRole("button", { name: "Page 3", exact: true }).click()
  await expect(
    table(page).getByText("Remaining client", { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole("status")).toContainText(/11.*11 of 11/)
  expect(reads).toEqual([1, 1, 1, 3, 2])
  for (const query of queries.slice(-2)) {
    expect(query.get("status")).toBe("ACTIVE")
    expect(query.get("sortBy")).toBe("email")
    expect(query.get("sortOrder")).toBe("asc")
  }
  await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled()
})

test("[PG-019-F001-A008-T001] nullable rows and long Unicode keep Manila dates and accessible actions at both widths", async ({
  page,
}) => {
  const missing = client("missing", { fullName: " ", contactNumber: null }),
    long = client("long", {
      fullName: "Long " + "Unicode name ".repeat(12),
      email: "long-address-".repeat(8) + "@example.test",
    })
  await setup(page, async (route) =>
    new URL(route.request().url()).pathname === "/api/clients"
      ? route.fulfill({ json: list([missing, long]) })
      : detail(route, [missing, long]),
  )
  await page.goto("/clients")
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(
      table(page).getByText("Name not provided", { exact: true }),
    ).toBeVisible()
    await expect(
      table(page).getByText("Not provided", { exact: true }),
    ).toBeVisible()
    await expect(table(page).locator("time").first()).toHaveText("Mar 1, 2032")
    await expect(
      table(page).getByRole("button", {
        name: "View missing@example.test",
        exact: true,
      }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  }
  await table(page)
    .getByRole("button", { name: "View missing@example.test", exact: true })
    .click()
  await expect(
    page.getByRole("dialog").getByText("Name not provided", { exact: true }),
  ).toHaveCount(2)
})

test("[PG-019-F001-A012-T001] detail and both related failures recover through their scoped retry controls", async ({
  page,
}) => {
  const a = client("Recovery"),
    attempts = new Map<string, number>()
  await setup(page, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === "/api/clients")
      return route.fulfill({ json: list([a]) })
    const n = (attempts.get(url.pathname) || 0) + 1
    attempts.set(url.pathname, n)
    if (n === 1)
      return route.fulfill({
        status: 503,
        json: { error: "Synthetic unavailable" },
      })
    if (url.pathname.endsWith("/projects"))
      return route.fulfill({
        json: { projects: [], total: 0, page: 1, pageSize: 10 },
      })
    if (url.pathname.endsWith("/service-requests"))
      return route.fulfill({
        json: { serviceRequests: [], total: 0, page: 1, pageSize: 10 },
      })
    return detail(route, [a])
  })
  await page.goto("/clients")
  await table(page)
    .getByRole("button", { name: "View Recovery", exact: true })
    .click()
  const panel = page.getByRole("dialog")
  await expect(panel.getByRole("alert")).toContainText("Synthetic unavailable")
  await panel.getByRole("button", { name: "Try again" }).click()
  await expect(
    panel.getByRole("region", { name: "Personal information" }),
  ).toContainText("Recovery")
  for (const kind of ["Service requests", "Projects"]) {
    await panel.getByRole("tab", { name: kind, exact: true }).click()
    await expect(panel.getByRole("alert")).toContainText(
      "Synthetic unavailable",
    )
    await panel.getByRole("button", { name: "Try again" }).click()
    await expect(panel.getByRole("status")).toContainText(
      "are linked to this client yet",
    )
  }
  expect([...attempts.values()]).toEqual([2, 2, 2])
})

test("[PG-019-F001-A012-T002] old client and tab responses cannot disclose obsolete selected context", async ({
  page,
}) => {
  const a = client("Client A"),
    b = client("Client B"),
    first = gate(),
    related = gate()
  let aDone = false,
    relatedDone = false
  let aStarted = false,
    relatedStarted = false,
    hold = true
  await setup(page, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === "/api/clients")
      return route.fulfill({ json: list([a, b]) })
    if (decodeURIComponent(url.pathname).endsWith("/Client A") && hold) {
      aStarted = true
      await first.promise
      try {
        return await detail(route, [a])
      } catch {
        return
      } finally {
        aDone = true
      }
    }
    if (url.pathname.endsWith("/service-requests")) {
      relatedStarted = true
      await related.promise
      try {
        return await route.fulfill({
          json: {
            serviceRequests: [
              {
                id: "obsolete",
                title: "Obsolete request",
                status: "SUBMITTED",
                createdAt: a.createdAt,
                service: { id: "service", name: "Service" },
              },
            ],
            total: 1,
            page: 1,
            pageSize: 10,
          },
        })
      } catch {
        return
      } finally {
        relatedDone = true
      }
    }
    if (url.pathname.endsWith("/projects"))
      return route.fulfill({
        json: {
          projects: [
            {
              id: "current",
              name: "Current project",
              status: "PLANNED",
              startDate: null,
              createdAt: b.createdAt,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
        },
      })
    return detail(route, [a, b])
  })
  try {
    await page.goto("/clients")
    await table(page)
      .getByRole("button", { name: "View Client A", exact: true })
      .click()
    await expect.poll(() => aStarted).toBe(true)
    await page.getByRole("button", { name: "Close client details" }).click()
    await table(page)
      .getByRole("button", { name: "View Client B", exact: true })
      .click()
    const panel = page.getByRole("dialog")
    await expect(
      panel.getByRole("region", { name: "Personal information" }),
    ).toContainText("Client B")
    first.release()
    await expect.poll(() => aDone).toBe(true)
    await expect(
      panel.getByRole("region", { name: "Personal information" }),
    ).not.toContainText("Client A")
    await panel
      .getByRole("tab", { name: "Service requests", exact: true })
      .click()
    await expect.poll(() => relatedStarted).toBe(true)
    await panel.getByRole("tab", { name: "Projects", exact: true }).click()
    await expect(
      panel.getByRole("cell", { name: "Current project", exact: true }),
    ).toBeVisible()
    related.release()
    await expect.poll(() => relatedDone).toBe(true)
    await expect(
      panel.getByText("Obsolete request", { exact: true }),
    ).toHaveCount(0)
    hold = false
    await panel.getByRole("button", { name: "Close client details" }).click()
    await table(page)
      .getByRole("button", { name: "View Client A", exact: true })
      .click()
    await expect(
      page
        .getByRole("dialog")
        .getByRole("region", { name: "Personal information" }),
    ).toContainText("Client A")
  } finally {
    first.release()
    related.release()
  }
})

test("[PG-019-F001-A012-T003] related pagination refetches the new last page and resets on tab change", async ({
  page,
}) => {
  const a = client("Clamp"),
    reads: number[] = []
  let shrink = false
  await setup(page, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === "/api/clients")
      return route.fulfill({ json: list([a]) })
    if (url.pathname.endsWith("/service-requests")) {
      const n = Number(url.searchParams.get("page"))
      reads.push(n)
      if (n === 2) shrink = true
      return route.fulfill({
        json: {
          serviceRequests:
            n === 2
              ? []
              : Array.from({ length: shrink ? 1 : 10 }, (_, i) => ({
                  id: "req" + i,
                  title: "Request " + i,
                  status: "SUBMITTED",
                  createdAt: a.createdAt,
                  service: { id: "service", name: "Service" },
                })),
          total: shrink ? 1 : 11,
          page: n,
          pageSize: 10,
        },
      })
    }
    if (url.pathname.endsWith("/projects"))
      return route.fulfill({
        json: { projects: [], total: 0, page: 1, pageSize: 10 },
      })
    return detail(route, [a])
  })
  await page.goto("/clients")
  await table(page)
    .getByRole("button", { name: "View Clamp", exact: true })
    .click()
  const panel = page.getByRole("dialog")
  await panel
    .getByRole("tab", { name: "Service requests", exact: true })
    .click()
  await expect(panel.getByText("Page 1 of 2", { exact: true })).toBeVisible()
  await panel.getByRole("button", { name: "Next", exact: true }).click()
  await expect(panel.getByText("Page 1 of 1", { exact: true })).toBeVisible()
  await expect(
    panel.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled()
  expect(reads).toEqual([1, 2, 1])
  await panel.getByRole("tab", { name: "Projects", exact: true }).click()
  await panel
    .getByRole("tab", { name: "Service requests", exact: true })
    .click()
  await expect.poll(() => reads.at(-1)).toBe(1)
})

test("[PG-019-F001-A016-T003] Client POST renews once with identical body and fails closed when refresh is denied", async ({
  page,
}) => {
  for (const denied of [false, true]) {
    if (page.url() !== "about:blank")
      await page.evaluate(() => sessionStorage.clear())
    let token = "test-session",
      refreshes = 0
    const submissions: unknown[] = []
    await restoreSession(page, "ADMIN", { accessToken: () => token })
    await page.route("**/api/clients**", async (route) => {
      if (route.request().method() !== "POST") return route.fallback()
      submissions.push(route.request().postDataJSON())
      if (submissions.length === 1)
        return route.fulfill({
          status: 401,
          json: { error: "Expired", code: "ACCESS_TOKEN_EXPIRED" },
        })
      expect(route.request().headers().authorization).toBe("Bearer " + token)
      return route.fulfill({ status: 201, json: { client: client("Created") } })
    })
    await page.route("**/api/auth/refresh", async (route) => {
      refreshes++
      if (denied)
        return route.fulfill({
          status: 401,
          json: { error: "Invalid refresh" },
        })
      token = "renewed-access"
      return route.fulfill({
        json: { token, refreshToken: "renewed-refresh", expiresIn: 900 },
      })
    })
    await page.goto("/clients")
    await page
      .getByRole("button", { name: "Create Client", exact: true })
      .click()
    const dialog = await fill(page)
    await dialog
      .getByRole("button", { name: "Create Client", exact: true })
      .click()
    if (denied) {
      await expect
        .poll(() =>
          page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
        )
        .toBeNull()
      expect(submissions).toHaveLength(1)
    } else {
      await expect(dialog).toHaveCount(0)
      expect(submissions).toHaveLength(2)
      expect(submissions[1]).toEqual(submissions[0])
    }
    expect(refreshes).toBe(1)
    await page.unroute("**/api/clients**")
    await page.unroute("**/api/auth/refresh")
  }
})

test("[PG-019-F001-A022-T002] markup-like client and related text remains inert DOM data", async ({
  page,
}) => {
  const markup = '<b data-pg019="injected">Client</b>',
    a = client("markup", { fullName: markup })
  const writes: string[] = []
  page.on("request", (r) => {
    if (
      new URL(r.url()).pathname.startsWith("/api/clients") &&
      r.method() !== "GET"
    )
      writes.push(r.url())
  })
  await setup(page, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === "/api/clients")
      return route.fulfill({
        json: list(url.searchParams.has("search") ? [] : [a]),
      })
    if (url.pathname.endsWith("/projects"))
      return route.fulfill({
        json: {
          projects: [
            {
              id: "markup-project",
              name: markup,
              status: "PLANNED",
              startDate: null,
              createdAt: a.createdAt,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
        },
      })
    return detail(route, [a])
  })
  await page.goto("/clients")
  await expect(table(page).getByText(markup, { exact: true })).toBeVisible()
  await table(page)
    .getByRole("button", { name: "View " + markup, exact: true })
    .click()
  const panel = page.getByRole("dialog")
  await expect(
    panel.getByRole("region", { name: "Personal information" }),
  ).toContainText(markup)
  await panel.getByRole("tab", { name: "Projects", exact: true }).click()
  await expect(
    panel.getByRole("cell", { name: markup, exact: true }),
  ).toHaveCount(1)
  await expect(page.locator("[data-pg019=injected]")).toHaveCount(0)
  await panel.getByRole("button", { name: "Close client details" }).click()
  await page
    .getByRole("searchbox", { name: "Search clients" })
    .fill(markup + " missing")
  await expect(table(page).getByRole("status")).toContainText(
    markup + " missing",
  )
  await expect(page.locator("[data-pg019=injected]")).toHaveCount(0)
  expect(writes).toEqual([])
})
