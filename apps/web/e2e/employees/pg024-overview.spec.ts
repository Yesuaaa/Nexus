import { expect, test, type Page } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

const overview = "/employees/overview"
const counts = new Map([
  ["page=1", 8],
  ["page=1&status=ACTIVE", 5],
  ["page=1&status=ON_LEAVE", 2],
  ["page=1&status=INACTIVE", 1],
  ["archived=true&page=1", 2],
  ["employmentType=FULL_TIME&page=1", 2],
  ["employmentType=PART_TIME&page=1", 1],
  ["employmentType=CONTRACT&page=1", 0],
  ["employmentType=INTERN&page=1", 1],
])
const departments = [
  { id: "gamma", name: "Gamma", memberCount: 0 },
  { id: "beta", name: "Beta", memberCount: 3 },
  { id: "able", name: "Able", memberCount: 3 },
]
const canary = {
  fullName: "PG024 Canary Name",
  email: "pg024-canary@example.test",
  contactNumber: "09178234567",
  employeeId: "PG024-EMP",
  position: "PG024 Canary Position",
  accountId: "PG024-ACCOUNT",
}
const main = (page: Page) =>
  page.getByRole("main", { name: "Employee overview" })
const figures = (page: Page) =>
  main(page).locator('dl[aria-label="Employee figures"]')
const region = (page: Page, name: string) =>
  main(page).getByRole("region", { name, exact: true })
const settled = (page: Page) =>
  expect(figures(page)).toHaveAttribute("aria-busy", "false")
function gate() {
  let release = () => {}
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  return { pending, release }
}

async function mockOverview(
  page: Page,
  options: {
    totals?: (query: string, count: number) => number
    departments?: typeof departments
    hold?: (key: string) => Promise<void> | undefined
    fail?: (query: string) => boolean
    rows?: object[]
  } = {},
) {
  const calls: { key: string; method: string; auth: string | undefined }[] = []
  await page.route(/\/api\/(employees|departments)(?:\?|$)/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    url.searchParams.sort()
    const department = url.pathname === "/api/departments"
    const key = department ? "departments" : url.searchParams.toString()
    calls.push({
      key,
      method: request.method(),
      auth: request.headers().authorization,
    })
    const hold = options.hold?.(key)
    if (hold) await hold
    const count = counts.get(key)
    if (department)
      await route.fulfill({
        json: { departments: options.departments ?? departments },
      })
    else if (count === undefined)
      await route.fulfill({
        status: 400,
        json: { error: "Unexpected overview query" },
      })
    else if (options.fail?.(key))
      await route.fulfill({
        status: 503,
        json: { error: "PG024 count unavailable" },
      })
    else
      await route.fulfill({
        json: {
          employees: options.rows ?? [],
          total: options.totals?.(key, count) ?? count,
          page: 1,
          pageSize: 10,
        },
      })
  })
  return calls
}

test("PG-024-F001-A001-T001 admits only authorized overview actors", async ({
  browser,
  baseURL,
}) => {
  for (const actor of [
    "ADMIN",
    "SUPERADMIN",
    "STAFF",
    "USER",
    "unprivileged-admin",
    "anonymous",
  ] as const) {
    await test.step(actor, async () => {
      const context = await browser.newContext({ baseURL })
      try {
        const page = await context.newPage()
        const allowed = actor === "ADMIN" || actor === "SUPERADMIN"
        if (actor === "unprivileged-admin")
          await restoreSession(page, "ADMIN", { account: { permissions: [] } })
        else if (actor !== "anonymous") await restoreSession(page, actor)
        const sequence: string[] = []
        page.on("response", (response) => {
          if (new URL(response.url()).pathname === "/api/auth/me")
            sequence.push("auth")
        })
        page.on("request", (request) => {
          if (/\/api\/(employees|departments)(?:\?|$)/.test(request.url()))
            sequence.push("overview")
        })
        const calls = await mockOverview(page)
        await page.goto(overview)
        if (allowed) {
          await settled(page)
          expect(sequence[0]).toBe("auth")
          expect(calls).toHaveLength(10)
          await page.reload()
          await settled(page)
          await expect(
            main(page).getByRole("heading", { name: "Employee Overview" }),
          ).toBeVisible()
        } else {
          await expect(page).toHaveURL(
            new RegExp(
              actor === "anonymous"
                ? "/login$"
                : actor === "USER"
                  ? "/dashboard$"
                  : "/module$",
            ),
          )
          await expect(main(page)).toHaveCount(0)
          expect(calls).toHaveLength(0)
        }
      } finally {
        await context.close()
      }
    })
  }
})

