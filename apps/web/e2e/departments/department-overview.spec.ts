import { expect, test, type Page, type Route } from "@playwright/test"
import {
  accountFor,
  configureRegressionTest,
  restoreSession,
} from "../regression-support"
import { defaultPreferences } from "../../src/features/settings/api/settings-api"

configureRegressionTest()
const path = "/departments/overview"
const endpoint = "**/api/departments"
const stamp = "2026-02-13T12:00:00.000Z"
const head = {
  id: "head",
  fullName: "Synthetic Head",
  email: "head@pg022.test",
  role: "STAFF",
}
const row = (name: string, memberCount: number) => ({
  id: name,
  name,
  memberCount,
  teamCount: 1,
  serviceCount: 1,
  head,
  code: null as string | null,
  createdAt: stamp,
})
const sample = [row("Aster", 3), row("Cedar", 2)]
const main = (page: Page) =>
  page.getByRole("main", { name: "Department overview" })
const figures = (page: Page) =>
  main(page).locator('dl[aria-label="Department figures"]')
const table = (page: Page) => main(page).getByRole("table")
const listing = (route: Route, departments: unknown[] = sample) =>
  route.fulfill({ json: { departments } })
async function setup(
  page: Page,
  handler: (route: Route) => Promise<void> = (route) => listing(route),
) {
  await restoreSession(page, "ADMIN")
  await page.route(endpoint, async (route) => {
    expect(route.request().method()).toBe("GET")
    expect(route.request().headers().authorization).toBe("Bearer test-session")
    await handler(route)
  })
}
async function open(page: Page, rows: unknown[] = sample) {
  await setup(page, (route) => listing(route, rows))
  await page.goto(path)
  await expect(figures(page)).toHaveAttribute("aria-busy", "false")
}
function gate() {
  let release = () => {}
  const wait = new Promise<void>((resolve) => {
    release = resolve
  })
  return { wait, release }
}
test("PG-022-F001-A002-T002 direct route admission and reload", async ({
  browser,
  baseURL,
}) => {
  for (const [role, allowed, permission] of [
    ["ADMIN", true, true],
    ["SUPERADMIN", true, true],
    [null, false, false],
    ["USER", false, false],
    ["STAFF", false, true],
    ["ADMIN", false, false],
    ["SUPERADMIN", false, false],
  ] as const) {
    const context = await browser.newContext({ baseURL })
    try {
      const page = await context.newPage()
      if (role) {
        const permissions = accountFor(role).permissions.filter(
          (item) => permission || item !== "departments:read",
        )
        await restoreSession(page, role, { account: { permissions } })
      }
      const requests: string[] = []
      page.on("request", (request) =>
        requests.push(new URL(request.url()).pathname),
      )
      await page.route(endpoint, (route) => listing(route))
      await page.goto(path)
      if (allowed) {
        await expect(table(page).getByText("Aster")).toBeVisible()
        await page.reload()
        await expect(table(page).getByText("Aster")).toBeVisible()
        expect(
          requests.filter((item) => item === "/api/departments"),
        ).toHaveLength(2)
      } else {
        await expect(page).toHaveURL(
          role === null
            ? /\/login$/
            : role === "USER"
              ? /\/dashboard$/
              : /\/module$/,
        )
        await expect(main(page)).toHaveCount(0)
        expect(requests).not.toContain("/api/departments")
        // The redirect destination can mount its own settings provider.
        expect(
          requests.slice(
            0,
            requests.indexOf(role === "USER" ? "/dashboard" : "/module") < 0
              ? undefined
              : requests.indexOf(role === "USER" ? "/dashboard" : "/module"),
          ),
        ).not.toContain("/api/auth/settings")
      }
    } finally {
      await context.close()
    }
  }
})
test("PG-022-F002-A001-T010 loading then populated", async ({ page }) => {
  const pending = gate()
  await setup(page, async (route) => {
    await pending.wait
    await listing(route)
  })
  try {
    await page.goto(path)
    await expect(figures(page)).toHaveAttribute("aria-busy", "true")
    await expect(
      main(page)
        .getByRole("region", { name: "Departments" })
        .locator('[aria-hidden="true"] > div'),
    ).toHaveCount(5)
    await expect(main(page).getByText("No departments yet.")).toHaveCount(0)
  } finally {
    pending.release()
  }
  await expect(figures(page)).toHaveAttribute("aria-busy", "false")
  await expect(table(page).getByText("Aster")).toBeVisible()
})
test("PG-022-F002-A002-T011 valid empty list", async ({ page }) => {
  await open(page, [])
  await expect(figures(page).locator("dd")).toHaveText(["0", "0", "0", "0/0"])
  await expect(main(page).getByText("No departments yet.")).toBeVisible()
  await expect(main(page).getByRole("heading", { name: "Gaps" })).toHaveCount(0)
  await expect(main(page).getByRole("alert")).toHaveCount(0)
  await expect(table(page)).toHaveCount(0)
})
test("PG-022-F003-A001-T012 exact aggregate figures", async ({ page }) => {
  await open(page, [
    { ...sample[0], teamCount: 2 },
    { ...row("Birch", 0), teamCount: null, head: null },
    sample[1],
  ])
  await expect(figures(page).locator("dt")).toHaveText([
    "Departments",
    "Employees",
    "Teams",
    "With a head",
  ])
  await expect(figures(page).locator("dd")).toHaveText(["3", "5", "3", /2\/3/])
  await expect(figures(page).getByText("1 without a head")).toBeVisible()
})
test("PG-022-F004-A001-T013 headcount and alphabetical tie", async ({
  page,
}) => {
  await open(page, [row("Zero", 0), row("Beta", 2), row("Able", 2)])
  await expect(table(page).locator("tbody tr td:first-child")).toHaveText([
    "Able",
    "Beta",
    "Zero",
  ])
})
test("PG-022-F004-A002-T014 row fallbacks", async ({ page }) => {
  await open(page, [
    { ...sample[0], code: "AST" },
    {
      ...sample[1],
      head: { ...head, fullName: "" },
      teamCount: null,
      serviceCount: undefined,
    },
    { ...row("Birch", 0), head: null },
  ])
  const aster = table(page).getByRole("row", { name: /Aster/ })
  const cedar = table(page).getByRole("row", { name: /Cedar/ })
  await expect(aster.getByText("AST", { exact: true })).toBeVisible()
  await expect(aster.getByText(head.fullName)).toBeVisible()
  await expect(cedar.getByText(head.email)).toBeVisible()
  await expect(cedar.getByRole("cell").nth(0)).toHaveText("Cedar")
  await expect(cedar.getByRole("cell").nth(3)).toHaveText("0")
  await expect(cedar.getByRole("cell").nth(4)).toHaveText("0")
  await expect(
    table(page).getByRole("row", { name: /Birch/ }).getByText("No head"),
  ).toBeVisible()
})
test("PG-022-F005-A001-T015 employee shares including zero denominator", async ({
  page,
}) => {
  let rows = sample
  await setup(page, (route) => listing(route, rows))
  await page.goto(path)
  for (const [name, pct] of [
    ["Aster", 60],
    ["Cedar", 40],
  ]) {
    await expect(
      main(page)
        .getByRole("img", { name: name + ": " + pct + "% of employees" })
        .locator("span"),
    ).toHaveAttribute("style", "width: " + pct + "%;")
  }
  rows = [row("Zero", 0), row("Empty", 0)]
  await page.reload()
  for (const name of ["Zero", "Empty"]) {
    await expect(
      main(page)
        .getByRole("img", { name: name + ": 0% of employees" })
        .locator("span"),
    ).toHaveAttribute("style", "width: 0%;")
  }
  await expect(table(page)).not.toContainText(/NaN|Infinity/)
})
test("PG-022-F006-A001-T016 overlapping gaps", async ({ page }) => {
  await open(page, [
    { ...row("Zeta", 0), head: null },
    { ...row("Able", 0), head: null },
  ])
  const gaps = main(page).getByRole("region", { name: "Gaps" })
  await expect(gaps.locator("dt")).toHaveText([
    "Without a head",
    "No employees",
  ])
  await expect(gaps.locator("dd")).toHaveText(["Able, Zeta", "Able, Zeta"])
  await page.route(
    endpoint,
    (route) =>
      listing(route, [
        { ...row("Zeta", 0), head: null, serviceCount: 0 },
        { ...row("Able", 0), head: null, serviceCount: 0 },
      ]),
    { times: 1 },
  )
  await page.reload()
  await expect(gaps.locator("dt")).toHaveText([
    "Without a head",
    "No employees",
    "No services",
  ])
  await expect(gaps.locator("dd")).toHaveText([
    "Able, Zeta",
    "Able, Zeta",
    "Able, Zeta",
  ])
})
test("PG-022-F006-A002-T017 all clear", async ({ page }) => {
  await open(page)
  const gaps = main(page).getByRole("region", { name: "Gaps" })
  await expect(gaps).toHaveText(
    /None\. Every department has a head, employees, and services\./,
  )
  await expect(gaps.locator("dt")).toHaveCount(0)
  await expect(figures(page)).not.toContainText("without a head")
})
test("PG-022-F007-A001-T018 configured Created dates", async ({ page }) => {
  await setup(page)
  for (const [dateFormat, expected] of [
    ["MM/DD/YYYY", "02/14/2026"],
    ["DD/MM/YYYY", "14/02/2026"],
    ["YYYY-MM-DD", "2026-02-14"],
  ]) {
    await page.route(
      "**/api/auth/settings",
      (route) =>
        route.fulfill({
          json: {
            preferences: {
              ...defaultPreferences,
              timeZone: "Pacific/Auckland",
              dateFormat,
            },
            sessions: [],
          },
        }),
      { times: 1 },
    )
    await page.goto(path)
    await expect(
      table(page).getByRole("row", { name: /Aster/ }).getByRole("cell").last(),
    ).toHaveText(expected)
  }
})
test("PG-022-F008-A001-T019 responsive boundaries", async ({ page }) => {
  await open(page, [{ ...row("Aster", 3), head: null }])
  for (const width of [390, 560, 561, 640, 641, 1024, 1025]) {
    await test.step(width + "px", async () => {
      await page.setViewportSize({ width, height: 900 })
      for (const label of ["Head", "Teams", "Services", "Created"]) {
        const column = table(page).getByRole("columnheader", {
          name: label,
          exact: true,
          includeHidden: true,
        })
        const threshold = label === "Created" ? 1024 : 640
        if (width <= threshold) await expect.soft(column).toBeHidden()
        else await expect.soft(column).toBeVisible()
      }
      await expect
        .soft(
          main(page).getByRole("region", { name: "Gaps" }).locator("dl > div"),
        )
        .toHaveCSS("flex-direction", width <= 560 ? "column" : "row")
      await expect(table(page).getByText("Aster")).toBeVisible()
    })
  }
})
test("PG-022-F009-A001-T020 accessible overview semantics", async ({
  page,
}) => {
  const pending = gate()
  await setup(page, async (route) => {
    await pending.wait
    await listing(route)
  })
  try {
    await page.goto(path)
    await expect(main(page)).toBeVisible()
    await expect(figures(page)).toHaveAttribute("aria-busy", "true")
    await expect(
      main(page)
        .getByRole("region", { name: "Departments" })
        .locator(':scope > div[aria-hidden="true"]'),
    ).toBeVisible()
  } finally {
    pending.release()
  }
  await expect(figures(page)).toHaveAttribute("aria-busy", "false")
  await expect(table(page).getByRole("columnheader")).toHaveText([
    "Department",
    "Head",
    "Employees",
    "Teams",
    "Services",
    "Created",
  ])
  await expect(
    main(page).getByRole("img", { name: "Aster: 60% of employees" }),
  ).toBeVisible()
})
test("PG-022-F010-A002-T021 keyboard navigation and Back", async ({ page }) => {
  await open(page)
  const manage = main(page).getByRole("link", { name: "Manage departments" })
  await expect(manage).toHaveAttribute("href", "/departments")
  await manage.focus()
  await expect(manage).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/departments$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/departments\/overview$/)
  await expect(table(page).getByText("Aster")).toBeVisible()
})
test("PG-022-F002-A003-T022 list error and retry", async ({ page }) => {
  let calls = 0
  await setup(page, (route) =>
    ++calls === 1
      ? route.fulfill({
          status: 503,
          json: { error: "Synthetic list unavailable" },
        })
      : listing(route),
  )
  await page.goto(path)
  await expect(main(page).getByRole("alert")).toContainText(
    "Synthetic list unavailable",
  )
  await main(page).getByRole("button", { name: "Try again" }).click()
  await expect(table(page).getByText("Aster")).toBeVisible()
  await expect(main(page).getByRole("alert")).toHaveCount(0)
  expect(calls).toBe(2)
})
test("PG-022-F002-A004-T023 pending fetch is aborted on route exit", async ({
  page,
}) => {
  const pending = gate()
  await setup(page, async () => pending.wait)
  try {
    const request = page.waitForRequest((item) =>
      item.url().endsWith("/api/departments"),
    )
    await page.goto(path)
    const original = await request
    const failed = page.waitForEvent("requestfailed", {
      predicate: (item) => item === original,
    })
    await main(page).getByRole("link", { name: "Manage departments" }).click()
    await expect(page).toHaveURL(/\/departments$/)
    expect((await failed).failure()).not.toBeNull()
    await expect(main(page)).toHaveCount(0)
  } finally {
    pending.release()
  }
})
test("PG-022-F002-A005-T024 obsolete synthetic result after role change", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  await page.addInitScript(() => {
    const original = window.fetch.bind(window)
    window.fetch = (input, options) => {
      if (String(input).endsWith("/api/departments")) {
        return new Promise((resolve) =>
          document.addEventListener(
            "pg022-release",
            () => {
              resolve(
                Response.json({
                  departments: [
                    {
                      id: "old",
                      name: "PG022 obsolete department",
                      memberCount: 0,
                    },
                  ],
                }),
              )
              document.documentElement.dataset.pg022Released = "true"
            },
            { once: true },
          ),
        )
      }
      return original(input, options)
    }
  })
  await page.goto(path)
  await expect(figures(page)).toHaveAttribute("aria-busy", "true")
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: accountFor("STAFF") } }),
  )
  await page.evaluate(() =>
    window.dispatchEvent(new Event("nexus:account-updated")),
  )
  await expect(page).toHaveURL(/\/module$/)
  await page.evaluate(() => document.dispatchEvent(new Event("pg022-release")))
  await expect(page.locator("html")).toHaveAttribute(
    "data-pg022-released",
    "true",
  )
  await expect(main(page)).toHaveCount(0)
  await expect(page.getByText("PG022 obsolete department")).toHaveCount(0)
})
test("PG-022-F014-A001-T025 inert department and Head text", async ({
  page,
}) => {
  const name = '<img data-pg022-marker="department">'
  const fullName = '<script data-pg022-marker="head"></script>'
  await open(page, [{ ...row(name, 1), head: { ...head, fullName } }])
  await expect(table(page).getByText(name, { exact: true })).toBeVisible()
  await expect(table(page).getByText(fullName, { exact: true })).toBeVisible()
  await expect(page.locator("[data-pg022-marker]")).toHaveCount(0)
})
