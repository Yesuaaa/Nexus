import { test, expect, type Page } from "@playwright/test"
import { spawn, type ChildProcess } from "node:child_process"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { defaultPreferences } from "../src/features/settings/api/settings-api"

test.describe.configure({ mode: "serial" })
type Fixture = {
  secret: string
  actors: Record<
    string,
    { token: string; refreshToken: string; employeeId: string; userId: string }
  >
}
let fixture: Fixture
let server: ChildProcess
const api = "http://127.0.0.1:5391"
test.beforeAll(async () => {
  test.setTimeout(90000)
  const root = path.resolve(import.meta.dirname, "../../..")
  server = spawn(
    process.execPath,
    [
      path.join(root, "apps/api/scripts/run-tests.mjs"),
      "--fixture",
      "tests/support/attendance-browser-server.ts",
    ],
    {
      cwd: path.join(root, "apps/api"),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  )
  fixture = await new Promise<Fixture>((resolve, reject) => {
    let output = "",
      errors = ""
    const timeout = setTimeout(
      () =>
        reject(new Error(`Attendance fixture startup timed out: ${errors}`)),
      60000,
    )
    server.stderr?.on("data", (chunk) => {
      errors += String(chunk)
    })
    server.stdout?.on("data", (chunk) => {
      output += String(chunk)
      const match = output.match(/ATTENDANCE_READY:(\{[^\r\n]+\})/)
      if (match) {
        clearTimeout(timeout)
        resolve(JSON.parse(match[1]) as Fixture)
      }
    })
    server.once("error", reject)
    server.once("exit", (code) => {
      clearTimeout(timeout)
      reject(new Error(`Attendance fixture exited ${code}: ${errors}`))
    })
  })
})
async function routeAttendanceApi(
  page: Page,
  { realNotifications = false } = {},
) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url())
    if (
      [
        "/api/request-conversations",
        "/api/internal-conversations",
        "/api/project-conversations",
        "/api/auth/settings",
      ].includes(url.pathname)
    ) {
      if (url.pathname === "/api/auth/settings")
        return route.fulfill({
          json: { preferences: defaultPreferences, sessions: [] },
        })
      return route.fulfill({
        json: { conversations: [], nextCursor: null, unreadCount: 0 },
      })
    }
    if (
      !realNotifications &&
      url.pathname === "/api/request-workflows/notifications"
    )
      return route.fulfill({ json: { notifications: [], unreadCount: 0 } })
    const response = await route.fetch({
      url: `${api}${url.pathname}${url.search}`,
    })
    await route.fulfill({ response })
  })
}
test.beforeEach(async ({ page }) => routeAttendanceApi(page))
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" })
})
test.afterAll(() => {
  server?.kill()
})

test.beforeEach(async ({ context }) => {
  // Forward same-origin requests to this test's real offline API rather than
  // whichever backend target was baked into the shared Next production build.
  await context.route("**/api/**", async (route) => {
    const url = new URL(route.request().url())
    await route.continue({ url: `${api}${url.pathname}${url.search}` })
  })
})

async function signIn(page: Page, actor: string) {
  await page.addInitScript((session) => {
    sessionStorage.setItem("nexus.auth.token", session.token)
    sessionStorage.setItem("nexus.auth.refreshToken", session.refreshToken)
  }, fixture.actors[actor])
}
async function createApprovedCorrection(
  startedAt: string,
  endedAt: string,
  reason: string,
) {
  const createdResponse = await fetch(`${api}/api/attendance/adjustments`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${fixture.actors.staff.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      type: "CORRECTION",
      requestKey: randomUUID(),
      startedAt,
      endedAt,
      reason,
    }),
  })
  expect(createdResponse.status).toBe(201)
  const created = (await createdResponse.json()) as {
    adjustment: { id: string }
  }
  const reviewedResponse = await fetch(
    `${api}/api/attendance/adjustments/${created.adjustment.id}/review`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${fixture.actors.head.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        decision: "APPROVED",
        note: "Verified by the isolated browser fixture",
      }),
    },
  )
  expect(reviewedResponse.status).toBe(200)
  const final = await fetch(
    `${api}/api/attendance/adjustments/${created.adjustment.id}/review`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${fixture.actors.admin.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ decision: "APPROVED", note: "Approved by the isolated HR fixture" }),
    },
  )
  expect(final.status).toBe(200)
  expect((await final.json()).adjustment.status).toBe("APPROVED")
}
async function clock(value: string) {
  const response = await fetch(`${api}/__attendance_clock`, {
    method: "POST",
    headers: { "x-attendance-fixture": fixture.secret },
    body: value,
  })
  expect(response.status).toBe(204)
}
async function confirm(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: label, exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
}

async function assertNoPageOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true)
}

