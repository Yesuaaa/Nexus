import { expect, test, type Page, type Locator } from "@playwright/test"
import type { Employee } from "../../src/features/employees/api/employees-api"
import { configureRegressionTest, restoreSession } from "../regression-support"

configureRegressionTest()

const directoryEmployee: Employee = {
  id: "pg023-directory",
  employeeId: "EXP-PG023",
  fullName: "PG023 Active Employee",
  email: "active@example.test",
  contactNumber: "09123456789",
  position: "Engineer",
  employmentType: "CONTRACT",
  status: "ON_LEAVE",
  startDate: "2026-01-15",
  departmentId: "dept-1",
  teamId: null,
  department: { id: "dept-1", name: "Engineering", code: "ENG", color: "teal" },
  team: null,
  hasAccount: true,
  accountIsActive: true,
  createdAt: "2026-01-15T00:00:00Z",
  updatedAt: "2026-01-15T00:00:00Z",
}

test("PG-023-F007-A001-T009 resets directory filters and page in both views", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  const queries: URLSearchParams[] = []
  let archiveEmpty = false
  await page.route("**/api/employees?*", async (route) => {
    const query = new URL(route.request().url()).searchParams
    queries.push(query)
    const archived = query.get("archived") === "true"
    const current = Number(query.get("page") ?? "1")
    const employees = archived
      ? archiveEmpty
        ? []
        : [
            {
              ...directoryEmployee,
              id: "pg023-archive",
              fullName: "PG023 Archived Employee",
              accountIsActive: false,
              accountDeletedAt: "2026-11-01T00:00:00Z",
            },
          ]
      : Array.from({ length: current === 1 ? 10 : 2 }, (_, index) => ({
          ...directoryEmployee,
          id: `${current}-${index}`,
          fullName: `${directoryEmployee.fullName} ${current}-${index}`,
        }))
    await route.fulfill({
      json: {
        employees,
        total: archived ? employees.length : 12,
        page: current,
        pageSize: 10,
      },
    })
  })
  await page.goto("/employees")
  const search = page.getByRole("searchbox", { name: "Search employees" })
  await search.fill("PG023")
  for (const [label, option] of [
    ["Filter by department", "Engineering"],
    ["Filter by employment type", "Contract"],
    ["Filter by employee status", "On Leave"],
  ]) {
    await page.getByRole("combobox", { name: label }).click()
    await page.getByRole("option", { name: option, exact: true }).click()
  }
  await expect.poll(() => queries.at(-1)?.get("search")).toBe("PG023")
  await page.getByRole("button", { name: "Next page" }).click()
  await expect(page.getByText("PG023 Active Employee 2-0")).toBeVisible()
  expect(Object.fromEntries(queries.at(-1) ?? [])).toMatchObject({
    page: "2",
    search: "PG023",
    departmentId: "dept-1",
    employmentType: "CONTRACT",
    status: "ON_LEAVE",
  })
  await page.getByRole("button", { name: "Archive", exact: true }).click()
  await expect(page.getByText("PG023 Archived Employee")).toBeVisible()
  await expect(search).toHaveValue("")
  const expectReset = (archived: boolean) => {
    const query = queries.at(-1)!
    expect(query.get("archived")).toBe(archived ? "true" : null)
    expect(query.get("page") ?? "1").toBe("1")
    for (const key of ["search", "departmentId", "employmentType", "status"])
      expect(query.get(key) ?? "").toBe("")
  }
  expectReset(true)
  await page
    .getByRole("group", { name: "Employee view" })
    .getByRole("button", { name: "Employees", exact: true })
    .click()
  await expect(page.getByText("PG023 Active Employee 1-0")).toBeVisible()
  await expect(page.getByText("PG023 Archived Employee")).toHaveCount(0)
  expectReset(false)
  archiveEmpty = true
  await page.getByRole("button", { name: "Archive", exact: true }).click()
  await expect(
    page.getByText("No archived accounts.", { exact: true }),
  ).toBeVisible()
})