test("PG-024-F003-A001-T003 sends the exact overview reads", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  const calls = await mockOverview(page)
  await page.goto(overview)
  await settled(page)
  expect(calls.map(({ key }) => key).sort()).toEqual(
    [...counts.keys(), "departments"].sort(),
  )
  for (const { method, auth } of calls) {
    expect(method).toBe("GET")
    expect(auth).toBe("Bearer test-session")
  }
})

test("PG-024-F004-A001-T004 cancels pending overview reads on exit", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  const pending = gate()
  const failed: string[] = []
  page.on("requestfailed", (request) => {
    if (
      /\/api\/(employees|departments)(?:\?|$)/.test(request.url()) &&
      request.failure()?.errorText.includes("ABORTED")
    )
      failed.push(request.url())
  })
  const calls = await mockOverview(page, { hold: () => pending.pending })
  try {
    await page.goto(overview)
    await expect.poll(() => calls.length).toBe(10)
    await page
      .getByRole("link", { name: "Switch Workspace", exact: true })
      .click()
    await expect(page).toHaveURL(/\/module$/)
  } finally {
    pending.release()
  }
  await expect.poll(() => new Set(failed).size).toBe(10)
  await expect(main(page)).toHaveCount(0)
})

test("PG-024-F006-A001-T006 separates archived and current totals", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  let archived = 2
  await mockOverview(page, {
    totals: (key, count) => (key.startsWith("archived") ? archived : count),
  })
  await page.goto(overview)
  await settled(page)
  await expect(figures(page).locator("dd").first()).toContainText(/^8/)
  await expect(figures(page).getByText("2 archived")).toBeVisible()
  archived = 0
  await page.reload()
  await settled(page)
  await expect(figures(page).locator("dd").first()).toHaveText("8")
  await expect(figures(page).getByText(/archived/)).toHaveCount(0)
})

test("PG-024-F008-A001-T008 renders availability counts and chart", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await mockOverview(page)
  await page.goto(overview)
  await settled(page)
  const availability = region(page, "Availability")
  await expect(figures(page).locator("dt")).toHaveText([
    "Employees",
    "Active",
    "On leave",
    "Inactive",
  ])
  await expect(figures(page).locator("dd").nth(1)).toHaveText("5")
  await expect(figures(page).locator("dd").nth(2)).toHaveText("2")
  await expect(figures(page).locator("dd").nth(3)).toHaveText("1")
  await expect(availability.getByRole("img")).toHaveAccessibleName(
    "Employee availability: Active 5 (63%), On leave 2 (25%), Inactive 1 (13%)",
  )
  await expect(availability.getByRole("listitem")).toHaveText([
    /Active\s*5\s*63%/,
    /On leave\s*2\s*25%/,
    /Inactive\s*1\s*13%/,
  ])
})