test("real employee clocks overnight and never receives Employee Management", async ({
  page,
}) => {
  await signIn(page, "staff")
  await page.goto("/module")
  await page
    .getByRole("link", {
      name: "Open Workforce Compliance workspace",
      exact: true,
    })
    .click()
  await expect(page).toHaveURL(/\/attendance\/check-ins$/)
  await expect(
    page.getByRole("heading", { name: "Check-Ins", exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Employees", exact: true }),
  ).toHaveCount(0)
  await confirm(page, "Clock in")
  await expect(page.getByText("Clocked in", { exact: true })).toBeVisible()
  await clock("2026-11-14T04:00:00+08:00")
  await page.getByRole("button", { name: "Refresh", exact: true }).click()
  await expect(page.getByLabel("Elapsed work")).toHaveText(/08:00:0/)
  await confirm(page, "Clock out")
  await expect(
    page
      .getByRole("table", { name: "Attendance history" })
      .last()
      .getByText("Complete", { exact: true }),
  ).toBeVisible()
  const historyResponse = await fetch(
    `${api}/api/attendance/me/history?from=2026-11-13&to=2026-11-14`,
    { headers: { Authorization: `Bearer ${fixture.actors.staff.token}` } },
  )
  const recorded = (await historyResponse.json()) as {
    workdays: { workDate: string; workedHours: number }[]
  }
  expect(
    recorded.workdays.map((day) => [day.workDate, day.workedHours]),
  ).toEqual([["2026-11-13", 8]])
  await expect(
    page.getByText("Overnight", { exact: true }).first(),
  ).toBeVisible()
  await page.goto("/employees")
  await expect(page).toHaveURL(/\/module$/)
})

test("unpaid break timer freezes and correction request uses the real API", async ({
  page,
}) => {
  await signIn(page, "staff")
  await clock("2026-11-14T09:00:00+08:00")
  await page.goto("/attendance/check-ins")
  await confirm(page, "Clock in")
  await clock("2026-11-14T10:00:00+08:00")
  await confirm(page, "Start break")
  await expect(page.getByText("On unpaid break", { exact: true })).toBeVisible()
  const elapsed = await page.getByLabel("Elapsed work").textContent()
  await clock("2026-11-14T11:00:00+08:00")
  await page.getByRole("button", { name: "Refresh", exact: true }).click()
  await expect(page.getByLabel("Elapsed work")).toHaveText(elapsed!)
  await expect(
    page.getByRole("button", { name: "Clock out", exact: true }),
  ).toBeEnabled()
  await confirm(page, "End break")
  await clock("2026-11-14T18:00:00+08:00")
  await confirm(page, "Start break")
  await clock("2026-11-14T19:00:00+08:00")
  await confirm(page, "Clock out")
  await expect(page.getByText("Clocked out", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "End break", exact: true }),
  ).toHaveCount(0)
  const response = await fetch(
    `${api}/api/attendance/me/history?from=2026-11-14&to=2026-11-14`,
    { headers: { Authorization: `Bearer ${fixture.actors.staff.token}` } },
  )
  const data = (await response.json()) as {
    workdays: { workedHours: number }[]
  }
  expect(data.workdays[0].workedHours).toBe(8)
  await page
    .getByRole("button", { name: "Request missing attendance", exact: true })
    .click()
  await page
    .getByLabel("Actual clock-in", { exact: true })
    .fill("2026-11-12T09:00")
  await page
    .getByLabel("Actual clock-out", { exact: true })
    .fill("2026-11-12T10:00")
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Missed clock-in while working on a service request")
  await page
    .getByRole("button", { name: "Submit request", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await signIn(page, "head")
  await page.goto("/attendance/adjustments")
  await expect(page.getByText("Pending", { exact: true })).toBeVisible()
})

test("department head reviews scoped requests and HR policy settings work", async ({
  page,
}) => {
  const requestReason = "Standalone head review fixture request"
  const requestResponse = await fetch(`${api}/api/attendance/adjustments`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${fixture.actors.staff.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      type: "CORRECTION",
      requestKey: randomUUID(),
      startedAt: "2026-11-10T02:00:00.000Z",
      endedAt: "2026-11-10T03:00:00.000Z",
      reason: requestReason,
    }),
  })
  expect(requestResponse.status).toBe(201)

  await signIn(page, "head")
  await page.goto("/attendance/adjustments")
  await expect(
    page.getByRole("heading", { name: "Requests & Approvals", exact: true }),
  ).toBeVisible()
  const requestRow = page.getByRole("row").filter({ hasText: requestReason })
  await requestRow
    .getByRole("button", { name: /More actions for .* request/ })
    .click()
  await page
    .getByRole("menuitem", { name: "Verify correction", exact: true })
    .click()
  await page
    .getByRole("textbox", { name: "Review note", exact: true })
    .fill("Verified the service work with the department")
  await page
    .getByRole("button", { name: "Confirm decision", exact: true })
    .click()
  await expect(page.getByText("Verified", { exact: true })).toBeVisible()
  await page.goto("/attendance/time-logs/records")
  await page
    .getByRole("button", {
      name: "View logs for Attendance staff",
      exact: true,
    })
    .click()
  await expect(
    page.getByRole("table", { name: "Attendance history" }),
  ).toBeVisible()
  await page
    .getByRole("main", { name: "Attendance workspace" })
    .getByRole("button", { name: "Employees", exact: true })
    .click()
  await page
    .getByRole("combobox", { name: "Attendance department", exact: true })
    .click()
  await page
    .getByRole("option", { name: "Attendance browser department", exact: true })
    .click()
  await expect(page.getByRole("table", { name: "Employees" })).toBeVisible()
})

test("time logs employee table preserves filters and opens individual or all logs", async ({
  page,
}) => {
  await signIn(page, "admin")
  await page.goto("/attendance/time-logs/records")
  const workspace = page.getByRole("main", { name: "Attendance workspace" })
  const table = page.getByRole("table", { name: "Employees", exact: true })
  await expect(table).toHaveAttribute("aria-busy", "false")
  await expect(
    page.getByRole("table", { name: "Attendance history" }),
  ).toHaveCount(0)
  const search = page.getByRole("searchbox", {
    name: "Search attendance employees",
  })
  await search.fill("No matching employee")
  await expect(table.getByText("No employees match your search.")).toBeVisible()
  await search.fill("BROWSER-staff")
  await expect(
    table.getByRole("button", {
      name: "View logs for Attendance staff",
      exact: true,
    }),
  ).toBeVisible()
  const individual = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      url.pathname === "/api/attendance/records" &&
      url.searchParams.get("employeeId") === fixture.actors.staff.employeeId &&
      response.status() === 200
    )
  })
  await table
    .getByRole("button", {
      name: "View logs for Attendance staff",
      exact: true,
    })
    .click()
  await individual
  await expect(
    page.getByRole("heading", {
      name: "Time Logs for Attendance staff",
      exact: true,
    }),
  ).toBeVisible()
  await expect(table).toHaveCount(0)
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await workspace
    .getByRole("button", { name: "Employees", exact: true })
    .click()
  await expect(search).toHaveValue("BROWSER-staff")
  const all = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      url.pathname === "/api/attendance/records" &&
      url.searchParams.get("employeeId") === "" &&
      response.status() === 200
    )
  })
  await page.getByRole("button", { name: "All logs", exact: true }).click()
  await all
  await expect(
    page.getByRole("heading", { name: "Time Log Records", exact: true }),
  ).toBeVisible()
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await assertNoPageOverflow(page)
    await workspace
      .getByRole("button", { name: "Employees", exact: true })
      .click()
    await expect(table).toBeVisible()
    await assertNoPageOverflow(page)
    await page.screenshot({
      path: test.info().outputPath(`time-log-employees-${width}.png`),
      fullPage: true,
    })
    const individualReload = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return (
        url.pathname === "/api/attendance/records" &&
        url.searchParams.get("employeeId") ===
          fixture.actors.staff.employeeId &&
        response.status() === 200
      )
    })
    await page
      .getByRole("button", {
        name: "View logs for Attendance staff",
        exact: true,
      })
      .click()
    await individualReload
    await expect(
      page.getByRole("table", { name: "Attendance history" }),
    ).toBeVisible()
    await assertNoPageOverflow(page)
  }
})

test("attendance employee search keeps a single pending state until results settle", async ({
  page,
}) => {
  await signIn(page, "admin")
  let releaseSearch!: () => void
  let notifySearchStarted!: () => void
  const searchStarted = new Promise<void>((resolve) => {
    notifySearchStarted = resolve
  })
  const pendingSearch = new Promise<void>((resolve) => {
    releaseSearch = resolve
  })
  await page.route("**/api/attendance/employees?**", async (route) => {
    if (
      new URL(route.request().url()).searchParams.get("search") ===
      "No matching employee"
    ) {
      notifySearchStarted()
      await pendingSearch
    }
    await route.fallback()
  })
  try {
    await page.goto("/attendance/time-logs/records")
    const table = page.getByRole("table", { name: "Employees", exact: true })
    await expect(
      table.getByRole("button", { name: "View logs for Attendance staff" }),
    ).toBeVisible()
    const search = page.getByRole("searchbox", {
      name: "Search attendance employees",
    })
    await search.fill("No matching employee")
    await searchStarted
    await expect(table).toHaveAttribute("aria-busy", "true")
    const searchSkeletons = table.getByRole("rowgroup").nth(1).getByRole("row")
    await expect(searchSkeletons).toHaveCount(10)
    for (const skeleton of await searchSkeletons.all())
      await expect(skeleton.getByRole("cell")).toHaveCount(4)
    await expect(table.getByRole("status")).toContainText("Loading employees…")
    await expect(
      table.getByRole("button", { name: "View logs for Attendance staff" }),
    ).toHaveCount(0)
    await expect(
      table.getByText("No employees match your search.", { exact: true }),
    ).toHaveCount(0)
    releaseSearch()
    await expect(table).toHaveAttribute("aria-busy", "false")
    await expect(
      table.getByText("No employees match your search.", { exact: true }),
    ).toBeVisible()
    await expect(table.getByRole("status")).toHaveCount(0)
  } finally {
    releaseSearch()
  }
})