test("PG-023-F001-A001-T001 admits only supported employee directory actors", async ({
  browser,
  baseURL,
}) => {
  for (const [role, destination] of [
    [null, "/login"],
    ["USER", "/dashboard"],
    ["STAFF", "/module"],
    ["ADMIN", "/employees"],
    ["SUPERADMIN", "/employees"],
  ] as const) {
    const context = await browser.newContext({ baseURL })
    try {
      const page = await context.newPage()
      const paths: string[] = []
      page.on("request", (request) => {
        paths.push(new URL(request.url()).pathname)
      })
      if (role) await restoreSession(page, role)
      await page.goto("/employees")
      await expect(page).toHaveURL((url) => url.pathname === destination)
      const heading = page.getByRole("heading", {
        name: "Employee Management",
      })
      if (destination === "/employees") {
        await expect(heading).toBeVisible()
        await expect.poll(() => paths.includes("/api/employees")).toBe(true)
        expect(paths.indexOf("/api/auth/me")).toBeGreaterThanOrEqual(0)
        expect(paths.indexOf("/api/auth/me")).toBeLessThan(
          paths.indexOf("/api/employees"),
        )
      } else {
        await expect(heading).toHaveCount(0)
        expect(paths).not.toContain("/api/employees")
      }
    } finally {
      await context.close()
    }
  }
})

test("PG-023-F008-A001-T010 preserves employee actions and layout across widths", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await page.goto("/employees")
  const action = page.getByRole("button", {
    name: "More actions for Alex Employee",
  })
  const row = page.getByRole("row").filter({ has: action })
  const toolbar = page
    .getByRole("searchbox", { name: "Search employees" })
    .locator("xpath=ancestor::div[contains(@class,'justify-between')][1]")

  for (const width of [390, 560, 561, 1000, 1001]) {
    await test.step(`${width} CSS pixels`, async () => {
      await page.setViewportSize({ width, height: 900 })
      await expect(row).toContainText("EMP-001")
      await expect(row).toContainText("Alex Employee")
      await expect(row).toContainText("alex.employee@example.com")
      await expect(action).toBeVisible()
      await expect
        .soft(toolbar)
        .toHaveCSS("flex-direction", width <= 560 ? "column" : "row")
      await expect
        .soft(row)
        .toHaveCSS("height", width <= 1000 ? "188px" : "58px")
      expect
        .soft(await page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width)
    })
  }
})

function gate() {
  let release!: () => void
  const wait = new Promise<void>((resolve) => {
    release = resolve
  })
  return { wait, release }
}

const listPattern = "**/api/employees?*"
const listing = (employees: Employee[]) => ({
  employees,
  total: employees.length,
  page: 1,
  pageSize: 10,
})

async function openRowAction(page: Page, name: string, action: string) {
  await page.getByRole("button", { name: "More actions for " + name }).click()
  await page.getByRole("menuitem", { name: action, exact: true }).click()
  return page.getByRole("dialog")
}

async function choose(dialog: Locator, name: string, value: string) {
  await dialog.getByRole("combobox", { name, exact: true }).click()
  await dialog.page().getByRole("option", { name: value, exact: true }).click()
}

async function fillCreate(dialog: Locator) {
  for (const [id, value] of Object.entries({
    "employee-id": "0042",
    "employee-full-name": "Jordan Reyes",
    "employee-email": "jordan@example.test",
    "employee-contact-number": "09123456789",
    "employee-position": "Engineer",
    "employee-start-date": "2026-01-15",
    "employee-password": "ValidPassword1!",
    "employee-password-confirmation": "ValidPassword1!",
  }))
    await dialog.locator("#" + id).fill(value)
  await choose(dialog, "Employment type", "Full Time")
  await choose(dialog, "Department", "Engineering")
  await choose(dialog, "Team", "No Team")
}

