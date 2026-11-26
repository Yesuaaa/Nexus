import { expect, test, type Page, type Route } from "@playwright/test"
import type {
  AttendanceEmployee,
  AttendanceWorkday,
} from "../src/features/attendance/api/attendance-api"
import {
  accountFor,
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"

configureRegressionTest()
test.skip(live, "PG-015 uses isolated browser fixtures")

const path = "/attendance/time-logs/records"
const root = "/api/attendance/"
const departments = [
  { id: "design", name: "Design" },
  { id: "operations", name: "Operations" },
]
const search = (page: Page) =>
  page.getByRole("searchbox", { name: "Search attendance employees" })
const selector = (page: Page) =>
  page.getByRole("combobox", { name: "Attendance department" })
const directory = (page: Page) => page.getByRole("table", { name: "Employees" })
const history = (page: Page) =>
  page.getByRole("table", { name: "Attendance history" })
const fields = (page: Page) =>
  [
    page.getByLabel("Attendance from date"),
    page.getByLabel("Attendance through date"),
  ] as const
const pager = (page: Page) =>
  page.getByRole("navigation", { name: "Attendance pages" })
const next = (page: Page) => pager(page).getByRole("button", { name: /next/i })
const exportButton = (page: Page) =>
  page.getByRole("button", { name: "Export", exact: true })
const workDate = "2026-11-13"
const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "Reconcile suspended shift" })
const reason = (page: Page) => dialog(page).getByLabel(/Reason/)
const submit = (page: Page) =>
  dialog(page).getByRole("button", { name: "Reconcile shift", exact: true })
const postPattern = "**/api/attendance/employees/*/sessions/*/reconcile"