test("PG-024-F009-A001-T009 renders employment counts and zero-safe shares", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  let zero = false
  await mockOverview(page, {
    totals: (key, count) => (zero ? 0 : key === "page=1" ? 5 : count),
  })
  const rows = region(page, "Employment type").locator("tbody tr")
  await page.goto(overview)
  await settled(page)
  for (const [index, values] of [
    ["Full Time", "2", "40%"],
    ["Part Time", "1", "20%"],
    ["Contract", "0", "0%"],
    ["Intern", "1", "20%"],
  ].entries()) {
    await expect(rows.nth(index).getByRole("cell")).toHaveText(values)
  }
  zero = true
  await page.reload()
  await settled(page)
  await expect(rows.locator("td:nth-child(2)")).toHaveText(["0", "0", "0", "0"])
  await expect(rows.locator("td:nth-child(3)")).toHaveText([
    "0%",
    "0%",
    "0%",
    "0%",
  ])
  await expect(main(page).getByText(/NaN|Infinity/)).toHaveCount(0)
})

test("PG-024-F011-A001-T011 sorts Department rows and renders placement", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await mockOverview(page)
  await page.goto(overview)
  await settled(page)
  const section = region(page, "By department")
  await expect(section.locator("tbody td:first-child")).toHaveText([
    "Able",
    "Beta",
    "Gamma",
  ])
  await expect(section.locator("tbody td:nth-child(2)")).toHaveText([
    "3",
    "3",
    "None",
  ])
  await expect(section.locator("tbody td:nth-child(3)")).toHaveText([
    "50%",
    "50%",
    "",
  ])
  await expect(section.getByText("6 placed")).toBeVisible()
})

test("PG-024-F012-A001-T012 renders valid empty results", async ({ page }) => {
  await restoreSession(page, "ADMIN")
  await mockOverview(page, { totals: () => 0, departments: [] })
  await page.goto(overview)
  await settled(page)
  await expect(figures(page).locator("dd")).toHaveText(["0", "0", "0", "0"])
  await expect(
    region(page, "Employment type").locator("tbody td:nth-child(3)"),
  ).toHaveText(["0%", "0%", "0%", "0%"])
  await expect(
    region(page, "Availability").getByRole("img"),
  ).toHaveAccessibleName(
    "Employee availability: Active 0 (0%), On leave 0 (0%), Inactive 0 (0%)",
  )
  await expect(main(page).getByText("No departments yet.")).toBeVisible()
  await expect(main(page).getByRole("alert")).toHaveCount(0)
})

test("PG-024-F013-A001-T013 waits for both overview sources", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  for (const first of ["departments", "page=1"]) {
    const employee = gate()
    const department = gate()
    const calls = await mockOverview(page, {
      hold: (key) =>
        key === "departments"
          ? department.pending
          : key === "page=1"
            ? employee.pending
            : undefined,
    })
    try {
      await page.goto(overview)
      await expect.poll(() => calls.length).toBe(10)
      const response = page.waitForResponse((r) =>
        first === "departments"
          ? r.url().endsWith("/api/departments")
          : r.url().endsWith("/api/employees?page=1"),
      )
      if (first === "departments") department.release()
      else employee.release()
      await (await response).finished()
      await expect(figures(page)).toHaveAttribute("aria-busy", "true")
      await expect(main(page).getByRole("table")).toHaveCount(0)
      await expect(region(page, "Availability").getByRole("img")).toHaveCount(0)
    } finally {
      employee.release()
      department.release()
    }
    await settled(page)
    await expect(main(page).getByRole("table")).toHaveCount(2)
    await expect(figures(page).locator("dd").first()).toContainText(/^8/)
  }
})

test("PG-024-F014-A001-T014 retries exactly the Employee count batch", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  let initial = true
  const calls = await mockOverview(page, {
    fail: (key) => initial && key === "page=1&status=ACTIVE",
  })
  await page.goto(overview)
  await expect(main(page).getByRole("alert")).toContainText(
    "PG024 count unavailable",
  )
  await expect.poll(() => calls.length).toBe(10)
  const retry = main(page).getByRole("button", { name: "Try again" })
  await expect(retry).toBeVisible()
  initial = false
  await retry.click()
  await settled(page)
  expect(
    calls
      .slice(10)
      .map(({ key }) => key)
      .sort(),
  ).toEqual([...counts.keys()].sort())
  await expect(main(page).getByRole("alert")).toHaveCount(0)
  await expect(figures(page).locator("dd")).toHaveText([
    /8.*2 archived/,
    "5",
    "2",
    "1",
  ])
  await expect(main(page).getByRole("table")).toHaveCount(2)
})