test("PG-023-F006-A001-T007 distinguishes pending, empty and failed employee searches", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  const pending = gate()
  let calls = 0
  await page.route(listPattern, async (route) => {
    const query = new URL(route.request().url()).searchParams.get("search")
    if (!query) return route.fulfill({ json: listing([directoryEmployee]) })
    calls++
    if (calls === 1) await pending.wait
    if (calls === 2)
      return route.fulfill({
        status: 500,
        json: { error: "Directory unavailable" },
      })
    await route.fulfill({ json: listing([]) })
  })
  await page.clock.install({ time: new Date("2026-11-27T00:00:00Z") })
  await page.goto("/employees")
  await expect(
    page.getByText(directoryEmployee.fullName, { exact: true }),
  ).toBeVisible()
  const search = page.getByRole("searchbox", { name: "Search employees" })
  await page.clock.pauseAt(new Date("2026-11-27T00:00:10Z"))
  await search.fill("missing-one")
  await page.clock.runFor(199)
  expect(calls).toBe(0)
  await page.clock.runFor(1)
  try {
    await expect.poll(() => calls).toBe(1)
    await expect(
      page.getByText(/Searching|Loading employees/).first(),
    ).toBeAttached()
  } finally {
    pending.release()
  }
  await expect(page.getByText(/No results for/).first()).toBeVisible()
  await search.fill("missing-two")
  await page.clock.runFor(200)
  await expect(page.getByText("Directory unavailable")).toBeVisible()
  await page.getByRole("button", { name: "Try again", exact: true }).click()
  await expect.poll(() => calls).toBe(3)
  await expect(page.getByText(/No results for/).first()).toBeVisible()
})

test("PG-023-F006-A002-T008 retries unavailable department and team options", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  const engineering = {
    ...directoryEmployee.department!,
    memberCount: 0,
    teamCount: 1,
  }
  const operations = {
    ...engineering,
    id: "dept-2",
    name: "Operations",
    code: "OPS",
  }
  let departmentsAvailable = false
  let teamsAvailable = false
  await page.route("**/api/departments", async (route) => {
    if (departmentsAvailable)
      return route.fulfill({ json: { departments: [engineering, operations] } })
    await route.fulfill({
      status: 500,
      json: { error: "Departments unavailable" },
    })
  })
  await page.route("**/api/departments/dept-1", async (route) => {
    if (teamsAvailable)
      return route.fulfill({
        json: {
          department: {
            ...engineering,
            members: [],
            teams: [{ id: "engineering-team", name: "Engineering Team" }],
          },
        },
      })
    await route.fulfill({ status: 500, json: { error: "Teams unavailable" } })
  })
  await page.route("**/api/departments/dept-2", (route) =>
    route.fulfill({
      json: {
        department: {
          ...operations,
          members: [],
          teams: [{ id: "operations-team", name: "Operations Team" }],
        },
      },
    }),
  )
  await page.goto("/employees")
  await expect(
    page.getByRole("combobox", { name: "Filter by department" }),
  ).toBeDisabled()
  await page.getByRole("button", { name: "Create Employee" }).click()
  const dialog = page.getByRole("dialog")
  await expect
    .soft(dialog.getByRole("combobox", { name: "Department" }))
    .toBeDisabled()
  await expect(
    dialog.getByRole("button", { name: "Add Employee" }),
  ).toBeDisabled()
  departmentsAvailable = true
  await dialog.getByRole("button", { name: "Retry departments" }).click()
  await choose(dialog, "Department", "Engineering")
  await expect(dialog.getByRole("combobox", { name: "Team" })).toBeDisabled()
  await expect(
    dialog.getByRole("button", { name: "Add Employee" }),
  ).toBeDisabled()
  teamsAvailable = true
  await dialog.getByRole("button", { name: "Retry teams" }).click()
  await choose(dialog, "Team", "Engineering Team")
  await choose(dialog, "Department", "Operations")
  const teams = dialog.getByRole("combobox", { name: "Team", exact: true })
  await expect(teams).not.toContainText("Engineering Team")
  await teams.click()
  await expect(
    page.getByRole("option", { name: "Engineering Team", exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole("option", { name: "Operations Team", exact: true })
    .click()
})

test("PG-023-F009-A001-T011 exposes employee table and loading semantics", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const pending = gate()
    await page.route(
      listPattern,
      async (route) => {
        await pending.wait
        await route.fulfill({ json: listing([directoryEmployee]) })
      },
      { times: 1 },
    )
    await page.goto("/employees")
    const table = page.getByRole("table", { name: "Employees", exact: true })
    try {
      await expect(table).toHaveAttribute("aria-busy", "true")
      await expect(
        table.getByRole("button", { name: /More actions for/ }),
      ).toHaveCount(0)
    } finally {
      pending.release()
    }
    await expect(table.getByRole("columnheader").first()).toBeAttached()
    await expect(
      table.getByRole("cell").filter({ hasText: directoryEmployee.fullName }),
    ).toBeVisible()
    await expect(
      table.getByRole("button", {
        name: "More actions for " + directoryEmployee.fullName,
      }),
    ).toBeVisible()
    await expect(page.getByText(/Showing 1.*1/)).toBeVisible()
  }
})