for (const viewport of [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1440, height: 1000 },
]) {
  test(`real attendance layout at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await signIn(page, "staff")
    await page.goto("/attendance/check-ins")
    await expect(page.getByLabel("Elapsed work")).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true)
    if (viewport.width < 768) {
      await page.getByRole("button", { name: "Open navigation menu" }).click()
      await expect(
        page
          .locator("#app-sidebar")
          .getByRole("link", { name: "Check-Ins", exact: true }),
      ).toBeVisible()
      await page
        .locator("#app-sidebar")
        .getByRole("button", { name: "Close navigation menu", exact: true })
        .click()
    } else {
      const collapse = page.getByRole("button", {
        name: "Collapse sidebar",
        exact: true,
      })
      if (await collapse.isVisible()) await collapse.click()
      await page
        .getByRole("button", { name: "Attendance", exact: true })
        .click()
      await expect(
        page.getByRole("menuitem", { name: "Check-Ins", exact: true }),
      ).toBeVisible()
      await page.keyboard.press("Escape")
    }
    await page.screenshot({
      path: test.info().outputPath(`attendance-${viewport.width}.png`),
      fullPage: true,
    })
  })
}

test("Admin policy creation and assignment are live; clients remain denied", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-13T08:00:00Z"))
  await signIn(page, "admin")
  await page.goto("/attendance/policies/management")
  await page.getByRole("button", { name: "Create policy", exact: true }).click()
  await page
    .getByLabel("Policy name", { exact: true })
    .fill("Browser new policy")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create policy", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(
    page.getByRole("row").filter({ hasText: "Browser new policy" }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Assign policy to employee", exact: true })
    .click()
  await page
    .getByRole("checkbox", { name: "Select Attendance staff", exact: true })
    .check()
  await page
    .getByRole("combobox", { name: "Attendance policy", exact: true })
    .click()
  await page.getByRole("option", { name: /Browser new policy/ }).click()
  await page
    .getByRole("button", { name: "Effective from", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Monday, November 16, 2026", exact: true })
    .click()
  await page.getByRole("button", { name: "Assign policy", exact: true }).click()
  await page
    .getByRole("button", { name: "Confirm assignment", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  const clientPage = await page.context().newPage()
  await signIn(clientPage, "client")
  await routeAttendanceApi(clientPage)
  await clientPage.goto("/attendance/check-ins")
  await expect(clientPage).toHaveURL(/\/dashboard$/)
  await clientPage.close()
})

for (const viewport of [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1440, height: 1000 },
]) {
  test(`real HR policy context in workload at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.clock.setFixedTime(new Date("2026-11-13T08:00:00Z"))
    const response = await fetch(`${api}/api/workload/capacity`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${fixture.actors.head.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        employeeId: fixture.actors.staff.employeeId,
        week: "2026-11-09",
        scheduledHours: 40,
        timeOffHours: 8,
      }),
    })
    expect(response.status).toBe(200)
    await signIn(page, "head")
    await page.goto("/staff-workload")
    await expect(page.getByText("0 / 32 hrs", { exact: true })).toBeVisible()
    await page
      .getByRole("button", {
        name: "More actions for Attendance staff",
        exact: true,
      })
      .click()
    await page
      .getByRole("menuitem", { name: "View workload", exact: true })
      .click()
    const drawer = page.getByRole("dialog")
    await expect(drawer.getByText("56 hrs/week", { exact: true })).toBeVisible()
    await expect(drawer.getByText("32 hrs", { exact: true })).toBeVisible()
    await expect(drawer.getByText("Unknown", { exact: true })).toBeVisible()
    await expect(
      drawer
        .getByLabel("Daily policy requirements", { exact: true })
        .locator("dt"),
    ).toHaveCount(7)
    await expect(drawer).toContainText(
      "Clock-in status and attendance hours do not establish task availability or productivity.",
    )
    await expect(drawer).toContainText(
      "No known timed commitments from supported sources. Free time is unconfirmed.",
    )
    await expect
      .poll(async () => {
        const bounds = await drawer.boundingBox()
        return bounds ? bounds.x + bounds.width : Infinity
      })
      .toBeLessThanOrEqual(viewport.width + 1)
    expect((await drawer.boundingBox())!.x).toBeGreaterThanOrEqual(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true)
    await page.screenshot({
      path: test.info().outputPath(`workload-hr-context-${viewport.width}.png`),
      fullPage: true,
    })
  })
}