function gate() {
  let release: () => void = () => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

function employee(
  fullName: string,
  id = "worker",
  departmentId: string | null = "design",
): AttendanceEmployee {
  return { fullName, id, employeeId: "CODE-" + id, departmentId }
}

function day(
  name: string,
  overrides: Partial<AttendanceWorkday> = {},
): AttendanceWorkday {
  return {
    id: "workday",
    employeeId: "worker",
    employee: { ...employee(name), department: { name: "Design" } },
    workDate,
    timeZone: "UTC",
    isWorkingDay: true,
    requiredMinutes: 480,
    workedMilliseconds: 3_600_000,
    workedHours: 1,
    remainingMinutes: 420,
    excessMinutes: 0,
    excessRequiresReview: false,
    pendingCorrections: 0,
    progressPercent: 12.5,
    status: "INCOMPLETE",
    isComplete: false,
    activeSessionId: "shift",
    activeBreakId: null,
    sessions: [
      {
        id: "shift",
        startedAt: workDate + "T09:00:00Z",
        endedAt: null,
        suspendedAt: workDate + "T10:00:00Z",
        breaks: [],
      },
    ],
    policy: {
      id: "policy",
      name: "Flexible fixture",
      unpaidBreaksEnabled: true,
      overnightRequiresReview: false,
    },
    overnightRequiresReview: false,
    canReconcile: true,
    ...overrides,
  }
}

function query(route: Route) {
  return new URL(route.request().url()).searchParams
}

function list(
  route: Route,
  employees: AttendanceEmployee[],
  total = employees.length,
) {
  return route.fulfill({
    json: {
      employees,
      total,
      page: Number(query(route).get("page")),
      pageSize: 10,
    },
  })
}

function records(
  route: Route,
  workdays: AttendanceWorkday[],
  total = workdays.length,
) {
  return route.fulfill({
    json: {
      workdays,
      total,
      page: Number(query(route).get("page")),
      pageSize: 10,
      asOf: "2026-11-14T12:00:00Z",
    },
  })
}

function request(
  page: Page,
  endpoint: string,
  predicate: (params: URLSearchParams) => boolean = () => true,
) {
  return page.waitForRequest((request) => {
    const url = new URL(request.url())
    return (
      request.method() === "GET" &&
      url.pathname === root + endpoint &&
      predicate(url.searchParams)
    )
  })
}

async function setup(page: Page) {
  await page.clock.setFixedTime(new Date("2026-11-24T01:00:00Z"))
  await restoreSession(page, "ADMIN")
  await page.route("**" + root + "departments", (route) =>
    route.fulfill({ json: { departments } }),
  )
  await page.route("**" + root + "employees?**", (route) =>
    list(route, [employee("Fixture Worker")]),
  )
  await page.route("**" + root + "records?**", (route) =>
    records(route, [day("Fixture Worker")]),
  )
  await page.route("**" + root + "overview?**", (route) =>
    route.fulfill({
      json: {
        recordedDays: 0,
        approvedLeaveDays: 0,
        checkIns: { employees: 0, total: 0 },
      },
    }),
  )
}

async function choose(page: Page, name: string) {
  await selector(page).click()
  await page.getByRole("option", { name, exact: true }).click()
}

async function showLogs(page: Page) {
  await page.getByRole("button", { name: "All logs", exact: true }).click()
  await expect(history(page)).toHaveAttribute("aria-busy", "false")
}

function actions(page: Page, date = workDate) {
  return history(page).getByRole("button", {
    name: "Actions for " + date,
    exact: true,
  })
}

async function details(page: Page, date = workDate) {
  await actions(page, date).click()
  await page.getByRole("menuitem", { name: "View details" }).click()
  return page
    .getByRole("dialog")
    .filter({ hasText: "Attendance details for " + date })
}

async function reconcile(page: Page) {
  await (
    await details(page)
  )
    .getByRole("button", { name: "Reconcile shift", exact: true })
    .click()
  await expect(dialog(page)).toBeVisible()
}

async function validInputs(page: Page) {
  await dialog(page)
    .getByLabel("Confirmed clock-out", { exact: true })
    .fill(workDate + "T12:00")
  await reason(page).fill("Verified fixture clock-out")
}

test("[PG-015-F001-A001-T003] account bootstrap gates direct records access", async ({
  browser,
  baseURL,
}) => {
  for (const scenario of [
    { role: null, target: "/login", active: false },
    { role: "USER", target: "/dashboard", active: true },
    { role: "STAFF", target: "/module", active: true },
    { role: "ADMIN", target: "/module", active: false },
  ] as const) {
    const context = await browser.newContext({ baseURL })
    const page = await context.newPage()
    const pending = gate()
    const reads: string[] = []
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith(root))
        reads.push(request.url())
    })
    try {
      if (scenario.role) {
        const role = scenario.role
        await restoreSession(page, role)
        await page.route("**/api/auth/me", async (route) => {
          await pending.promise
          await route.fulfill({
            json: { user: accountFor(role, { isActive: scenario.active }) },
          })
        })
      }
      await page.goto(path)
      if (scenario.role)
        await expect(
          page.getByText("Loading your account…", { exact: true }),
        ).toBeVisible()
      expect(reads).toEqual([])
      pending.release()
      await expect(page).toHaveURL(new RegExp(scenario.target + "$"))
      expect(reads).toEqual([])
    } finally {
      pending.release()
      await context.close()
    }
  }
})

test("[PG-015-F001-A002-T001] initial directory and department loads settle independently", async ({
  page,
}) => {
  await setup(page)
  const releaseDirectory = gate()
  const releaseDepartments = gate()
  const reportReads: string[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === root + "records")
      reportReads.push(request.url())
  })
  await page.route("**" + root + "employees?**", async (route) => {
    await releaseDirectory.promise
    await list(route, [employee("Fixture Worker")])
  })
  await page.route("**" + root + "departments", async (route) => {
    await releaseDepartments.promise
    await route.fulfill({ json: { departments } })
  })
  const directoryRead = request(page, "employees")
  const departmentsRead = request(page, "departments")
  try {
    await page.goto(path)
    const [initial] = await Promise.all([directoryRead, departmentsRead])
    expect(Object.fromEntries(new URL(initial.url()).searchParams)).toEqual({
      search: "",
      page: "1",
      departmentId: "",
    })
    await expect(search(page)).toHaveValue("")
    await expect(selector(page)).toBeDisabled()
    await expect(directory(page)).toHaveAttribute("aria-busy", "true")
    releaseDirectory.release()
    await expect(directory(page).getByText("Fixture Worker")).toBeVisible()
    await expect(selector(page)).toBeDisabled()
    releaseDepartments.release()
    await expect(selector(page)).toHaveText("All permitted departments")
    await expect(selector(page)).toBeEnabled()
    expect(reportReads).toEqual([])
  } finally {
    releaseDirectory.release()
    releaseDepartments.release()
  }
})