test("PG-023-F010-A001-T013 displays profile and recordless details as text", async ({
  page,
}) => {
  const literal = "<span data-pg023-marker>Literal position</span>"
  const profile = {
    ...directoryEmployee,
    position: literal,
    teamId: "detail-team",
    team: { id: "detail-team", name: "Detail Team" },
  }
  const account = {
    ...directoryEmployee,
    id: "account:recordless",
    fullName: "Recordless Account",
    employeeId: "",
    hasEmployeeRecord: false,
    accountIsActive: false,
    status: null,
    position: null,
  }
  await restoreSession(page, "ADMIN")
  await page.route(listPattern, (route) =>
    route.fulfill({ json: listing([profile, account as Employee]) }),
  )
  for (const row of [profile, account]) {
    await page.route(
      "**/api/employees/" + encodeURIComponent(row.id),
      (route) => route.fulfill({ json: { employee: row } }),
    )
  }
  await page.goto("/employees")
  const dialog = await openRowAction(page, profile.fullName, "View Employee")
  await expect(dialog).toHaveAccessibleName(/Employee/i)
  for (const value of [
    profile.fullName,
    profile.employeeId,
    profile.email,
    profile.contactNumber,
    literal,
    "Engineering",
    "Contract",
    "On Leave",
    "Detail Team",
  ]) {
    await expect(dialog).toContainText(value!)
  }
  await expect(dialog).toContainText(
    new Date(profile.startDate!).toLocaleDateString("en-US", {
      timeZone: "UTC",
    }),
  )
  await expect(dialog.locator("[data-pg023-marker]")).toHaveCount(0)
  await page.getByRole("button", { name: "Close employee details" }).click()
  await expect(
    page.getByRole("button", { name: "More actions for " + profile.fullName }),
  ).toBeFocused()
  await openRowAction(page, account.fullName, "View Employee")
  await expect(dialog).toContainText(account.fullName)
  await expect(dialog).not.toContainText("On Leave")
})

test("PG-023-F010-A002-T014 retries employee details and restores focus", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN", {
    initialEmployees: [
      directoryEmployee,
      {
        ...directoryEmployee,
        id: "detail-other",
        employeeId: "EXP-OTHER",
        fullName: "Other Profile",
      },
    ],
  })
  const pending = gate()
  const stale = gate()
  const staleSettled = gate()
  let calls = 0
  await page.route(
    "**/api/employees/" + directoryEmployee.id,
    async (route) => {
      if (++calls === 1) {
        await pending.wait
        return route.fulfill({
          status: 500,
          json: { error: "Details unavailable" },
        })
      }
      if (calls === 3) {
        await stale.wait
        try {
          await route.fulfill({
            json: {
              employee: { ...directoryEmployee, fullName: "Obsolete Profile" },
            },
          })
        } finally {
          staleSettled.release()
        }
        return
      }
      await route.fulfill({ json: { employee: directoryEmployee } })
    },
  )
  await page.route("**/api/employees/detail-other", (route) =>
    route.fulfill({
      json: {
        employee: {
          ...directoryEmployee,
          id: "detail-other",
          employeeId: "EXP-OTHER",
          fullName: "Other Profile",
        },
      },
    }),
  )
  await page.goto("/employees")
  const dialog = await openRowAction(
    page,
    directoryEmployee.fullName,
    "View Employee",
  )
  try {
    await expect.poll(() => calls).toBe(1)
    await expect(dialog.getByRole("status")).toContainText(
      "Loading employee details",
    )
    await expect(dialog).not.toContainText(directoryEmployee.employeeId)
  } finally {
    pending.release()
  }
  await expect(dialog.getByText("Details unavailable")).toBeVisible()
  await dialog.getByRole("button", { name: "Try again", exact: true }).click()
  await expect(dialog).toContainText(directoryEmployee.employeeId)
  expect(calls).toBe(2)
  await page.getByRole("button", { name: "Close employee details" }).click()
  await expect(
    page.getByRole("button", {
      name: "More actions for " + directoryEmployee.fullName,
    }),
  ).toBeFocused()
  await openRowAction(page, directoryEmployee.fullName, "View Employee")
  try {
    await expect.poll(() => calls).toBe(3)
    await page.getByRole("button", { name: "Close employee details" }).click()
    await openRowAction(page, "Other Profile", "View Employee")
    await expect(dialog).toContainText("EXP-OTHER")
  } finally {
    stale.release()
  }
  await staleSettled.wait
  await expect(dialog).toContainText("EXP-OTHER")
  await expect(dialog).not.toContainText("Obsolete Profile")
})

