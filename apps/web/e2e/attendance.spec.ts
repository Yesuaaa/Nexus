import { test, expect, type Page } from "@playwright/test"
import { spawn, type ChildProcess } from "node:child_process"
import { createRequire } from "node:module"
import path from "node:path"

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
  const requireApi = createRequire(path.join(root, "apps/api/package.json"))
  server = spawn(
    process.execPath,
    [
      requireApi.resolve("tsx/cli"),
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
test.afterAll(() => {
  server?.kill()
})

async function signIn(page: Page, actor: string) {
  await page.addInitScript((session) => {
    sessionStorage.setItem("nexus.auth.token", session.token)
    sessionStorage.setItem("nexus.auth.refreshToken", session.refreshToken)
  }, fixture.actors[actor])
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
    .getByRole("link", { name: "Open People & HR workspace", exact: true })
    .click()
  await expect(page).toHaveURL(/\/attendance\/my$/)
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
  await page.goto("/attendance/my")
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
  await page.goto("/attendance/adjustments")
  await expect(page.getByText("PENDING", { exact: true })).toBeVisible()
})

test("department head reviews scoped requests and HR policy settings work", async ({
  page,
}) => {
  await signIn(page, "head")
  await page.goto("/attendance/adjustments")
  await expect(
    page.getByRole("heading", { name: "OT & Agreements", exact: true }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: /More actions for .* request/ })
    .first()
    .click()
  await page
    .getByRole("menuitem", { name: "Approve request", exact: true })
    .click()
  await page
    .getByLabel("Review note", { exact: true })
    .fill("Verified the service work with the department")
  await page
    .getByRole("button", { name: "Confirm decision", exact: true })
    .click()
  await expect(page.getByText("APPROVED", { exact: true })).toBeVisible()
  await page.goto("/attendance/records")
  await page
    .getByRole("button", {
      name: "View logs for Attendance staff",
      exact: true,
    })
    .click()
  await expect(
    page.getByRole("table", { name: "Attendance history" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Employees", exact: true }).click()
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
  await page.goto("/attendance/records")
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
  const individual = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return (
      url.pathname === "/api/attendance/records" &&
      url.searchParams.get("employeeId") === fixture.actors.staff.employeeId
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
      name: "Logs for Attendance staff",
      exact: true,
    }),
  ).toBeVisible()
  await expect(table).toHaveCount(0)
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("button", { name: "Employees", exact: true }).click()
  await expect(search).toHaveValue("BROWSER-staff")
  const all = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return (
      url.pathname === "/api/attendance/records" &&
      url.searchParams.get("employeeId") === ""
    )
  })
  await page.getByRole("button", { name: "All logs", exact: true }).click()
  await all
  await expect(
    page.getByRole("heading", { name: "All permitted employees", exact: true }),
  ).toBeVisible()
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await assertNoPageOverflow(page)
    await page.getByRole("button", { name: "Employees", exact: true }).click()
    await expect(table).toBeVisible()
    await assertNoPageOverflow(page)
    await page.screenshot({
      path: test.info().outputPath(`time-log-employees-${width}.png`),
      fullPage: true,
    })
    await page
      .getByRole("button", {
        name: "View logs for Attendance staff",
        exact: true,
      })
      .click()
    await expect(
      page.getByRole("table", { name: "Attendance history" }),
    ).toBeVisible()
    await assertNoPageOverflow(page)
  }
  await page.getByRole("button", { name: "Employees", exact: true }).click()
  await expect(search).toHaveValue("BROWSER-staff")
})

for (const viewport of [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1440, height: 1000 },
]) {
  test(`real attendance layout at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await signIn(page, "staff")
    await page.goto("/attendance/my")
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
  await page.goto("/attendance/settings")
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
  await clientPage.goto("/attendance/my")
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
          name: "Organization attendance",
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
          .getByText("APPROVED", { exact: true }),
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
    const overview = page.getByRole("region", {
      name: "Attendance overview",
      exact: true,
    })
    await expect(overview).toHaveAttribute("aria-busy", "false")
    await expect(
      page.getByRole("heading", {
        name: "Attendance requirement coverage",
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Workday status", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("combobox", {
        name: "Attendance department",
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Needs attention", exact: true }),
    ).toBeVisible()
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
            page.getByRole("table").getByText("APPROVED", { exact: true }),
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
  await page.goto("/attendance/settings")
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
