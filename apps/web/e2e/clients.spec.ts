import { expect, test, type Page } from "@playwright/test"

async function setup(
  page: Page,
  role = "ADMIN",
  permission = true,
  count = 1,
  longText = false,
) {
  await page.addInitScript(() =>
    sessionStorage.setItem("nexus.auth.token", "test-session"),
  )
  const queries: URLSearchParams[] = []
  let mode = "data"
  let relatedMode = "data"
  const relatedRequests: string[] = []
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === "/api/auth/me") {
      await route.fulfill({
        json: {
          user: {
            id: "actor",
            role,
            email: "admin@example.com",
            fullName: "Administrator",
            isActive: true,
            contactNumber: null,
            createdAt: "2026-10-01T00:00:00Z",
            permissions: permission
              ? ["dashboard:read", "clients:read"]
              : ["dashboard:read"],
          },
        },
      })
    } else if (url.pathname === "/api/clients") {
      queries.push(url.searchParams)
      if (mode === "error")
        return route.fulfill({
          status: 500,
          json: { error: "Could not load clients" },
        })
      const pageNumber = Number(url.searchParams.get("page") || "1")
      const empty =
        mode === "empty" || url.searchParams.get("search") === "missing"
      await route.fulfill({
        json: {
          clients: empty
            ? []
            : Array.from(
                { length: pageNumber === 1 ? count : 1 },
                (_, index) => ({
                  id: `client-${pageNumber}-${index}`,
                  fullName:
                    pageNumber === 1
                      ? index === 0
                        ? longText
                          ? "Client".repeat(20)
                          : "Maria Santos"
                        : `Sample Client ${index + 1}`
                      : null,
                  email:
                    pageNumber === 1
                      ? index === 0
                        ? longText
                          ? `${"longemail".repeat(20)}@example.com`
                          : "maria@example.com"
                        : `sample${index + 1}@example.com`
                      : "noname@example.com",
                  contactNumber: null,
                  isActive: index % 3 !== 2,
                  createdAt: "2026-10-26T00:00:00Z",
                }),
              ),
          total: empty ? 0 : 21,
          page: pageNumber,
          pageSize: 20,
        },
      })
    } else if (/^\/api\/clients\/[^/]+$/.test(url.pathname)) {
      const id = url.pathname.split("/")[3]
      await route.fulfill({
        json: {
          client: {
            id,
            fullName:
              id === "client-1-0"
                ? longText
                  ? "Client".repeat(20)
                  : "Maria Santos"
                : null,
            email:
              id === "client-1-0"
                ? longText
                  ? `${"longemail".repeat(20)}@example.com`
                  : "maria@example.com"
                : "noname@example.com",
            contactNumber: null,
            isActive: true,
            createdAt: "2026-10-26T00:00:00Z",
          },
          serviceRequestCount: id === "client-1-0" ? 11 : 0,
          projectCount: id === "client-1-0" ? 1 : 0,
        },
      })
    } else if (
      /^\/api\/clients\/[^/]+\/(service-requests|projects)$/.test(url.pathname)
    ) {
      relatedRequests.push(url.pathname + url.search)
      if (relatedMode === "error")
        return route.fulfill({
          status: 500,
          json: { error: "Could not load related records" },
        })
      const empty =
        relatedMode === "empty" || !url.pathname.includes("client-1-0/")
      const currentPage = Number(url.searchParams.get("page") || "1")
      if (url.pathname.endsWith("service-requests")) {
        await route.fulfill({
          json: {
            serviceRequests: empty
              ? []
              : Array.from(
                  { length: currentPage === 1 ? 10 : 1 },
                  (_, index) => ({
                    id: `request-${currentPage}-${index}`,
                    title:
                      currentPage === 1
                        ? index === 0
                          ? longText
                            ? "WebsiteInquiry".repeat(20)
                            : "Website inquiry"
                          : `Request ${index + 1}`
                        : "Last request",
                    status: index === 0 ? "PENDING" : "COMPLETED",
                    createdAt: "2026-10-27T00:00:00Z",
                    service: {
                      id: "service-web",
                      name: longText
                        ? "WebDevelopment".repeat(20)
                        : "Web development",
                    },
                  }),
                ),
            total: empty ? 0 : 11,
            page: currentPage,
            pageSize: 10,
          },
        })
      } else
        await route.fulfill({
          json: {
            projects: empty
              ? []
              : [
                  {
                    id: "project-web",
                    name: longText
                      ? "CompanyWebsite".repeat(20)
                      : "Company website",
                    status: "IN_PROGRESS",
                    startDate: null,
                    createdAt: "2026-10-27T00:00:00Z",
                  },
                ],
            total: empty ? 0 : 1,
            page: currentPage,
            pageSize: 10,
          },
        })
    } else await route.fulfill({ status: 404, json: { error: "Not found" } })
  })
  return {
    queries,
    setMode: (value: string) => {
      mode = value
    },
    setRelatedMode: (value: string) => {
      relatedMode = value
    },
    relatedRequests,
  }
}