test("PG-023-F014-A002-T021 retains an edited employee draft through a conflict", async ({
  page,
}) => {
  const editable = { ...directoryEmployee, fullName: "Jordan Reyes" }
  await restoreSession(page, "ADMIN", { initialEmployees: [editable] })
  const first = { ...editable.department!, memberCount: 1, teamCount: 1 }
  const second = { ...first, id: "dept-2", name: "Operations", code: "OPS" }
  await page.route("**/api/departments", (route) =>
    route.fulfill({ json: { departments: [first, second] } }),
  )
  for (const department of [first, second]) {
    await page.route("**/api/departments/" + department.id, (route) =>
      route.fulfill({
        json: {
          department: {
            ...department,
            members: [],
            teams: [
              { id: department.id + "-team", name: department.name + " Team" },
            ],
          },
        },
      }),
    )
  }
  const bodies: Record<string, unknown>[] = []
  let saved = false
  await page.route(listPattern, (route) =>
    route.fulfill({
      json: listing([
        {
          ...editable,
          position: saved ? "Senior Engineer" : editable.position,
        },
      ]),
    }),
  )
  await page.route("**/api/employees/" + editable.id, async (route) => {
    if (route.request().method() !== "PUT") return route.fallback()
    bodies.push(route.request().postDataJSON())
    if (bodies.length === 1)
      return route.fulfill({ status: 409, json: { error: "Edit conflict" } })
    saved = true
    await route.fulfill({
      json: {
        employee: { ...editable, position: "Senior Engineer" },
      },
    })
  })
  await page.goto("/employees")
  const dialog = await openRowAction(page, editable.fullName, "Edit")
  await expect(dialog.locator("#employee-full-name")).toHaveValue(
    editable.fullName,
  )
  await expect(dialog.locator("#employee-password")).toHaveCount(0)
  await dialog.locator("#employee-position").fill("Senior Engineer")
  await choose(dialog, "Team", "Engineering Team")
  await choose(dialog, "Department", "Operations")
  await expect(
    dialog.getByRole("combobox", { name: "Team" }),
  ).not.toContainText("Engineering Team")
  await choose(dialog, "Team", "No Team")
  const save = dialog.getByRole("button", { name: "Save Employee" })
  await save.click()
  await expect(dialog.getByText("Edit conflict")).toBeVisible()
  await expect(dialog.locator("#employee-position")).toHaveValue(
    "Senior Engineer",
  )
  await save.click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText("Senior Engineer")).toBeVisible()
  expect(bodies).toHaveLength(2)
  for (const body of bodies) {
    expect(body).toMatchObject({
      departmentId: "dept-2",
      teamId: null,
      position: "Senior Engineer",
    })
    expect(body).not.toHaveProperty("password")
    expect(body).not.toHaveProperty("userId")
  }
})