test("PG-024-F016-A001-T016 exposes named overview structure", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await mockOverview(page)
  await page.goto(overview)
  await settled(page)
  await expect(
    main(page).getByRole("heading", { name: "Employee Overview", exact: true }),
  ).toBeVisible()
  for (const name of ["Availability", "Employment type", "By department"])
    await expect(
      region(page, name).getByRole("heading", { name }),
    ).toBeVisible()
  await expect(
    region(page, "Employment type")
      .getByRole("table")
      .getByRole("columnheader"),
  ).toHaveText(["Type", "Count", "Share"])
  await expect(
    region(page, "By department").getByRole("table").getByRole("columnheader"),
  ).toHaveText(["Department", "Employees", "Share"])
  await expect(
    region(page, "Availability").getByRole("img", {
      name: /Employee availability/,
    }),
  ).toBeVisible()
  await expect(
    region(page, "Employment type").getByRole("img", {
      name: "Full Time: 25%",
    }),
  ).toBeVisible()
  await expect(
    region(page, "By department").getByRole("img", { name: "Able: 50%" }),
  ).toBeVisible()
})

test("PG-024-F017-A001-T017 opens directory by keyboard and returns", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await mockOverview(page)
  await page.goto(overview)
  await settled(page)
  const link = main(page).getByRole("link", { name: "Manage employees" })
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab")
    if (await link.evaluate((node) => node === document.activeElement)) break
  }
  await expect(link).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/employees$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/employees\/overview$/)
  await expect(
    main(page).getByRole("heading", { name: "Employee Overview" }),
  ).toBeVisible()
})

test("PG-024-F018-A001-T018 preserves overview responsive boundaries", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await mockOverview(page)
  await page.goto(overview)
  await settled(page)
  for (const width of [479, 480, 481, 1023, 1024, 1025]) {
    await test.step(width + " CSS px", async () => {
      await page.setViewportSize({ width, height: 900 })
      const left = region(page, "Employment type")
      const right = region(page, "By department")
      const share = right.locator("th").filter({ hasText: "Share" })
      if (width <= 480) await expect.soft(share).toBeHidden()
      else await expect.soft(share).toBeVisible()
      await expect
        .soft(right.getByRole("cell", { name: "Able", exact: true }))
        .toBeVisible()
      await expect.soft(left.getByRole("table")).toBeVisible()
      await expect.soft
        .poll(async () =>
          right.evaluate(
            (node) =>
              getComputedStyle(node.parentElement!).gridTemplateColumns.split(
                " ",
              ).length,
          ),
        )
        .toBe(width < 1024 ? 1 : 2)
    })
  }
})

test("PG-024-F019-A001-T019 keeps row canaries outside overview DOM", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await mockOverview(page, { rows: [canary] })
  await page.goto(overview)
  await settled(page)
  await expect(figures(page).locator("dd").first()).toContainText(/^8/)
  for (const value of Object.values(canary))
    await expect(main(page)).not.toContainText(value)
})

test("PG-024-F020-A001-T020 renders synthetic Department markup as text", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  const label = '<strong data-pg024="markup">Synthetic Department</strong>'
  await mockOverview(page, {
    departments: [{ id: "markup", name: label, memberCount: 1 }],
  })
  await page.goto(overview)
  await settled(page)
  await expect(main(page).getByText(label, { exact: true })).toBeVisible()
  await expect(main(page).locator('[data-pg024="markup"]')).toHaveCount(0)
})
