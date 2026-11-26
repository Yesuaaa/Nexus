import { expect, test, type Page } from "@playwright/test"
import {
  accountFor,
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"

configureRegressionTest()
test.skip(live, "PG-014 uses isolated browser fixtures")

const path = "/attendance/time-logs/overview"
const overview = "/api/attendance/overview"
const departments = "/api/attendance/departments"
const choices = [
  { id: "first", name: "Design" },
  { id: "second", name: "Engineering" },
]
const figures = (page: Page) => page.getByLabel("Time log figures")
const picker = (page: Page) =>
  page.getByRole("combobox", { name: "Time logs department" })
const from = (page: Page) =>
  page.getByLabel("Attendance from date", { exact: true })
const through = (page: Page) =>
  page.getByLabel("Attendance through date", { exact: true })

function summary(
  total = 5,
  options: {
    employees?: number
    working?: number
    onBreak?: number
    suspended?: number
    closed?: number
    recordedDays?: number
    leave?: number
  } = {},
) {
  return {
    employees: 9,
    recordedDays: options.recordedDays ?? 4,
    approvedLeaveDays: options.leave ?? 2,
    checkIns: {
      total,
      employees: options.employees ?? 3,
      working: options.working ?? 3,
      onBreak: options.onBreak ?? 0,
      suspended: options.suspended ?? 1,
      closed: options.closed ?? 1,
    },
  }
}

function gate() {
  let release: () => void = () => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

function read(page: Page, endpoint = overview) {
  return page.waitForRequest(
    (request) =>
      request.method() === "GET" &&
      new URL(request.url()).pathname === endpoint,
  )
}

async function setup(page: Page) {
  await page.clock.setFixedTime(new Date("2026-11-24T01:00:00Z"))
  await restoreSession(page, "ADMIN")
  await page.route("**" + departments, (route) =>
    route.fulfill({ json: { departments: choices } }),
  )
  await page.route("**" + overview + "?**", (route) =>
    route.fulfill({ json: summary() }),
  )
  await page.route("**/api/attendance/employees?**", (route) =>
    route.fulfill({ json: { employees: [], page: 1, pageSize: 10, total: 0 } }),
  )
}

async function select(page: Page, name: string) {
  await picker(page).click()
  await page.getByRole("option", { name, exact: true }).click()
}

test("[PG-014-F001-A001-T001] direct entry stays gated pending account and redirects denied actors", async ({
  browser,
  baseURL,
}) => {
  for (const scenario of [
    { role: null, target: "/login" },
    { role: "USER", target: "/dashboard" },
    { role: "STAFF", target: "/module" },
  ] as const) {
    const context = await browser.newContext({ baseURL })
    const page = await context.newPage()
    const pending = gate()
    const attendanceReads: string[] = []
    page.on("request", (request) => {
      if ([overview, departments].includes(new URL(request.url()).pathname))
        attendanceReads.push(request.url())
    })
    try {
      if (scenario.role) {
        const role = scenario.role
        await restoreSession(page, role)
        await page.route("**/api/auth/me", async (route) => {
          await pending.promise
          await route.fulfill({ json: { user: accountFor(role) } })
        })
      }
      await page.goto(path)
      if (scenario.role)
        await expect(
          page.getByRole("status").filter({ hasText: "Loading your account" }),
        ).toBeVisible()
      expect(attendanceReads).toEqual([])
      pending.release()
      await expect(page).toHaveURL(new RegExp(scenario.target + "$"))
      expect(attendanceReads).toEqual([])
    } finally {
      pending.release()
      await context.close()
    }
  }
})

test("[PG-014-F001-A002-T002] records links navigate without carrying overview filters", async ({
  page,
}) => {
  await setup(page)
  for (const source of ["header", "sidebar"]) {
    await page.goto(path)
    await select(page, "Design")
    await from(page).fill("2026-11-10")
    await through(page).fill("2026-11-10")
    if (source === "header") {
      await page
        .getByRole("link", { name: "View records", exact: true })
        .press("Enter")
    } else {
      const expand = page.getByRole("button", {
        name: "Expand sidebar",
        exact: true,
      })
      if (await expand.isVisible()) await expand.click()
      const group = page.getByRole("button", { name: "Time Logs", exact: true })
      const records = page
        .locator("#app-sidebar")
        .getByRole("link", { name: "Records", exact: true })
      if (!(await records.isVisible())) await group.click()
      await records.press("Enter")
    }
    await expect(page).toHaveURL(/\/attendance\/time-logs\/records$/)
  }
})

test("[PG-014-F001-A003-T002] initial overview and department reads settle independently", async ({
  page,
}) => {
  await setup(page)
  const overviewGate = gate()
  const departmentGate = gate()
  await page.route("**" + overview + "?**", async (route) => {
    await overviewGate.promise
    await route.fulfill({ json: summary() })
  })
  await page.route("**" + departments, async (route) => {
    await departmentGate.promise
    await route.fulfill({ json: { departments: choices } })
  })
  const initial = read(page)
  const initialDepartments = read(page, departments)
  try {
    await page.goto(path)
    const [request] = await Promise.all([initial, initialDepartments])
    expect(Object.fromEntries(new URL(request.url()).searchParams)).toEqual({
      from: "2026-10-25",
      to: "2026-11-25",
      departmentId: "",
    })
    await expect(figures(page)).toHaveAttribute("aria-busy", "true")
    await expect(figures(page).getByRole("definition")).toHaveText([
      "",
      "",
      "",
      "",
    ])
    await expect(picker(page)).toBeDisabled()
    overviewGate.release()
    await expect(figures(page)).toHaveAttribute("aria-busy", "false")
    await expect(picker(page)).toBeDisabled()
    departmentGate.release()
    await expect(picker(page)).toBeEnabled()
  } finally {
    overviewGate.release()
    departmentGate.release()
  }
})

test("[PG-014-F001-A004-T002] each incomplete range suppresses reads and refills recover", async ({
  page,
}) => {
  await setup(page)
  const requests: string[] = []
  page.on("request", (request) => {
    if ([overview, departments].includes(new URL(request.url()).pathname))
      requests.push(request.url())
  })
  await page.goto(path)
  await expect(picker(page)).toBeEnabled()
  await expect(figures(page)).toHaveAttribute("aria-busy", "false")
  for (const [input, key, value] of [
    [from(page), "from", "2026-11-10"],
    [through(page), "to", "2026-11-22"],
  ] as const) {
    const count = requests.length
    await input.fill("")
    await expect(input).toHaveValue("")
    await expect(figures(page)).toHaveAttribute("aria-busy", "false")
    const resumed = read(page)
    await input.fill(value)
    expect(new URL((await resumed).url()).searchParams.get(key)).toBe(value)
    await expect(figures(page)).toHaveAttribute("aria-busy", "false")
    expect(requests).toHaveLength(count + 1)
  }
})

test("[PG-014-F001-A007-T002] status shares round independently and bars have useful names", async ({
  page,
}) => {
  await setup(page)
  await page.route("**" + overview + "?**", (route) => {
    const filtered = new URL(route.request().url()).searchParams.get(
      "departmentId",
    )
    return route.fulfill({
      json: filtered
        ? summary(3, { working: 1, onBreak: 1, suspended: 1, closed: 0 })
        : summary(),
    })
  })
  await page.goto(path)
  const section = page.getByRole("region", { name: "Recorded session status" })
  await expect(section.getByRole("columnheader")).toHaveText([
    "Status",
    "Sessions",
    "Share",
  ])
  for (const expected of [
    ["60%", "0%", "20%", "20%"],
    ["33%", "33%", "33%", "0%"],
  ]) {
    const rows = section.locator("tbody tr")
    await expect(rows.locator("td:first-child")).toHaveText([
      "Clocked in",
      "On unpaid break",
      "Suspended",
      "Clocked out",
    ])
    await expect(rows.locator("td:last-child")).toHaveText(expected)
    await expect(
      rows.getByRole("img", {
        name:
          expected[0] === "60%"
            ? "Clocked in: 3 sessions"
            : "Clocked in: 1 sessions",
      }),
    ).toBeVisible()
    if (expected[0] === "60%") await select(page, "Design")
  }
})

test("[PG-014-F001-A008-T001] coverage distinguishes session employees, workdays and leave", async ({
  page,
}) => {
  await setup(page)
  await page.route("**" + overview + "?**", (route) => {
    const filtered = new URL(route.request().url()).searchParams.get(
      "departmentId",
    )
    return route.fulfill({
      json: filtered
        ? summary(0, {
            employees: 0,
            working: 0,
            suspended: 0,
            closed: 0,
            recordedDays: 0,
          })
        : summary(),
    })
  })
  await page.goto(path)
  const coverage = page
    .getByRole("region", { name: "Coverage" })
    .getByRole("definition")
  await expect(coverage).toHaveText(["3", "4", "2", "1.7"])
  await select(page, "Design")
  await expect(coverage).toHaveText(["0", "0", "2", "—"])
  await expect(page.getByText("No check-ins in this period.")).toBeVisible()
})

test("[PG-014-F001-A010-T003] network and HTTP errors recover using independent retries", async ({
  page,
}) => {
  await setup(page)
  const failOverview = (route: import("@playwright/test").Route) =>
    route.abort("failed")
  const failDepartments = (route: import("@playwright/test").Route) =>
    route.fulfill({
      status: 503,
      json: { error: "Department fixture unavailable" },
    })
  await page.route("**" + overview + "?**", failOverview)
  await page.route("**" + departments, failDepartments)
  await page.goto(path)
  const retry = page.getByRole("button", { name: "Retry", exact: true })
  await expect(retry).toHaveCount(2)
  await expect(page.getByText("Record summaries unavailable.")).toBeVisible()
  await expect(page.getByText("No check-ins in this period.")).toHaveCount(0)
  await page.unroute("**" + departments, failDepartments)
  await page
    .getByRole("alert")
    .filter({ hasText: "Department fixture unavailable" })
    .getByRole("button")
    .click()
  await expect(retry).toHaveCount(1)
  await expect(page.getByText("Record summaries unavailable.")).toBeVisible()
  await page.unroute("**" + overview + "?**", failOverview)
  await retry.click()
  await expect(retry).toHaveCount(0)
  await expect(
    figures(page).getByRole("definition").locator("span:first-child"),
  ).toHaveText(["3", "5", "1", "3"])
})

test("[PG-014-F001-A011-T001] latest selection wins and revisits do not revive obsolete reads", async ({
  page,
}) => {
  await setup(page)
  for (const status of [200, 503]) {
    const pending = gate()
    const finished = gate()
    const oldStarted = gate()
    await page.route("**" + overview + "?**", async (route) => {
      const department = new URL(route.request().url()).searchParams.get(
        "departmentId",
      )
      if (department === "first") {
        oldStarted.release()
        await pending.promise
        try {
          await route.fulfill({
            status,
            json: status === 200 ? summary(77) : { error: "Obsolete result" },
          })
        } catch (error) {
          if (!/abort|closed|interception|invalid/i.test(String(error)))
            throw error
        } finally {
          finished.release()
        }
      } else {
        await route.fulfill({ json: summary(department === "second" ? 9 : 5) })
      }
    })
    try {
      await page.goto(path)
      await select(page, "Design")
      await oldStarted.promise
      await select(page, "Engineering")
      await expect(figures(page).getByRole("definition").nth(1)).toHaveText("9")
      if (status === 503)
        await page.getByRole("link", { name: "View records" }).click()
      pending.release()
      await finished.promise
      if (status === 503) await page.goto(path)
      await expect(figures(page).getByRole("definition").nth(1)).toHaveText(
        status === 503 ? "5" : "9",
      )
      await expect(page.getByText("Obsolete result")).toHaveCount(0)
    } finally {
      pending.release()
    }
  }
})

test("[PG-014-F001-A011-T002] report request refreshes managed bearer or revokes expired access", async ({
  browser,
  baseURL,
}) => {
  for (const expired of [false, true]) {
    const context = await browser.newContext({ baseURL })
    const page = await context.newPage()
    try {
      await setup(page)
      let refreshes = 0
      const tokens: (string | undefined)[] = []
      await page.route("**/api/auth/refresh", (route) => {
        refreshes++
        return route.fulfill(
          expired
            ? { status: 401, json: { error: "Expired fixture" } }
            : {
                json: {
                  token: "pg014-renewed",
                  refreshToken: "pg014-refresh",
                  expiresIn: 300,
                },
              },
        )
      })
      await page.route("**" + overview + "?**", (route) => {
        const token = route.request().headers().authorization
        tokens.push(token)
        return route.fulfill(
          token === "Bearer pg014-renewed"
            ? { json: summary() }
            : {
                status: 401,
                json: {
                  error: "Expired fixture",
                  code: "ACCESS_TOKEN_EXPIRED",
                },
              },
        )
      })
      await page.goto(path)
      if (expired) {
        await expect(
          page.getByText("Record summaries unavailable."),
        ).toBeVisible()
        await page.evaluate(() =>
          window.dispatchEvent(new Event("nexus:account-updated")),
        )
        await expect(page).toHaveURL(/\/internal\/login$/)
        expect(tokens).toEqual(["Bearer test-session"])
      } else {
        await expect(figures(page).getByRole("definition").nth(1)).toHaveText(
          "5",
        )
        expect(tokens).toEqual(["Bearer test-session", "Bearer pg014-renewed"])
      }
      expect(refreshes).toBe(1)
    } finally {
      await context.close()
    }
  }
})

test("[PG-014-F001-A012-T001] keyboard department selection commits and Escape restores focus", async ({
  page,
}) => {
  await setup(page)
  await page.goto(path)
  const field = picker(page)
  await field.focus()
  await field.press("Enter")
  await expect(page.getByRole("listbox")).toBeVisible()
  await expect(
    page.getByRole("option", {
      name: "All permitted departments",
      exact: true,
    }),
  ).toBeFocused()
  await page.keyboard.press("ArrowDown")
  await expect(
    page.getByRole("option", { name: "Design", exact: true }),
  ).toBeFocused()
  const selected = read(page)
  await page.keyboard.press("Enter")
  expect(new URL((await selected).url()).searchParams.get("departmentId")).toBe(
    "first",
  )
  await field.press("Enter")
  await page.keyboard.press("Escape")
  await expect(field).toBeFocused()
  await expect(field).toContainText("Design")
})

test("[PG-014-F001-A012-T002] date dialog and Retry are keyboard operable at supported widths", async ({
  page,
}) => {
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await setup(page)
    let failed = false
    await page.route("**" + overview + "?**", (route) => {
      const requestedDate = new URL(route.request().url()).searchParams.get(
        "from",
      )
      if (requestedDate === "2026-10-24" && !failed) {
        failed = true
        return route.fulfill({
          status: 503,
          json: { error: "Keyboard fixture retry" },
        })
      }
      return route.fulfill({ json: summary() })
    })
    await page.goto(path)
    const input = from(page)
    await input.press("Alt+ArrowDown")
    const dialog = page.getByRole("dialog", { name: "Choose a date" })
    await expect(dialog).toBeVisible()
    await expect(dialog.locator("[data-calendar-focus=true]")).toBeFocused()
    await expect(input).toHaveAttribute("max", "2026-11-25")
    await expect(through(page)).toHaveAttribute("min", "2026-10-25")
    await dialog.getByRole("button", { name: "Next month" }).press("Enter")
    await expect(
      dialog.getByRole("button", { name: /November 26, 2026/ }),
    ).toBeDisabled()
    await page.keyboard.press("Escape")
    await expect(input).toBeFocused()
    await expect(input).toHaveValue("2026-10-25")
    await input.press("Alt+ArrowDown")
    await expect(dialog).toBeVisible()
    await dialog
      .getByRole("button", { name: /October 24, 2026/ })
      .press("Enter")
    await expect(input).toHaveValue("2026-10-24")
    await page
      .getByRole("button", { name: "Retry", exact: true })
      .press("Enter")
    await expect(figures(page).getByRole("definition").nth(1)).toHaveText("5")
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width)
  }
})