test("[PG-015-F001-A003-T003] debounced searches reset page and ignore stale results", async ({
  page,
}) => {
  await setup(page)
  const first = gate()
  const finished = gate()
  await page.route("**" + root + "employees?**", async (route) => {
    const params = query(route)
    // Match the real directory endpoint, which trims after receiving the query.
    switch (params.get("search")?.trim()) {
      case "stale":
        await first.promise
        try {
          await list(route, [employee("Stale row")])
        } finally {
          finished.release()
        }
        return
      case "MiXeD":
        await list(route, [employee("Current row")])
        return
      default:
        await list(route, [employee("Page " + params.get("page"))], 21)
    }
  })
  try {
    await page.goto(path)
    await next(page).click()
    await expect(directory(page).getByText("Page 2")).toBeVisible()
    const obsolete = request(
      page,
      "employees",
      (p) => p.get("search") === "stale",
    )
    await search(page).fill("stale")
    await obsolete
    const latest = request(
      page,
      "employees",
      (p) => p.get("search")?.trim() === "MiXeD",
    )
    await search(page).fill("  MiXeD  ")
    const params = new URL((await latest).url()).searchParams
    expect(params.get("search")).toBe("  MiXeD  ")
    expect(params.get("page")).toBe("1")
    await expect(directory(page).getByText("Current row")).toHaveCount(1)
    first.release()
    await finished.promise
    await expect(directory(page).getByText("Stale row")).toHaveCount(0)
    const cleared = request(page, "employees", (p) => p.get("search") === "")
    await search(page).clear()
    expect(new URL((await cleared).url()).searchParams.get("page")).toBe("1")
    await expect(directory(page).getByText("Page 1")).toBeVisible()
  } finally {
    first.release()
  }
})

test("[PG-015-F001-A004-T002] department changes reset each pager and distinguish missing labels", async ({
  page,
}) => {
  await setup(page)
  await page.route("**" + root + "employees?**", (route) =>
    list(
      route,
      [
        employee("No placement", "none", null),
        employee("Unknown placement", "unknown", "missing"),
      ],
      21,
    ),
  )
  await page.route("**" + root + "records?**", (route) =>
    records(route, [day("Current " + query(route).get("page"))], 21),
  )
  await page.goto(path)
  await expect(
    directory(page).getByText("Unassigned", { exact: true }),
  ).toBeVisible()
  await expect(
    directory(page).getByText("Department unavailable", { exact: true }),
  ).toBeVisible()
  await choose(page, "Design")
  const pageTwo = request(page, "employees", (p) => p.get("page") === "2")
  await next(page).click()
  await pageTwo
  const selected = request(
    page,
    "employees",
    (p) => p.get("departmentId") === "operations",
  )
  await choose(page, "Operations")
  expect(new URL((await selected).url()).searchParams.get("page")).toBe("1")
  await showLogs(page)
  await next(page).click()
  await expect(history(page).getByText("Current 2")).toBeVisible()
  const cleared = request(page, "records", (p) => p.get("departmentId") === "")
  await choose(page, "All permitted departments")
  expect(new URL((await cleared).url()).searchParams.get("page")).toBe("1")
  await expect(history(page).getByText("Current 1")).toBeVisible()
})

test("[PG-015-F001-A005-T001] directory clamps after a formerly valid page shrinks", async ({
  page,
}) => {
  await setup(page)
  const requested: number[] = []
  let shrunk = false
  await page.route("**" + root + "employees?**", (route) => {
    const pageNumber = Number(query(route).get("page"))
    requested.push(pageNumber)
    if (pageNumber === 3) shrunk = true
    return list(
      route,
      pageNumber === 3 ? [] : [employee("Page " + pageNumber)],
      shrunk ? 11 : 21,
    )
  })
  await page.goto(path)
  await expect(directory(page).getByText("Page 1")).toBeVisible()
  await next(page).click()
  await expect(directory(page).getByText("Page 2")).toBeVisible()
  await next(page).click()
  await expect(
    page.getByText("Showing 11–11 of 11", { exact: true }),
  ).toBeVisible()
  await expect(next(page)).toBeDisabled()
  expect(requested).toEqual([1, 2, 3, 2])
})