test("directory searches, filters, sorts, paginates and recovers from errors", async ({
  page,
}) => {
  const api = await setup(page)
  await page.goto("/clients")
  await expect(
    page.getByRole("heading", { name: "Client Management" }),
  ).toBeVisible()
  await expect(page.getByText("Maria Santos", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("button", { name: /\b(add|edit|delete)\b/i }),
  ).toHaveCount(0)
  await page.getByRole("button", { name: "Next", exact: true }).click()
  await expect(
    page.getByText("noname@example.com", { exact: true }),
  ).toBeVisible()
  await expect(page.getByText("Name not provided")).toBeVisible()
  await page.getByRole("button", { name: "Back", exact: true }).click()
  await expect(page.getByText("Maria Santos", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Client name" }).click()
  await expect.poll(() => api.queries.at(-1)?.get("sortBy")).toBe("fullName")
  await page.getByRole("button", { name: "Client name" }).click()
  await expect.poll(() => api.queries.at(-1)?.get("sortOrder")).toBe("desc")
  await page.getByRole("combobox", { name: "Filter by account status" }).click()
  await page.getByRole("option", { name: "Inactive", exact: true }).click()
  await expect.poll(() => api.queries.at(-1)?.get("status")).toBe("INACTIVE")
  await page.getByRole("searchbox", { name: "Search clients" }).fill("missing")
  await expect(
    page.getByText("No clients match your search or filters."),
  ).toBeVisible()
  await page.getByRole("button", { name: "Clear filters" }).click()
  await expect(page.getByText("Maria Santos", { exact: true })).toBeVisible()
  api.setMode("error")
  await page.getByRole("button", { name: "Date registered" }).click()
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Could not load clients",
  )
  api.setMode("data")
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(page.getByText("Maria Santos", { exact: true })).toBeVisible()
  api.setMode("empty")
  await page.getByRole("button", { name: "Date registered" }).click()
  await expect(page.getByText("No clients registered yet.")).toBeVisible()
})

test("desktop directory retains the approved shell", async ({
  page,
}, testInfo) => {
  await setup(page, "ADMIN", true, 20)
  await page.setViewportSize({ width: 1866, height: 995 })
  await page.goto("/clients")
  await expect(page.getByText("Maria Santos", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("columnheader", { name: "Date registered" }),
  ).toHaveAttribute("aria-sort", "descending")
  await page.screenshot({
    path: testInfo.outputPath("directory-desktop.png"),
    fullPage: true,
  })
})

test("mobile directory fits the viewport and retains sorting", async ({
  page,
}, testInfo) => {
  await setup(page, "ADMIN", true, 20)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/clients")
  await expect(page.getByText("Maria Santos", { exact: true })).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath("directory-mobile.png"),
    fullPage: true,
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.getByRole("combobox", { name: "Sort clients" }).click()
  await page.getByRole("option", { name: "Name: A to Z" }).click()
  await page.getByRole("button", { name: "Open navigation menu" }).click()
  await expect(
    page.getByRole("link", { name: "Client Management" }),
  ).toBeVisible()
})

for (const role of ["SUPERADMIN", "STAFF", "USER"]) {
  test(`${role} client directory access`, async ({ page }) => {
    const api = await setup(page, role)
    await page.goto("/clients")
    if (role === "SUPERADMIN")
      await expect(
        page.getByText("Maria Santos", { exact: true }),
      ).toBeVisible()
    else {
      await expect(page).toHaveURL(/\/dashboard$/)
      await expect(
        page.getByRole("link", { name: "Client Management" }),
      ).toHaveCount(0)
      expect(api.queries).toHaveLength(0)
    }
  })
}

test("Admin without clients:read cannot open directory", async ({ page }) => {
  const api = await setup(page, "ADMIN", false)
  await page.goto("/clients")
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(api.queries).toHaveLength(0)
})

test("directory ignores a late response from a superseded search", async ({
  page,
}) => {
  await setup(page)
  let release = () => {}
  const delayed = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/api/clients?**", async (route) => {
    const url = new URL(route.request().url())
    if (url.searchParams.get("search") !== "slow") return route.fallback()
    await delayed
    await route.fulfill({
      json: {
        clients: [
          {
            id: "stale",
            fullName: "Stale Result",
            email: "stale@example.com",
            contactNumber: null,
            isActive: true,
            createdAt: "2026-10-26T00:00:00Z",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    })
  })
  await page.goto("/clients")
  await expect(page.getByText("Maria Santos", { exact: true })).toBeVisible()
  const slowRequest = page.waitForRequest(
    (request) => new URL(request.url()).searchParams.get("search") === "slow",
  )
  await page.getByRole("searchbox", { name: "Search clients" }).fill("slow")
  await slowRequest
  await expect(page.getByRole("status")).toContainText("Loading clients")
  await page.getByRole("searchbox", { name: "Search clients" }).fill("fast")
  await expect(page.getByText("Maria Santos", { exact: true })).toBeVisible()
  const lateResponse = page.waitForResponse(
    (response) => new URL(response.url()).searchParams.get("search") === "slow",
  )
  release()
  await lateResponse
  await expect(page.getByText("Stale Result", { exact: true })).toHaveCount(0)
})

test("directory recovers when the current page disappears", async ({
  page,
}) => {
  const api = await setup(page)
  await page.goto("/clients")
  await expect(page.getByText("Maria Santos", { exact: true })).toBeVisible()
  api.setMode("empty")
  await page.getByRole("button", { name: "Next", exact: true }).click()
  await expect(page.getByText("No clients registered yet.")).toBeVisible()
  await expect.poll(() => api.queries.at(-1)?.get("page")).toBe("1")
  await expect(
    page.getByRole("navigation", { name: "Client pages" }),
  ).toHaveCount(0)
})

for (const width of [1866, 390]) {
  test(`client view action opens read-only details at ${width}px`, async ({
    page,
  }, testInfo) => {
    await setup(page)
    await page.setViewportSize({ width, height: 995 })
    await page.goto("/clients")
    const view = page.getByRole("button", {
      name: "View details for Maria Santos",
      exact: true,
    })
    await view.click()
    const drawer = page.getByRole("dialog", { name: "Client details" })
    await expect(drawer).toBeVisible()
    await expect(
      drawer.getByText("maria@example.com", { exact: true }),
    ).toBeVisible()
    await expect(drawer.getByText("Read-only", { exact: true })).toBeVisible()
    await expect(
      drawer.getByRole("button", { name: /edit|delete|password/i }),
    ).toHaveCount(0)
    await page.screenshot({
      path: testInfo.outputPath(`client-details-${width}.png`),
    })
    await page.keyboard.press("Escape")
    await expect(drawer).toHaveCount(0)
    await expect(view).toBeFocused()
    await page.getByRole("button", { name: "Next", exact: true }).click()
    await page
      .getByRole("button", {
        name: "View details for noname@example.com",
        exact: true,
      })
      .click()
    await expect(
      drawer
        .getByRole("region", { name: "Personal information" })
        .getByText("Name not provided", { exact: true }),
    ).toBeVisible()
    await drawer.getByRole("button", { name: "Close client details" }).click()
    await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible()
  })
}

for (const width of [1866, 390]) {
  test(`client related records tabs and direct actions work at ${width}px`, async ({
    page,
  }, testInfo) => {
    const api = await setup(page)
    await page.setViewportSize({ width, height: 995 })
    await page.goto("/clients")
    await page
      .getByRole("button", {
        name: "More actions for Maria Santos",
        exact: true,
      })
      .click()
    await page
      .getByRole("menuitem", { name: "View service requests", exact: true })
      .click()
    const drawer = page.getByRole("dialog", { name: "Client details" })
    await expect(
      drawer.getByRole("tab", { name: "Service requests", exact: true }),
    ).toHaveAttribute("aria-selected", "true")
    await expect(
      drawer
        .getByText("Website inquiry", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible()
    await expect(
      drawer.getByText("Web development").filter({ visible: true }).first(),
    ).toBeVisible()
    await drawer.getByRole("button", { name: "Next", exact: true }).click()
    await expect(
      drawer
        .getByText("Last request", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible()
    await drawer.getByRole("button", { name: "Back", exact: true }).click()
    await expect(
      drawer
        .getByText("Website inquiry", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible()
    await page.screenshot({
      path: testInfo.outputPath(`client-requests-${width}.png`),
    })
    await drawer.getByRole("tab", { name: "Projects", exact: true }).click()
    await expect(
      drawer
        .getByText("Company website", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible()
    await page.screenshot({
      path: testInfo.outputPath(`client-projects-${width}.png`),
    })
    await drawer.getByRole("tab", { name: "Overview", exact: true }).click()
    await drawer
      .getByRole("button", { name: "View projects", exact: true })
      .click()
    await expect(
      drawer
        .getByText("Company website", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(drawer).toHaveCount(0)
    await expect(
      page.getByRole("button", {
        name: "More actions for Maria Santos",
        exact: true,
      }),
    ).toBeFocused()
    await page
      .getByRole("button", {
        name: "More actions for Maria Santos",
        exact: true,
      })
      .click()
    await page
      .getByRole("menuitem", { name: "View projects", exact: true })
      .click()
    await expect(
      drawer.getByRole("tab", { name: "Projects", exact: true }),
    ).toHaveAttribute("aria-selected", "true")
    await expect(
      drawer
        .getByText("Company website", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible()
    expect(
      api.relatedRequests.some(
        (path) => path.includes("service-requests") && path.includes("page=2"),
      ),
    ).toBe(true)
  })
}

test("related records have real error, retry and empty states", async ({
  page,
}) => {
  const api = await setup(page)
  api.setRelatedMode("error")
  await page.goto("/clients")
  await page
    .getByRole("button", { name: "View details for Maria Santos", exact: true })
    .click()
  const drawer = page.getByRole("dialog", { name: "Client details" })
  await drawer
    .getByRole("tab", { name: "Service requests", exact: true })
    .click()
  await expect(drawer.getByRole("alert")).toContainText(
    "Could not load related records",
  )
  api.setRelatedMode("data")
  await drawer.getByRole("button", { name: "Try again", exact: true }).click()
  await expect(
    drawer
      .getByText("Website inquiry", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible()
  api.setRelatedMode("empty")
  await drawer.getByRole("tab", { name: "Projects", exact: true }).click()
  await expect(drawer.getByText(/No projects/i)).toBeVisible()
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Next", exact: true }).click()
  await page
    .getByRole("button", {
      name: "View details for noname@example.com",
      exact: true,
    })
    .click()
  await drawer
    .getByRole("tab", { name: "Service requests", exact: true })
    .click()
  await expect(drawer.getByText(/No service requests/i)).toBeVisible()
})

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const selectors =
      'main, [role="dialog"], [role="tabpanel"], table, tbody, tr, td, th'
    const elements = [
      document.documentElement,
      ...document.querySelectorAll<HTMLElement>(selectors),
    ]
    return elements
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return (
          rect.width > 0 &&
          element.clientWidth > 0 &&
          !element.closest('[aria-hidden="true"]') &&
          element.scrollWidth > element.clientWidth + 1
        )
      })
      .map((element) => ({
        tag: element.tagName,
        role: element.getAttribute("role"),
        width: element.clientWidth,
        content: element.scrollWidth,
      }))
  })
  expect(overflow).toEqual([])
}

test("sortable client headings use consistent icons and toggle direction", async ({
  page,
}) => {
  const api = await setup(page)
  await page.setViewportSize({ width: 1477, height: 780 })
  await page.goto("/clients")
  await expect(page.getByText("Maria Santos", { exact: true })).toBeVisible()
  for (const [label, key] of [
    ["Client name", "fullName"],
    ["Email address", "email"],
    ["Account status", "isActive"],
    ["Date registered", "createdAt"],
  ]) {
    const button = page.getByRole("button", {
      name: `Sort by ${label}`,
      exact: true,
    })
    await expect(button.locator("svg")).toBeVisible()
    await button.click()
    await expect.poll(() => api.queries.at(-1)?.get("sortBy")).toBe(key)
    await expect.poll(() => api.queries.at(-1)?.get("sortOrder")).toBe("asc")
    await expect(button.locator("..")).toHaveAttribute("aria-sort", "ascending")
    await button.press("Enter")
    await expect.poll(() => api.queries.at(-1)?.get("sortOrder")).toBe("desc")
    await expect(button.locator("..")).toHaveAttribute(
      "aria-sort",
      "descending",
    )
  }
  await expectNoHorizontalOverflow(page)
})

test("reopening a related tab shows loading while refreshing its records", async ({
  page,
}) => {
  await setup(page)
  let calls = 0
  let release = () => {}
  const delayed = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(
    "**/api/clients/client-1-0/service-requests?**",
    async (route) => {
      calls += 1
      if (calls > 1) await delayed
      await route.fallback()
    },
  )
  try {
    await page.goto("/clients")
    await page
      .getByRole("button", {
        name: "View details for Maria Santos",
        exact: true,
      })
      .click()
    const drawer = page.getByRole("dialog", { name: "Client details" })
    await drawer
      .getByRole("tab", { name: "Service requests", exact: true })
      .click()
    await expect(
      drawer
        .getByText("Website inquiry", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible()
    await drawer.getByRole("tab", { name: "Overview", exact: true }).click()
    const refresh = page.waitForRequest((request) =>
      request.url().includes("/client-1-0/service-requests"),
    )
    await drawer
      .getByRole("tab", { name: "Service requests", exact: true })
      .click()
    await refresh
    await expect(drawer.getByRole("status")).toContainText(
      "Loading service requests",
    )
  } finally {
    release()
  }
})

for (const width of [320, 390, 768, 1024, 1866]) {
  test(`client views never require horizontal scrolling at ${width}px`, async ({
    page,
  }) => {
    await setup(page, "ADMIN", true, 1, true)
    await page.setViewportSize({ width, height: 995 })
    await page.goto("/clients")
    const view = page.getByRole("button", {
      name: `View details for ${"Client".repeat(20)}`,
      exact: true,
    })
    await expect(view).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await view.click()
    const drawer = page.getByRole("dialog", { name: "Client details" })
    await expect(
      drawer.getByRole("region", { name: "Personal information" }),
    ).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await drawer
      .getByRole("tab", { name: "Service requests", exact: true })
      .click()
    await expect(
      drawer
        .getByText("WebsiteInquiry".repeat(20), { exact: true })
        .filter({ visible: true }),
    ).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await drawer.getByRole("tab", { name: "Projects", exact: true }).click()
    await expect(
      drawer
        .getByText("CompanyWebsite".repeat(20), { exact: true })
        .filter({ visible: true }),
    ).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
}