test("PG-023-F016-A001-T023 validates and retries creating a login account", async ({
  page,
}) => {
  const employee = { ...directoryEmployee, hasAccount: false }
  const pending = gate()
  let calls = 0
  let created = false
  await restoreSession(page, "ADMIN")
  await page.route(listPattern, (route) =>
    route.fulfill({ json: listing([{ ...employee, hasAccount: created }]) }),
  )
  await page.route(
    "**/api/employees/" + employee.id + "/account",
    async (route) => {
      calls++
      if (calls === 1) {
        await pending.wait
        return route.fulfill({ status: 409, json: { error: "Login conflict" } })
      }
      created = true
      await route.fulfill({
        status: 201,
        json: { employee: { ...employee, hasAccount: true } },
      })
    },
  )
  await page.goto("/employees")
  const dialog = await openRowAction(
    page,
    employee.fullName,
    "Create login account",
  )
  const password = dialog.locator("#login-password")
  const confirm = dialog.locator("#login-confirmation")
  const submit = dialog.getByRole("button", {
    name: "Create login",
    exact: true,
  })
  await password.fill("weakpassword")
  await confirm.fill("weakpassword")
  await submit.click()
  expect(calls).toBe(0)
  await password.fill("ValidPassword1!")
  await submit.click()
  expect(calls).toBe(0)
  await confirm.fill("ValidPassword1!")
  await submit.click()
  try {
    await expect.poll(() => calls).toBe(1)
    await expect(
      dialog.getByRole("button", { name: /Creating/ }),
    ).toBeDisabled()
    await expect(password).toBeDisabled()
  } finally {
    pending.release()
  }
  await expect(dialog.getByText("Login conflict")).toBeVisible()
  await expect(password).toHaveValue("ValidPassword1!")
  await submit.click()
  await expect(dialog).toHaveCount(0)
  expect(calls).toBe(2)
  await page
    .getByRole("button", { name: "More actions for " + employee.fullName })
    .click()
  await expect(
    page.getByRole("menuitem", { name: "Create login account" }),
  ).toHaveCount(0)
})

test("PG-023-F021-A001-T034 opens employee department members and returns to details", async ({
  page,
  browser,
  baseURL,
}) => {
  await restoreSession(page, "ADMIN", { initialEmployees: [directoryEmployee] })
  let removed = false
  let reads = 0
  await page.route(listPattern, (route) => {
    reads++
    return route.fulfill({ json: listing([directoryEmployee]) })
  })
  await page.route("**/api/employees/" + directoryEmployee.id, (route) =>
    route.fulfill({ json: { employee: directoryEmployee } }),
  )
  await page.route("**/api/departments/dept-1", (route) =>
    route.fulfill({
      json: {
        department: {
          ...directoryEmployee.department,
          members: removed
            ? []
            : [
                {
                  ...directoryEmployee,
                  id: "synthetic-member",
                  fullName: "Synthetic Member",
                },
              ],
          teams: [],
          memberCount: removed ? 0 : 1,
        },
      },
    }),
  )
  await page.route(
    "**/api/departments/dept-1/members/synthetic-member",
    async (route) => {
      expect(route.request().method()).toBe("DELETE")
      removed = true
      await route.fulfill({ status: 204 })
    },
  )
  await page.goto("/employees")
  const dialog = await openRowAction(
    page,
    directoryEmployee.fullName,
    "View Employee",
  )
  const department = page.waitForRequest(
    (request) => new URL(request.url()).pathname === "/api/departments/dept-1",
  )
  await dialog.getByRole("button", { name: "Manage department" }).click()
  await department
  await expect(dialog).toContainText("Engineering")
  const readsBefore = reads
  await dialog
    .getByRole("button", { name: "Remove Synthetic Member from department" })
    .click()
  await dialog.getByRole("button", { name: "Remove", exact: true }).click()
  await expect.poll(() => removed).toBe(true)
  await expect.poll(() => reads).toBeGreaterThan(readsBefore)
  await page.keyboard.press("Escape")
  await expect(dialog).toContainText(directoryEmployee.fullName)

  const context = await browser.newContext({ baseURL })
  try {
    const restricted = await context.newPage()
    await restoreSession(restricted, "ADMIN", {
      account: {
        permissions: ["employees:read", "employees:manage", "departments:read"],
      },
      initialEmployees: [directoryEmployee],
    })
    await restricted.route(
      "**/api/employees/" + directoryEmployee.id,
      (route) => route.fulfill({ json: { employee: directoryEmployee } }),
    )
    await restricted.goto("/employees")
    const detail = await openRowAction(
      restricted,
      directoryEmployee.fullName,
      "View Employee",
    )
    await expect(detail).toContainText(directoryEmployee.fullName)
    await expect(
      detail.getByRole("button", { name: "Manage department" }),
    ).toHaveCount(0)
  } finally {
    await context.close()
  }
})