test("loaded attendance screens follow the Department Management design", async ({
  page,
}) => {
  const approvedReason = "Approved design fixture request"
  await createApprovedCorrection(
    "2026-11-11T02:00:00.000Z",
    "2026-11-11T03:00:00.000Z",
    approvedReason,
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  await signIn(page, "admin")
  await page.goto("/departments")
  await expect(
    page
      .getByRole("table")
      .getByText("Attendance browser department", { exact: true }),
  ).toBeVisible()
  const reference = await page.locator("main h1").evaluate((heading) => ({
    size: getComputedStyle(heading).fontSize,
    weight: getComputedStyle(heading).fontWeight,
  }))
  await page.screenshot({
    path: test.info().outputPath("reference-departments.png"),
    fullPage: true,
  })
  await page.goto("/employees")
  await expect(
    page.getByRole("table").getByText("Attendance staff", { exact: true }),
  ).toBeVisible()
  await page.screenshot({
    path: test.info().outputPath("reference-employees.png"),
    fullPage: true,
  })
  for (const tab of ["overview", "my", "records", "adjustments", "settings"]) {
    await page.goto("/attendance/" + tab)
    if (tab === "overview")
      await expect(
        page.getByRole("heading", {
          name: "Personal attendance",
          exact: true,
        }),
      ).toBeVisible()
    if (tab === "my")
      await expect(page.getByLabel("Elapsed work")).toBeVisible()
    if (tab === "records")
      await expect(
        page.getByRole("table", { name: "Employees" }),
      ).toHaveAttribute("aria-busy", "false")
    if (tab === "adjustments")
      await expect(
        page
          .getByRole("table", { name: "Attendance requests" })
          .getByRole("row")
          .filter({ hasText: approvedReason })
          .getByText("Approved", { exact: true }),
      ).toBeVisible()
    if (tab === "settings")
      await expect(
        page.getByRole("row").filter({ hasText: "Browser flexible policy" }),
      ).toBeVisible()
    expect(
      await page.locator("main h1").evaluate((heading) => ({
        size: getComputedStyle(heading).fontSize,
        weight: getComputedStyle(heading).fontWeight,
      })),
    ).toEqual(reference)
    await assertNoPageOverflow(page)
    await page.screenshot({
      path: test.info().outputPath("attendance-" + tab + ".png"),
      fullPage: true,
    })
  }
})

for (const viewport of [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1440, height: 1000 },
]) {
  test(`attendance overview summary layout at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await signIn(page, "admin")
    await page.goto("/attendance/overview")
    const overview = page.locator('[aria-label="Attendance figures"]')
    await expect(overview).toHaveAttribute("aria-busy", "false")
    await expect(
      page.getByRole("heading", {
        name: "Check-in status",
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", {
        name: "Recent check-in activity",
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole("combobox", {
        name: "Attendance department",
        exact: true,
      }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("heading", {
        name: "Personal attendance",
        exact: true,
      }),
    ).toBeVisible()
    const main = page.getByRole("main", { name: "Attendance workspace" })
    await expect(main.getByText("Check-ins", { exact: true })).toBeVisible()
    await expect(main.getByText("Check-outs", { exact: true })).toBeVisible()
    await expect(
      main.getByRole("link", { name: "Open Check-Ins", exact: true }),
    ).toHaveAttribute("href", "/attendance/check-ins")
    await expect(
      main.getByText(
        /time logs|overtime|corrections|requests|polic|required hours|excess/i,
      ),
    ).toHaveCount(0)
    const refreshed = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/attendance/me/overview",
    )
    await main.getByRole("button", { name: "Refresh", exact: true }).click()
    expect((await refreshed).status()).toBe(200)
    await expect(overview).toHaveAttribute("aria-busy", "false")
    await assertNoPageOverflow(page)
    await page.screenshot({
      path: test.info().outputPath(`attendance-overview-${viewport.width}.png`),
      fullPage: true,
    })
  })
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1440, height: 1000 },
]) {
  test(
    "attendance management layout and policy panels at " +
      viewport.width +
      "px",
    async ({ page }) => {
      const date =
        viewport.width === 390
          ? "2026-11-12T02:00:00.000Z"
          : viewport.width === 820
            ? "2026-11-12T04:00:00.000Z"
            : "2026-11-12T06:00:00.000Z"
      const endDate = new Date(Date.parse(date) + 60 * 60 * 1000).toISOString()
      const approvedReason = `Approved ${viewport.width}px fixture request`
      await createApprovedCorrection(date, endDate, approvedReason)
      await page.setViewportSize(viewport)
      await signIn(page, "admin")
      for (const tab of ["records", "adjustments", "settings"]) {
        await page.goto("/attendance/" + tab)
        await expect(page.getByRole("table")).toBeVisible()
        if (tab === "records")
          await expect(
            page
              .getByRole("table")
              .getByRole("cell")
              .filter({ hasText: "Attendance staff" })
              .first(),
          ).toBeVisible()
        if (tab === "adjustments")
          await expect(
            page
              .getByRole("table", { name: "Attendance requests" })
              .getByRole("row")
              .filter({ hasText: approvedReason })
              .getByText("Approved", { exact: true }),
          ).toBeVisible()
        if (tab === "settings")
          await expect(
            page
              .getByRole("row")
              .filter({ hasText: "Browser flexible policy" }),
          ).toBeVisible()
        await assertNoPageOverflow(page)
        await page.screenshot({
          path: test.info().outputPath(tab + "-" + viewport.width + ".png"),
          fullPage: true,
        })
      }
      const policyRow = page
        .getByRole("row")
        .filter({ hasText: "Browser flexible policy" })
      await policyRow
        .getByRole("button", {
          name: "More actions for Browser flexible policy",
          exact: true,
        })
        .click()
      await page
        .getByRole("menuitem", { name: "View policy details", exact: true })
        .click()
      const detailsPanel = page.getByRole("dialog")
      await expect(
        detailsPanel.getByRole("heading", {
          name: "Browser flexible policy",
          exact: true,
        }),
      ).toBeVisible()
      await detailsPanel
        .getByRole("tab", { name: "Assigned people", exact: true })
        .click()
      await expect(
        detailsPanel.getByText("Attendance staff", { exact: true }),
      ).toBeVisible()
      await expect(
        detailsPanel.getByText("BROWSER-staff", { exact: false }),
      ).toBeVisible()
      await assertNoPageOverflow(page)
      await detailsPanel.screenshot({
        path: test.info().outputPath(`policy-people-${viewport.width}.png`),
      })
      const peopleWidth = await detailsPanel
        .getByRole("tabpanel")
        .evaluate((element) => ({
          content: element.scrollWidth,
          available: element.clientWidth,
        }))
      expect(peopleWidth.content).toBeLessThanOrEqual(peopleWidth.available + 1)
      await detailsPanel
        .getByRole("tab", { name: "Overview", exact: true })
        .click()
      await expect(
        detailsPanel.getByRole("heading", {
          name: "Policy rules",
          exact: true,
        }),
      ).toBeVisible()
      await detailsPanel
        .getByRole("button", { name: "Done", exact: true })
        .click()
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await page
        .getByRole("button", { name: "Create policy", exact: true })
        .click()
      const dialog = page.getByRole("dialog")
      await expect(
        dialog.getByRole("heading", {
          name: "Create attendance policy",
          exact: true,
        }),
      ).toBeVisible()
      await expect
        .poll(async () => {
          const bounds = await dialog.boundingBox()
          return bounds ? bounds.x + bounds.width : Infinity
        })
        .toBeLessThanOrEqual(viewport.width + 1)
      await dialog
        .getByRole("button", { name: "Create policy", exact: true })
        .click()
      await expect(
        page.getByLabel("Policy name", { exact: true }),
      ).toHaveAttribute("aria-invalid", "true")
      await dialog
        .getByLabel("Policy name", { exact: true })
        .fill("Draft policy")
      await page.screenshot({
        path: test.info().outputPath("policy-panel-" + viewport.width + ".png"),
        fullPage: true,
      })
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await page
        .getByRole("row")
        .filter({ hasText: "Browser flexible policy" })
        .getByRole("button", {
          name: "More actions for Browser flexible policy",
          exact: true,
        })
        .click()
      await page.getByRole("menuitem", { name: "Edit", exact: true }).click()
      await expect(
        page.getByRole("heading", {
          name: "Edit attendance policy",
          exact: true,
        }),
      ).toBeVisible()
      await expect(page.getByLabel("Policy name", { exact: true })).toHaveValue(
        "Browser flexible policy",
      )
      await expect(
        page.getByLabel("Attendance timezone", { exact: true }),
      ).toHaveValue("Asia/Manila")
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Cancel", exact: true })
        .click()
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await page
        .getByRole("button", { name: "Assign policy to employee", exact: true })
        .click()
      await expect(
        page
          .getByRole("dialog")
          .getByRole("button", { name: "Assign policy", exact: true }),
      ).toBeDisabled()
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Cancel", exact: true })
        .click()
      await expect(page.getByRole("dialog")).toHaveCount(0)
    },
  )
}

test("policy editing updates the existing row and archive/restore/delete reuse the directory actions", async ({
  page,
}) => {
  await signIn(page, "admin")
  await page.goto("/attendance/policies/management")
  await page.getByRole("button", { name: "Create policy", exact: true }).click()
  await page.getByLabel("Policy name", { exact: true }).fill("Lifecycle policy")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create policy", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  const original = page.getByRole("row").filter({ hasText: "Lifecycle policy" })
  const originalId = await original
    .getByRole("button", {
      name: "More actions for Lifecycle policy",
      exact: true,
    })
    .getAttribute("id")
  await original
    .getByRole("button", {
      name: "More actions for Lifecycle policy",
      exact: true,
    })
    .click()
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click()
  await expect(page.getByLabel("Policy name", { exact: true })).toHaveValue(
    "Lifecycle policy",
  )
  await page
    .getByLabel("Policy name", { exact: true })
    .fill("Updated lifecycle policy")
  await page.getByRole("checkbox", { name: "Monday", exact: true }).check()
  await page.getByLabel("Monday required hours", { exact: true }).fill("6")
  await page.getByRole("button", { name: "Save policy", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  const updated = page
    .getByRole("row")
    .filter({ hasText: "Updated lifecycle policy" })
  await expect(updated).toContainText("6 hrs/week")
  await expect(
    updated.getByRole("button", {
      name: "More actions for Updated lifecycle policy",
      exact: true,
    }),
  ).toHaveAttribute("id", originalId!)
  await expect(
    page.getByRole("button", {
      name: "More actions for Lifecycle policy",
      exact: true,
    }),
  ).toHaveCount(0)
  async function action(label: string) {
    await page
      .getByRole("button", {
        name: "More actions for Updated lifecycle policy",
        exact: true,
      })
      .click()
    await page.getByRole("menuitem", { name: label, exact: true }).click()
  }
  async function status(label: string) {
    await page
      .getByRole("group", { name: "Policy view", exact: true })
      .getByRole("button", { name: label, exact: true })
      .click()
  }
  await action("Archive")
  await page
    .getByRole("button", { name: "Archive policy", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(updated).toHaveCount(0)
  await status("Archived policies")
  await expect(updated).toBeVisible()
  await action("Restore")
  await page
    .getByRole("button", { name: "Restore policy", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(updated).toHaveCount(0)
  await status("Active policies")
  await expect(updated).toBeVisible()
  await action("Archive")
  await page
    .getByRole("button", { name: "Archive policy", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await status("Archived policies")
  await action("Delete permanently")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(updated).toHaveCount(0)
})

for (const width of [390, 820, 1440]) {
  test(
    "grouped attendance pages use live scoped data at " + width + "px",
    async ({ page }) => {
      test.setTimeout(90000)
      await page.setViewportSize({ width, height: 1000 })
      await signIn(page, "admin")
      const pages = [
        ["overview", "Attendance Overview", "/api/attendance/me/overview"],
        ["my", "Check-Ins", "/api/attendance/me/current"],
        [
          "time-logs/overview",
          "Time Logs Overview",
          "/api/attendance/overview",
        ],
        ["records", "Time Log Records", "/api/attendance/employees"],
        ["audit", "Attendance Audit Trail", "/api/attendance/audit"],
        [
          "requests/overview",
          "Requests & Approvals Overview",
          "/api/attendance/adjustments/overview",
        ],
        ["requests/overtime", "Overtime", "/api/attendance/adjustments"],
        [
          "requests/corrections",
          "Attendance Corrections",
          "/api/attendance/adjustments",
        ],
        ["policies/overview", "Policies Overview", "/api/attendance/policies"],
        ["settings", "Policy Management", "/api/attendance/policies"],
      ]
      for (const [path, title, endpoint] of pages) {
        const read = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === endpoint &&
            response.request().method() === "GET",
        )
        await page.goto("/attendance/" + path)
        expect((await read).status()).toBe(200)
        await expect(
          page.getByRole("heading", { name: title, exact: true }),
        ).toBeVisible()
        await expect(
          page.getByRole("button", { name: "Retry", exact: true }),
        ).toHaveCount(0)
        if (path === "time-logs/overview") {
          const main = page.getByRole("main", { name: "Attendance workspace" })
          for (const title of ["Recorded session status", "Coverage"])
            await expect(
              main.getByRole("heading", { name: title, exact: true }),
            ).toBeVisible()
          await expect(
            main.getByRole("link", { name: "View records", exact: true }),
          ).toHaveAttribute("href", "/attendance/time-logs/records")
          await expect(
            main.getByRole("link", { name: "Open audit trail", exact: true }),
          ).toHaveCount(0)
        }
        if (
          [
            "overview",
            "time-logs/overview",
            "requests/overview",
            "policies/overview",
          ].includes(path)
        ) {
          const kpis = page
            .getByRole("main", { name: "Attendance workspace" })
            .locator("dl[aria-busy]")
          await expect(kpis).toHaveCount(1)
          await expect(kpis).toHaveAttribute("aria-busy", "false")
          const cards = kpis.getByRole("term")
          await expect(cards).toHaveCount(4)
          const columns = await kpis.evaluate(
            (element) =>
              getComputedStyle(element).gridTemplateColumns.split(" ").length,
          )
          expect(columns).toBe(4)
        }
        await assertNoPageOverflow(page)
        if (path === "requests/overtime" || path === "requests/corrections") {
          await expect(
            page.getByRole("table", { name: "Attendance requests" }),
          ).toHaveAttribute("aria-busy", "false")
          const filtered = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === endpoint &&
              new URL(response.url()).searchParams.get("status") === "APPROVED",
          )
          await page
            .getByRole("combobox", { name: "Request status filter" })
            .click()
          await page
            .getByRole("option", { name: "Approved", exact: true })
            .click()
          const response = await filtered
          const body = (await response.json()) as {
            adjustments: { type: string; status: string }[]
          }
          expect(
            body.adjustments.every(
              (row) =>
                row.status === "APPROVED" &&
                row.type ===
                  (path.endsWith("overtime") ? "OVERTIME" : "CORRECTION"),
            ),
          ).toBe(true)
        }
        if (path === "audit") {
          await page
            .getByRole("button", { name: /View audit event/ })
            .first()
            .click()
          await expect(
            page.getByRole("heading", {
              name: "Audit event details",
              exact: true,
            }),
          ).toBeVisible()
          await expect(
            page.getByRole("heading", { name: "Change details", exact: true }),
          ).toBeVisible()
          await page.getByRole("button", { name: "Done", exact: true }).click()
          await expect(
            page.getByRole("heading", {
              name: "Audit event details",
              exact: true,
            }),
          ).toHaveCount(0)
        }
        await page.screenshot({
          path: test
            .info()
            .outputPath(path.replaceAll("/", "-") + "-" + width + ".png"),
          fullPage: true,
        })
      }
      if (width < 768)
        await page.getByRole("button", { name: "Open navigation menu" }).click()
      const menu = page.getByRole("navigation", {
        name: "Main menu",
        exact: true,
      })
      for (const name of [
        "Attendance",
        "Time Logs",
        "Requests & Approvals",
        "Policies",
      ])
        await expect(
          menu.getByRole("button", { name, exact: true }),
        ).toBeVisible()
      if (width >= 768) {
        const expand = page.getByRole("button", {
          name: "Expand sidebar",
          exact: true,
        })
        if (await expand.isVisible()) await expand.click()
      }
      await menu.getByRole("button", { name: "Time Logs", exact: true }).click()
      await expect(
        menu.getByRole("link", { name: "Time Logs Overview", exact: true }),
      ).toBeVisible()
      await menu
        .getByRole("link", { name: "Time Logs Overview", exact: true })
        .click()
      await expect(page).toHaveURL(/attendance\/time-logs\/overview$/)
      if (width < 768)
        await expect(page.locator("#app-sidebar")).toHaveAttribute(
          "data-drawer-open",
          "false",
        )
      else {
        await page
          .getByRole("button", { name: "Collapse sidebar", exact: true })
          .click()
        await page
          .getByRole("button", { name: "Policies", exact: true })
          .click()
        await expect(
          page.getByRole("menuitem", { name: "Assignments", exact: true }),
        ).toHaveCount(0)
      }
    },
  )
}

test("grouped attendance routes enforce staff and department-head boundaries", async ({
  page,
}) => {
  await signIn(page, "staff")
  for (const path of [
    "time-logs/overview",
    "records",
    "audit",
    "policies/overview",
    "settings",
  ]) {
    await page.goto("/attendance/" + path)
    await expect(page).toHaveURL(/\/module$/)
  }
  for (const [path, title] of [
    ["requests/overview", "Requests & Approvals Overview"],
    ["requests/overtime", "Overtime"],
    ["requests/corrections", "Attendance Corrections"],
  ]) {
    await page.goto("/attendance/" + path)
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("group", { name: /Request.*view/ }),
    ).toHaveCount(0)
  }
  const headPage = await page.context().newPage()
  await signIn(headPage, "head")
  await routeAttendanceApi(headPage)
  await headPage.goto("/attendance/time-logs/overview")
  await expect(
    headPage.getByRole("heading", { name: "Time Logs Overview", exact: true }),
  ).toBeVisible()
  await headPage.goto("/attendance/policies/assignments")
  await expect(headPage).toHaveURL(/\/module$/)
  await headPage.close()
})

test("time log overview preserves available figures during partial failures and retries", async ({
  page,
}) => {
  await signIn(page, "admin")
  for (const failed of ["departments", "overview"]) {
    const pattern = `**/api/attendance/${failed}*`
    await page.route(pattern, (route) =>
      route.fulfill({ status: 503, json: { error: "Summary temporarily unavailable." } }),
    )
    const available = page.waitForResponse((response) =>
      new URL(response.url()).pathname === `/api/attendance/${failed === "departments" ? "overview" : "departments"}`,
    )
    await page.goto("/attendance/time-logs/overview")
    const response = await available
    expect(response.status()).toBe(200)
    const main = page.getByRole("main", { name: "Attendance workspace" })
    const figures = main.getByLabel("Time log figures")
    await expect(figures).toHaveAttribute("aria-busy", "false")
    await expect(main.getByRole("button", {name:"Retry",exact:true})).toBeVisible()
    if (failed === "departments") {
      const data = await response.json()
      await expect(figures.locator(":scope > div").filter({has: page.getByText("Check-ins", {exact:true})}).getByRole("definition")).toHaveText(String(data.checkIns.total))
    } else {
      await expect(figures.getByRole("definition").filter({hasText:"—"})).toHaveCount(4)
      await expect(main.getByRole("combobox", {name:"Time logs department"})).toBeEnabled()
    }
    await page.unroute(pattern)
    await main.getByRole("button", {name:"Retry",exact:true}).click()
    await expect(main.getByRole("button", {name:"Retry",exact:true})).toHaveCount(0)
    await expect(figures).toHaveAttribute("aria-busy", "false")
    await expect(figures.getByRole("definition").filter({hasText:"—"})).toHaveCount(0)
    await assertNoPageOverflow(page)
  }
})

test("attendance audit search stays in sync with pagination and keeps rows during refresh", async ({
  page,
}) => {
  await signIn(page, "admin")
  const queries: string[] = []
  let releaseSearch!: () => void
  let notifySearchStarted!: () => void
  let failRetry = true
  const searchStarted = new Promise<void>((resolve) => {
    notifySearchStarted = resolve
  })
  const pendingSearch = new Promise<void>((resolve) => {
    releaseSearch = resolve
  })
  await page.route("**/api/attendance/audit?**", async (route) => {
    const url = new URL(route.request().url())
    queries.push(url.search)
    const search = url.searchParams.get("search") ?? ""
    if (search === "payroll") {
      notifySearchStarted()
      await pendingSearch
    }
    if (search === "retry" && failRetry) {
      failRetry = false
      return route.fulfill({
        status: 503,
        json: { error: "Audit temporarily unavailable." },
      })
    }
    const pageNumber = Number(url.searchParams.get("page") ?? "1")
    const events =
      search === "no-match"
        ? []
        : search
          ? [auditEvent(search === "latest" ? "latest-match" : "payroll-match")]
          : Array.from({ length: 10 }, (_, index) =>
              auditEvent(`event-${(pageNumber - 1) * 10 + index + 1}`),
            )
    return route.fulfill({
      json: {
        asOf: "2026-11-15T00:00:00.000Z",
        total: search === "no-match" ? 0 : search ? 1 : 21,
        page: pageNumber,
        pageSize: 10,
        events,
        actionCounts:
          search === "no-match"
            ? []
            : [{ action: "UPDATE", count: search ? 1 : 21 }],
      },
    })
  })
  await page.goto("/attendance/audit")
  const table = page.getByRole("table", { name: "Attendance audit events" })
  await expect(table.getByText("event-1", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Page 2", exact: true }).click()
  await expect(table.getByText("event-11", { exact: true })).toBeVisible()

  const search = page.getByRole("searchbox", { name: "Search audit events" })
  await search.fill("payroll")
  await searchStarted
  await expect(table).toHaveAttribute("aria-busy", "true")
  await expect(table.getByText("event-11", { exact: true })).toBeVisible()
  expect(queries.at(-1)).toContain("page=1")
  expect(queries.at(-1)).toContain("search=payroll")
  await search.fill("latest")
  await expect(table.getByText("latest-match", { exact: true })).toBeVisible()
  releaseSearch()
  await expect(table.getByText("latest-match", { exact: true })).toBeVisible()
  await expect(table.getByText("payroll-match", { exact: true })).toHaveCount(0)

  await search.fill("")
  await expect(table.getByText("event-1", { exact: true })).toBeVisible()
  expect(queries.at(-1)).toContain("page=1")
  expect(queries.at(-1)).not.toContain("search=")

  await search.fill("no-match")
  await expect(table.getByRole("status")).toContainText("No results for")
  await expect(table.getByRole("status")).toContainText("no-match")

  await search.fill("retry")
  await expect(table.getByRole("alert")).toContainText(
    "Audit temporarily unavailable.",
  )
  await table.getByRole("button", { name: "Try again", exact: true }).click()
  await expect(table.getByText("payroll-match", { exact: true })).toBeVisible()
})

function auditEvent(id: string) {
  return {
    id,
    entityType: "AttendanceWorkday",
    action: "UPDATE",
    reason: "",
    createdAt: "2026-11-13T08:00:00.000Z",
    actorId: "actor-1",
    actor: { fullName: "Audit Actor" },
    employee: { fullName: id },
    before: null,
    after: null,
  }
}

for (const width of [1280, 390])
  test(`attendance policy skeletons match the responsive grid and retain rows during refresh at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await signIn(page, "admin")
    const initial = requestGate()
    const refreshed = requestGate()
    let holdingRefresh = false
    await page.route("**/api/attendance/policies**", async (route) => {
      if (route.request().method() === "GET") {
        const gate = holdingRefresh ? refreshed : initial
        gate.start()
        await gate.pending
      }
      await route.fallback()
    })

    await page.goto("/attendance/settings")
    const table = page.getByRole("table", { name: "Attendance policies" })
    await initial.started
    await expect(table).toHaveAttribute("aria-busy", "true")
    const skeletonRows = table.getByRole("rowgroup").nth(1).getByRole("row")
    await expect(skeletonRows).toHaveCount(5)
    for (const row of await skeletonRows.all())
      await expect(row.getByRole("cell")).toHaveCount(5)
    await expect(table.getByRole("status")).toContainText(
      "Loading attendance policies",
    )
    await expect(
      page.getByRole("status", { name: "Loading attendance", exact: true }),
    ).toHaveCount(0)
    initial.release()

    const existingRow = table
      .getByRole("row")
      .filter({ hasText: "Browser flexible policy" })
    await expect(existingRow).toBeVisible()
    await page
      .getByRole("button", { name: "Create policy", exact: true })
      .click()
    const dialog = page.getByRole("dialog")
    await dialog
      .getByLabel("Policy name", { exact: true })
      .fill(`Skeleton refresh ${width}`)
    holdingRefresh = true
    await dialog
      .getByRole("button", { name: "Create policy", exact: true })
      .click()

    await refreshed.started
    await expect(table).toHaveAttribute("aria-busy", "true")
    await expect(existingRow).toBeVisible()
    await expect(
      table
        .getByRole("status")
        .filter({ hasText: "Loading attendance policies" }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("status", { name: "Loading attendance", exact: true }),
    ).toHaveCount(0)
    refreshed.release()
    await expect(
      table.getByRole("row").filter({ hasText: `Skeleton refresh ${width}` }),
    ).toBeVisible()

    const createdRow = table
      .getByRole("row")
      .filter({ hasText: `Skeleton refresh ${width}` })
    const search = page.getByRole("searchbox", {
      name: "Search attendance policies",
      exact: true,
    })
    await search.fill(`Skeleton refresh ${width}`)
    await expect(createdRow).toBeVisible()
    await expect(existingRow).toHaveCount(0)
    await page.clock.install()
    await search.fill("missing policy for skeleton test")
    await expect(table.getByRole("status")).toContainText(
      "Loading attendance policies",
    )
    const searchSkeletonRows = table
      .getByRole("rowgroup")
      .nth(1)
      .getByRole("row")
    await expect(searchSkeletonRows).toHaveCount(5)
    await page.clock.runFor(199)
    await page.clock.runFor(1)
    await expect(table.getByRole("status")).toContainText("No results for")
    await search.fill("")
    await page.clock.runFor(200)
    await expect(existingRow).toBeVisible()

    const policyView = page.getByRole("group", {
      name: "Policy view",
      exact: true,
    })
    await policyView
      .getByRole("button", { name: "Archived policies", exact: true })
      .click()
    await expect(createdRow).toHaveCount(0)
    await policyView
      .getByRole("button", { name: "Active policies", exact: true })
      .click()
    await expect(createdRow).toBeVisible()
  })

function requestGate() {
  let start!: () => void
  let release!: () => void
  const started = new Promise<void>((resolve) => {
    start = resolve
  })
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  return { started, pending, start, release: () => release() }
}

test("a reactivated employee can clock in after a manager reconciles a suspended shift", async ({
  page,
}) => {
  const start = Math.floor(Date.now() / 60000) * 60000 - 120 * 60000
  const actor = fixture.actors.recovery
  const punch = async (action: string, token: string, body: object) =>
    fetch(`${api}/api/attendance/me/${action}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    })
  await clock(new Date(start).toISOString())
  const opened = await punch("clock-in", actor.token, {})
  expect(opened.status).toBe(201)
  const { workday } = (await opened.json()) as {
    workday: { activeSessionId: string; workDate: string }
  }
  const sessionId = workday.activeSessionId
  await clock(new Date(start + 30 * 60000).toISOString())
  expect((await punch("breaks/start", actor.token, { sessionId })).status).toBe(
    200,
  )
  const setActive = (isActive: boolean) =>
    fetch(`${api}/api/users/${actor.userId}/status`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${fixture.actors.superadmin.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ isActive }),
    })
  expect((await setActive(false)).status).toBe(200)
  expect((await punch("clock-out", actor.token, { sessionId })).status).toBe(
    401,
  )
  expect((await setActive(true)).status).toBe(200)
  const login = await fetch(`${api}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "recovery@attendance-browser.test",
      password: "AttendanceFixture-42!",
    }),
  })
  expect(login.status).toBe(200)
  const renewed = (await login.json()) as {
    token: string
    refreshToken: string
  }
  Object.assign(actor, renewed)
  await clock(new Date().toISOString())
  await signIn(page, "recovery")
  await page.goto("/attendance/check-ins")
  await expect(
    page.getByText("Shift suspended", { exact: true }).first(),
  ).toBeVisible()
  await expect(page.getByText("Clocked out", { exact: true })).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Clock in", exact: true }),
  ).toBeDisabled()

  const path = `/api/attendance/employees/${actor.employeeId}/sessions/${sessionId}/reconcile`
  const endedAt = new Date(start + 45 * 60000).toISOString()
  const note = "Confirmed the end of the suspended shift with the employee"
  const reconcileAs = (token: string) =>
    fetch(`${api}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ endedAt, note }),
    })
  expect((await reconcileAs(renewed.token)).status).toBe(403)
  expect((await reconcileAs(fixture.actors.head.token)).status).toBe(403)

  async function openDetails(role: string) {
    const reviewer = await page.context().newPage()
    await routeAttendanceApi(reviewer)
    await signIn(reviewer, role)
    await reviewer.goto("/attendance/time-logs/records")
    await reviewer
      .getByRole("button", { name: "View logs for Attendance recovery" })
      .click()
    await reviewer
      .getByRole("button", { name: `Actions for ${workday.workDate}` })
      .click()
    await reviewer.getByRole("menuitem", { name: "View details" }).click()
    await expect(
      reviewer
        .getByRole("dialog")
        .getByText("Shift suspended", { exact: true }),
    ).toBeVisible()
    return reviewer
  }
  const head = await openDetails("head")
  await expect(
    head.getByRole("button", { name: "Reconcile shift" }),
  ).toHaveCount(0)
  await head.unrouteAll({ behavior: "wait" })
  await head.close()
  const owner = await openDetails("superadmin")
  await expect(
    owner.getByRole("button", { name: "Reconcile shift" }),
  ).toBeVisible()
  await owner.unrouteAll({ behavior: "wait" })
  await owner.close()

  const manager = await openDetails("admin")
  await manager.getByRole("button", { name: "Reconcile shift" }).click()
  const dialog = manager.getByRole("dialog", {
    name: "Reconcile suspended shift",
  })
  const end = dialog.getByLabel("Confirmed clock-out")
  await expect(end).toHaveValue("")
  const local = (instant: number) =>
    manager.evaluate((value) => {
      const date = new Date(value)
      return new Date(value - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    }, instant)
  const submit = dialog.getByRole("button", { name: "Reconcile shift" })
  await expect(submit).toBeDisabled()
  await end.fill(await local(start))
  await dialog.getByLabel("Reason").fill("    ")
  await expect(submit).toBeDisabled()
  await dialog.getByLabel("Reason").fill(note)
  const failed = manager.waitForResponse(
    (response) => new URL(response.url()).pathname === path,
  )
  await submit.click()
  expect((await failed).status()).toBe(409)
  await expect(
    dialog.getByText("Clock-out must follow the session and its breaks"),
  ).toBeVisible()
  await expect(dialog.getByLabel("Reason")).toHaveValue(note)
  await end.fill(await local(Date.parse(endedAt)))
  const gate = requestGate()
  let submissions = 0
  await manager.route(
    (url) => url.pathname === path,
    async (route) => {
      submissions++
      gate.start()
      await gate.pending
      await route.fallback()
    },
  )
  const saved = manager.waitForResponse(
    (response) => new URL(response.url()).pathname === path,
  )
  try {
    await submit.click()
    await gate.started
    await expect(
      dialog.getByRole("button", { name: "Reconciling…" }),
    ).toBeDisabled()
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled()
  } finally {
    gate.release()
  }
  expect((await saved).status()).toBe(200)
  expect(submissions).toBe(1)
  await expect(dialog).toHaveCount(0)
  const table = manager.getByRole("table", { name: "Attendance history" })
  await expect(
    table.getByRole("button", { name: `Actions for ${workday.workDate}` }),
  ).toBeVisible()
  await expect(table.getByText("Shift suspended", { exact: true })).toHaveCount(
    0,
  )
  expect((await reconcileAs(fixture.actors.admin.token)).status).toBe(409)

  const persisted = await fetch(
    `${api}/api/attendance/me/history?from=${workday.workDate}&to=${workday.workDate}`,
    {
      headers: { authorization: `Bearer ${renewed.token}` },
    },
  )
  expect(persisted.status).toBe(200)
  const { workdays } = await persisted.json()
  expect(workdays[0].sessions[0]).toMatchObject({
    id: sessionId,
    endedAt,
    breaks: [{ endedAt }],
  })
  await manager.unrouteAll({ behavior: "wait" })
  await manager.close()
  await page.bringToFront()
  await expect(
    page.getByRole("button", { name: "Clock in", exact: true }),
  ).toBeEnabled({ timeout: 10000 })
  await confirm(page, "Clock in")
  await expect(
    page.getByRole("button", { name: "Clock out", exact: true }),
  ).toBeEnabled()
})

test("Superadmin opens organization leave by direct URL and notification", async ({
  page,
}) => {
  await page.unroute("**/api/**")
  await routeAttendanceApi(page, { realNotifications: true })
  await clock("2026-11-13T20:00:00+08:00")
  const reason = "Private reason for the leave navigation fixture"
  const response = await fetch(`${api}/api/leave/requests`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${fixture.actors.staff.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      requestKey: randomUUID(),
      type: "ANNUAL",
      reason,
      startDate: "2026-11-18",
      endDate: "2026-11-18",
    }),
  })
  expect(response.status).toBe(201)
  const { request } = (await response.json()) as { request: { id: string } }
  const link = `/attendance/requests/leave?request=${request.id}`

  await signIn(page, "superadmin")
  await page.goto(link)
  const detail = page.getByRole("dialog", { name: "Leave request" })
  await expect(detail.getByText(reason, { exact: true })).toBeVisible()

  await page.goto("/attendance/requests/leave")
  await page
    .getByRole("button", { name: /^Notifications, \d+ unread$/ })
    .click()
  const notice = page
    .getByRole("menuitem", {
      name: /A leave request is awaiting review/,
    })
    .and(page.locator(`[href="${link}"]`))
  await notice.click()
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("request") === request.id,
  )
  await expect(detail.getByText(reason, { exact: true })).toBeVisible()
})

async function leaveFixtureCall(actor: string, suffix: string, body?: unknown) {
  return fetch(`${api}/api${suffix}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${fixture.actors[actor].token}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function seedLeaveReview(date: string, verify = true) {
  const result = await leaveFixtureCall("staff", "/leave/requests", {
    requestKey: randomUUID(),
    type: "ANNUAL",
    reason: `Private leave fixture for ${date}`,
    startDate: date,
    endDate: date,
  })
  expect(result.status).toBe(201)
  const { request } = (await result.json()) as { request: { id: string } }
  const path = `/leave/requests/${request.id}`
  if (!verify) return path
  const verified = await leaveFixtureCall("head", `${path}/verify`, {
    actionId: randomUUID(),
    expectedVersion: 1,
    note: "Verified by the Department Head",
  })
  expect(verified.status).toBe(200)
  return path
}

test("stale HR approval refreshes leave after Superadmin rejection", async ({
  page,
  browser,
}) => {
  const path = await seedLeaveReview("2026-12-15")
  const portal = "/attendance/requests/leave"
  const rowMenu = page.locator(`[id="leave-actions-${path.split("/").at(-1)}"]`)
  await signIn(page, "admin")
  await page.goto(portal)
  await rowMenu.click()
  await page.getByRole("menuitem", { name: "Approve request" }).click()
  const approval = page.getByRole("dialog", { name: "Approve request" })
  const note = approval.getByLabel("Decision note")
  const approve = approval.getByRole("button", { name: "Approve request" })
  await note.fill("  abc")
  await approve.click()
  await expect(
    approval.getByText("Provide a valid decision note"),
  ).toBeVisible()
  await expect(note).toHaveValue("  abc")
  await expect(note).toBeEditable()
  await note.fill("HR approval prepared earlier")

  await page.route(
    `**/api${path}/approve`,
    (route) =>
      route.fulfill({
        status: 409,
        json: { error: "Action ID has already been used" },
      }),
    { times: 1 },
  )
  await approve.click()
  await expect(
    approval.getByText("Action ID has already been used"),
  ).toBeVisible()
  await expect(note).toHaveValue("HR approval prepared earlier")
  await expect(note).toBeEditable()

  const winner = await browser.newContext()
  try {
    const supervisor = await winner.newPage()
    await routeAttendanceApi(supervisor)
    await signIn(supervisor, "superadmin")
    await supervisor.goto(`${new URL(page.url()).origin}${portal}`)
    await supervisor
      .locator(`[id="leave-actions-${path.split("/").at(-1)}"]`)
      .click()
    await supervisor.getByRole("menuitem", { name: "Reject request" }).click()
    const rejection = supervisor.getByRole("dialog", { name: "Reject request" })
    await rejection
      .getByLabel("Decision note")
      .fill("Superadmin rejected this request")
    const committed = supervisor.waitForResponse(
      (response) => new URL(response.url()).pathname === `/api${path}/reject`,
    )
    await rejection.getByRole("button", { name: "Reject request" }).click()
    expect((await committed).status()).toBe(200)
  } finally {
    await winner.close()
  }

  const conflict = page.waitForResponse(
    (response) => new URL(response.url()).pathname === `/api${path}/approve`,
  )
  await approve.click()
  expect((await conflict).status()).toBe(409)
  await expect(
    page.getByText("Leave request changed; refresh and try again", {
      exact: true,
    }),
  ).toBeVisible()
  const detail = page.getByRole("dialog", { name: "Leave request" })
  await expect(detail.getByText("Rejected", { exact: true })).toBeVisible()
  await expect(
    detail.getByText("Superadmin rejected this request"),
  ).toBeVisible()
  await expect(
    detail.getByRole("button", { name: "Approve request" }),
  ).toHaveCount(0)
  await detail.getByRole("button", { name: "Close leave request" }).click()
  await expect(page.getByRole("row").filter({ has: rowMenu })).toContainText(
    "Rejected",
  )
  await rowMenu.click()
  await expect(
    page.getByRole("menuitem", { name: "Approve request" }),
  ).toHaveCount(0)
  await page.getByRole("menuitem", { name: "View details" }).click()
  await expect(detail.getByText("Rejected", { exact: true })).toBeVisible()

  const saved = await leaveFixtureCall("admin", path)
  const { request } = (await saved.json()) as {
    request: { decisions: { action: string }[] }
  }
  expect(request.decisions.map(({ action }) => action)).toEqual([
    "SUBMITTED",
    "VERIFIED",
    "REJECTED",
  ])
  const inbox = await leaveFixtureCall(
    "staff",
    "/request-workflows/notifications",
  )
  const { notifications } = (await inbox.json()) as {
    notifications: { leaveRequestId: string; type: string }[]
  }
  expect(
    notifications
      .filter(({ leaveRequestId }) => path.endsWith(`/${leaveRequestId}`))
      .map(({ type }) => type)
      .sort(),
  ).toEqual(["LEAVE_REJECTED", "LEAVE_VERIFIED"])
})

test("stale leave refresh clears details when Head access is revoked", async ({
  page,
}) => {
  const path = await seedLeaveReview("2026-12-16", false)
  const authorized = await leaveFixtureCall("head", path)
  expect(authorized.status).toBe(200)
  const { request } = (await authorized.json()) as {
    request: { employee: { departmentId: string }; reason: string }
  }
  await signIn(page, "head")
  await page.goto("/attendance/requests/leave")
  const rowMenu = page.locator(`[id="leave-actions-${path.split("/").at(-1)}"]`)
  await rowMenu.click()
  await page.getByRole("menuitem", { name: "Verify request" }).click()
  const panel = page.getByRole("dialog", { name: "Verify request" })
  await expect(panel.getByText(request.reason)).toBeVisible()
  await panel.getByLabel("Decision note").fill("Verification prepared earlier")

  const rejected = await leaveFixtureCall("superadmin", `${path}/reject`, {
    actionId: randomUUID(),
    expectedVersion: 1,
    note: "Superadmin rejected before verification",
  })
  expect(rejected.status).toBe(200)
  await page.route(
    `**/api${path}`,
    async (route) => {
      const response = await fetch(
        `${api}/api/departments/${request.employee.departmentId}`,
        {
          method: "PUT",
          headers: {
            authorization: `Bearer ${fixture.actors.admin.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ headId: null }),
        },
      )
      expect(response.status).toBe(200)
      await route.fallback()
    },
    { times: 1 },
  )
  const detail = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === `/api${path}`,
  )
  await panel.getByRole("button", { name: "Verify request" }).click()
  expect((await detail).status()).toBe(404)
  await expect(
    page.getByText("Leave request changed; refresh and try again", {
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByText(request.reason)).toHaveCount(0)
  await expect(rowMenu).toHaveCount(0)
})