test("[PG-015-F001-A007-T002] date changes reset records page and blanks suppress reads", async ({
  page,
}) => {
  await setup(page)
  const reads: string[] = []
  await page.route("**" + root + "records?**", (route) => {
    reads.push(route.request().url())
    return records(route, [day("Current " + query(route).get("page"))], 21)
  })
  await page.goto(path)
  await showLogs(page)
  const [from, through] = fields(page)
  await from.fill("2026-11-10")
  await through.fill("2026-11-13")
  await next(page).click()
  await expect(history(page).getByText("Current 2")).toBeVisible()
  const reset = request(page, "records", (p) => p.get("to") === "2026-11-12")
  await through.fill("2026-11-12")
  expect(new URL((await reset).url()).searchParams.get("page")).toBe("1")
  await expect(from).toHaveAttribute("max", "2026-11-12")
  await expect(through).toHaveAttribute("min", "2026-11-10")
  for (const [input, value] of [
    [from, "2026-11-10"],
    [through, "2026-11-12"],
  ] as const) {
    await expect(history(page)).toHaveAttribute("aria-busy", "false")
    const count = reads.length
    await input.fill("")
    await expect(input).toHaveValue("")
    await expect(history(page)).toHaveAttribute("aria-busy", "false")
    const resumed = request(page, "records")
    await input.fill(value)
    expect(
      Object.fromEntries(new URL((await resumed).url()).searchParams),
    ).toMatchObject({ from: "2026-11-10", to: "2026-11-12", page: "1" })
    await expect(history(page)).toHaveAttribute("aria-busy", "false")
    expect(reads).toHaveLength(count + 1)
  }
})

test("[PG-015-F001-A008-T002] report pagination yields a final row and an empty date range", async ({
  page,
}) => {
  await setup(page)
  await page.route("**" + root + "records?**", (route) => {
    const params = query(route)
    if (params.get("from") === "2026-11-22") return records(route, [])
    const pageTwo = params.get("page") === "2"
    return records(
      route,
      pageTwo
        ? [day("Eleventh row")]
        : Array.from({ length: 10 }, (_, index) =>
            day("Record " + index, { id: "row-" + index }),
          ),
      11,
    )
  })
  await page.goto(path)
  await showLogs(page)
  const second = request(page, "records", (p) => p.get("page") === "2")
  await next(page).click()
  await second
  await expect(history(page).getByText("Eleventh row")).toBeVisible()
  await expect(
    page.getByText("Showing 11–11 of 11", { exact: true }),
  ).toBeVisible()
  await expect(next(page)).toBeDisabled()
  await fields(page)[0].fill("2026-11-22")
  await expect(
    history(page).getByText(
      "No attendance records or approved leave in this date range.",
    ),
  ).toBeVisible()
  await expect(exportButton(page)).toBeDisabled()
})

test("[PG-015-F001-A009-T001] each failed resource retries only its own query", async ({
  page,
}) => {
  await setup(page)
  const fail = (route: Route) =>
    route.fulfill({
      status: 503,
      json: { error: "PG-015 temporary fixture error" },
    })
  const network = (route: Route) => route.abort("failed")
  for (const [endpoint, handler] of [
    ["departments", fail],
    ["employees", network],
    ["records", fail],
  ] as const) {
    const pattern =
      "**" + root + endpoint + (endpoint === "departments" ? "" : "?**")
    await page.route(pattern, handler)
    await page.goto(path)
    if (endpoint === "departments")
      await expect(directory(page).getByText("Fixture Worker")).toBeVisible()
    if (endpoint === "employees") await expect(selector(page)).toBeEnabled()
    if (endpoint === "records") await showLogs(page)
    const retry = (
      endpoint === "records"
        ? history(page)
        : endpoint === "employees"
          ? directory(page)
          : page
    ).getByRole("button", { name: /retry|try again/i })
    await expect(retry).toBeVisible()
    if (endpoint === "records") await expect(exportButton(page)).toBeDisabled()
    await page.unroute(pattern, handler)
    const paths: string[] = []
    const track = (request: import("@playwright/test").Request) => {
      const url = new URL(request.url())
      if (url.pathname.startsWith(root)) paths.push(url.pathname)
    }
    page.on("request", track)
    const awaited = request(page, endpoint)
    await retry.click()
    const current = new URL((await awaited).url()).searchParams
    if (endpoint !== "departments") expect(current.get("page")).toBe("1")
    if (endpoint === "records") expect(current.get("from")).toBe("2026-10-25")
    await expect(retry).toHaveCount(0)
    page.off("request", track)
    expect(paths).toEqual([root + endpoint])
  }
})