test("PG-023-F004-A004-T035 keeps a newer search when an obsolete response arrives", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  const hold = gate()
  const completed = gate()
  const queries: string[] = []
  await page.route(listPattern, async (route) => {
    const query =
      new URL(route.request().url()).searchParams.get("search") ?? ""
    queries.push(query)
    if (query === "Older") await hold.wait
    try {
      await route.fulfill({
        json: listing([
          {
            ...directoryEmployee,
            fullName: query || directoryEmployee.fullName,
          },
        ]),
      })
    } finally {
      if (query === "Older") completed.release()
    }
  })
  await page.goto("/employees")
  const search = page.getByRole("searchbox", { name: "Search employees" })
  await expect(
    page.getByText(directoryEmployee.fullName, { exact: true }),
  ).toBeVisible()
  await search.fill("Older")
  try {
    await expect.poll(() => queries.includes("Older")).toBe(true)
    await search.fill("Newer")
    await expect(page.getByText("Newer", { exact: true })).toBeVisible()
  } finally {
    hold.release()
  }
  await completed.wait
  await expect(page.getByText("Newer", { exact: true })).toBeVisible()
  await expect(page.getByText("Older", { exact: true })).toHaveCount(0)
  await expect(page.getByText(/Showing 1.*1/)).toBeVisible()
  expect(queries).toEqual(["", "Older", "Newer"])
})

test("PG-023-F011-A004-T036 holds a pending employee submission open without duplicate writes", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  const pending = gate()
  let writes = 0
  await page.route("**/api/employees", async (route) => {
    if (route.request().method() !== "POST") return route.fallback()
    writes++
    await pending.wait
    await route.fulfill({ status: 409, json: { error: "Create conflict" } })
  })
  await page.goto("/employees")
  await page.getByRole("button", { name: "Create Employee" }).click()
  const dialog = page.getByRole("dialog")
  await fillCreate(dialog)
  await dialog.getByRole("button", { name: "Add Employee" }).dblclick()
  try {
    await expect.poll(() => writes).toBe(1)
    await expect(dialog.getByRole("button", { name: /Saving/ })).toBeDisabled()
    await expect(dialog.getByRole("button", { name: /Close/ })).toBeDisabled()
    await page.keyboard.press("Escape")
    await page.mouse.click(1, 1)
    await expect(dialog).toBeVisible()
  } finally {
    pending.release()
  }
  await expect(dialog.getByText("Create conflict")).toBeVisible()
  await expect(dialog).toBeVisible()
  expect(writes).toBe(1)
  await expect(page.getByText("Employee created", { exact: true })).toHaveCount(
    0,
  )
})

test("PG-023-F011-A005-T038 focuses and describes invalid employee inputs on keyboard submission", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  let writes = 0
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/employees"
    )
      writes++
  })
  await page.goto("/employees")
  await page.getByRole("button", { name: "Create Employee" }).press("Enter")
  const dialog = page.getByRole("dialog")
  const submit = dialog.getByRole("button", { name: "Add Employee" })
  await submit.press("Enter")
  const id = dialog.locator("#employee-id")
  await expect(id).toBeFocused()
  await expect(id).toHaveAttribute("aria-invalid", "true")
  const description = await id.getAttribute("aria-describedby")
  expect(description).toBeTruthy()
  await expect(id).toHaveAccessibleDescription(/Use EXP-/i)
  await fillCreate(dialog)
  await dialog.locator("#employee-password").fill("weakpassword")
  await submit.press("Enter")
  await expect(dialog.locator("#employee-password")).toHaveAttribute(
    "aria-invalid",
    "true",
  )
  await dialog.locator("#employee-password").fill("DifferentPassword1!")
  await submit.press("Enter")
  await expect(
    dialog.locator("#employee-password-confirmation"),
  ).toHaveAttribute("aria-invalid", "true")
  for (const input of await dialog.locator('input:not([type="hidden"])').all())
    await expect(input).toHaveAccessibleName(/\S/)
  expect(writes).toBe(0)
})