test("[PG-015-F001-A009-T002] stale records and errors cannot replace a newer scope or revisit", async ({
  page,
}) => {
  await setup(page)
  for (const { status, revisit } of [
    { status: 200, revisit: false },
    { status: 503, revisit: false },
    { status: 200, revisit: true },
  ]) {
    const pending = gate()
    const finished = gate()
    const handler = async (route: Route) => {
      const department = query(route).get("departmentId")
      if (department !== "design") {
        await records(route, [
          day(
            department === "operations"
              ? "Current Operations"
              : "Fresh organization",
          ),
        ])
        return
      }
      await pending.promise
      try {
        if (status === 200) await records(route, [day("Obsolete Design")])
        else await route.fulfill({ status, json: { error: "Obsolete error" } })
      } finally {
        finished.release()
      }
    }
    await page.route("**" + root + "records?**", handler)
    try {
      await page.goto(path)
      await page.getByRole("button", { name: "All logs", exact: true }).click()
      const old = request(
        page,
        "records",
        (p) => p.get("departmentId") === "design",
      )
      await choose(page, "Design")
      await old
      await expect(exportButton(page)).toBeDisabled()
      await choose(page, "Operations")
      await expect(history(page).getByText("Current Operations")).toBeVisible()
      if (revisit) {
        await page.goto("/attendance/time-logs/overview")
        await page.goto(path)
        await showLogs(page)
        await expect(
          history(page).getByText("Fresh organization"),
        ).toBeVisible()
      }
      pending.release()
      await finished.promise
      await expect(
        history(page).getByText(
          revisit ? "Fresh organization" : "Current Operations",
        ),
      ).toBeVisible()
      await expect(history(page).getByText(/Obsolete/)).toHaveCount(0)
      await expect(exportButton(page)).toBeEnabled()
    } finally {
      pending.release()
      await page.unroute("**" + root + "records?**", handler)
    }
  }
})

test("[PG-015-F001-A010-T002] keyboard history actions open details and restore focus", async ({
  page,
}) => {
  await setup(page)
  for (const width of [390, 820, 1440]) {
    await test.step(width + " CSS pixels", async () => {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto(path)
      await showLogs(page)
      const trigger = page.locator("#attendance-history-actions-workday")
      await trigger.focus()
      await page.keyboard.press("Shift+Tab")
      await page.keyboard.press("Tab")
      await expect(trigger).toBeFocused()
      await page.keyboard.press(width === 820 ? "Space" : "Enter")
      await expect(trigger).toHaveAttribute("aria-expanded", "true")
      const item = page.getByRole("menuitem", { name: "View details" })
      await expect
        .soft(item, "reachable menuitem at " + width)
        .toBeVisible({ timeout: 1500 })
      const panel = page.getByRole("dialog", { name: "Fixture Worker" })
      if (await item.isVisible()) {
        await page.keyboard.press("ArrowDown")
        await expect.soft(item).toBeFocused({ timeout: 1500 })
        await page.keyboard.press("Enter")
        await expect.soft(panel).toBeVisible({ timeout: 1500 })
      }
      if (await panel.isVisible()) {
        await page.keyboard.press("Escape")
        await expect.soft(trigger).toBeFocused()
      } else {
        await page.keyboard.press("Escape")
      }
      await expect(await details(page)).toBeVisible()
      await panel
        .getByRole("button", { name: "Close attendance details" })
        .click()
    })
  }
})

test("[PG-015-F001-A010-T003] details show overnight, correction, schedule and approved-leave variants", async ({
  page,
}) => {
  await setup(page)
  const leaveDate = "2026-11-12"
  await page.route("**" + root + "records?**", (route) =>
    records(route, [
      day("Night Worker", {
        pendingCorrections: 1,
        timeZone: "Asia/Manila",
        sessions: [
          {
            id: "closed",
            startedAt: "2026-11-13T12:00:00Z",
            endedAt: "2026-11-13T20:00:00Z",
            breaks: [
              {
                id: "pause",
                startedAt: "2026-11-13T16:00:00Z",
                endedAt: "2026-11-13T16:15:00Z",
                isPaid: false,
              },
            ],
          },
        ],
        schedule: {
          startsAt: "2026-11-13T12:00:00Z",
          endsAt: "2026-11-13T20:00:00Z",
          unpaidBreakMinutes: 15,
          lateArrivalMinutes: 0,
          earlyDepartureMinutes: 0,
        },
      }),
      day("Leave Worker", {
        id: null,
        workDate: leaveDate,
        approvedLeaveMinutes: 480,
        status: "NOT_REQUIRED",
        requiredMinutes: 0,
        sessions: [],
        canReconcile: false,
      }),
    ]),
  )
  await page.goto(path)
  await showLogs(page)
  const night = await details(page)
  for (const label of [
    "Overnight",
    "1 pending",
    "Scheduled start",
    "Scheduled end",
    "Asia/Manila",
  ]) {
    await expect(night.getByText(label, { exact: true }).first()).toBeVisible()
  }
  await expect(night.getByText(/Unpaid break:.*12:00 AM/)).toBeVisible()
  await expect(
    night.getByRole("button", { name: "Request correction" }),
  ).toHaveCount(0)
  await night.getByRole("button", { name: "Close attendance details" }).click()
  const leave = await details(page, leaveDate)
  await expect(
    leave.getByText("Approved leave", { exact: true }).first(),
  ).toBeVisible()
  await expect(
    leave.getByRole("button", { name: "Reconcile shift" }),
  ).toHaveCount(0)
})

test("[PG-015-F001-A011-T002] CSV exports only the current page with correct escaping", async ({
  page,
}) => {
  await setup(page)
  const row = day('=Éva, "Night"', {
    employee: {
      ...employee('=Éva, "Night"'),
      department: { name: 'Design, "A"' },
    },
  })
  await page.route("**" + root + "records?**", (route) =>
    records(
      route,
      query(route).get("page") === "2" ? [row] : [day("Previous page")],
      11,
    ),
  )
  await page.goto(path)
  await showLogs(page)
  await next(page).click()
  await expect(history(page).getByText('=Éva, "Night"')).toBeVisible()
  const traffic: string[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith(root))
      traffic.push(request.url())
  })
  const downloadEvent = page.waitForEvent("download")
  await exportButton(page).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe(
    "attendance-2026-10-25-2026-11-25-page-2.csv",
  )
  const chunks: Buffer[] = []
  for await (const part of await download.createReadStream())
    chunks.push(Buffer.from(part))
  const csv = Buffer.concat(chunks).toString("utf8")
  const header =
    '"Workday","Employee","Department","Timezone","Clock in timestamps","Clock out timestamps","Worked hours","Required hours","Review excess","Approved leave hours","Suspension timestamps","Session statuses"'
  const record =
    '"2026-11-13","\'=Éva, ""Night""","Design, ""A""","UTC","2026-11-13T09:00:00Z","","1","8","false","0","2026-11-13T10:00:00Z","Suspended"'
  expect(csv).toBe(header + "\r\n" + record)
  expect(traffic).toEqual([])
})

test("[PG-015-F001-A013-T003] reconciliation trims note limits and rejects device zone change", async ({
  page,
  context,
}) => {
  const cdp = await context.newCDPSession(page)
  await cdp.send("Emulation.setTimezoneOverride", { timezoneId: "UTC" })
  await setup(page)
  const posts: unknown[] = []
  await page.route(postPattern, (route) => {
    posts.push(route.request().postDataJSON())
    return route.fulfill({
      status: 503,
      json: { error: "Retain form fixture" },
    })
  })
  await page.goto(path)
  await showLogs(page)
  await reconcile(page)
  await validInputs(page)
  await reason(page).fill(" 1234 ")
  await expect(submit(page)).toBeDisabled()
  await reason(page).fill("")
  await reason(page).press("End")
  await page.keyboard.insertText("x".repeat(2001))
  await expect(reason(page)).toHaveValue("x".repeat(2000))
  await expect(submit(page)).toBeEnabled()
  await reason(page).fill(" 12345 ")
  await submit(page).click()
  await expect(dialog(page).getByRole("alert")).toHaveText(
    "Retain form fixture",
  )
  expect(posts).toEqual([
    { endedAt: workDate + "T12:00:00.000Z", note: "12345" },
  ])
  try {
    await cdp.send("Emulation.setTimezoneOverride", {
      timezoneId: "America/Los_Angeles",
    })
    await submit(page).click()
    await expect(dialog(page).getByRole("alert")).toContainText(
      "Your device timezone changed",
    )
    expect(posts).toHaveLength(1)
  } finally {
    await cdp.detach()
  }
})

test("[PG-015-F001-A014-T002] idle dismissal is safe and pending close paths stay fenced", async ({
  page,
}) => {
  await setup(page)
  const pending = gate()
  let posts = 0
  await page.route(postPattern, async (route) => {
    posts++
    if (posts === 1) {
      await pending.promise
      await route.fulfill({
        status: 503,
        json: { error: "Temporary reconciliation error" },
      })
    } else {
      await route.fulfill({ json: { closed: true } })
    }
  })
  await page.goto(path)
  await showLogs(page)
  await reconcile(page)
  await dialog(page)
    .getByRole("button", { name: "Cancel", exact: true })
    .click()
  await expect(dialog(page)).toHaveCount(0)
  await reconcile(page)
  await page.keyboard.press("Escape")
  await expect(dialog(page)).toHaveCount(0)
  expect(posts).toBe(0)
  await reconcile(page)
  await validInputs(page)
  try {
    await submit(page).click()
    await expect(
      dialog(page).getByRole("button", { name: "Reconciling…" }),
    ).toBeDisabled()
    await page.keyboard.press("Escape")
    await page.mouse.click(3, 3)
    await dialog(page)
      .getByRole("button", { name: "Close", exact: true })
      .click()
    await expect(dialog(page)).toBeVisible()
    expect(posts).toBe(1)
    pending.release()
    await expect(dialog(page).getByRole("alert")).toHaveText(
      "Temporary reconciliation error",
    )
    await expect(reason(page)).toHaveValue("Verified fixture clock-out")
    const refreshed = request(page, "records")
    await submit(page).click()
    await refreshed
    await expect(dialog(page)).toHaveCount(0)
    await expect(
      page.getByText("Shift reconciled", { exact: true }),
    ).toBeVisible()
    expect(posts).toBe(2)
  } finally {
    pending.release()
  }
})

test("[PG-015-F001-A020-T002] non-menu controls remain accessible across viewport sizes", async ({
  page,
}) => {
  await setup(page)
  const name = "Long department worker " + "Long name ".repeat(14)
  await page.route("**" + root + "employees?**", (route) =>
    list(route, [employee(name)], 11),
  )
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(path)
    await search(page).focus()
    await expect(search(page)).toBeFocused()
    await selector(page).focus()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("listbox")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(selector(page)).toBeFocused()
    await next(page).focus()
    await expect(next(page)).toBeFocused()
    const eye = page.getByRole("button", {
      name: "View logs for " + name.trim(),
      exact: true,
    })
    await eye.press("Enter")
    await expect(history(page)).toBeVisible()
    const [from] = fields(page)
    await from.press("Alt+ArrowDown")
    await expect(
      page.getByRole("dialog", { name: "Choose a date" }),
    ).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(from).toBeFocused()
    await reconcile(page)
    await expect(
      dialog(page).getByLabel("Confirmed clock-out", { exact: true }),
    ).toBeEnabled()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width)
    await dialog(page)
      .getByRole("button", { name: "Cancel", exact: true })
      .click()
    await expect(dialog(page)).toHaveCount(0)
  }
})
