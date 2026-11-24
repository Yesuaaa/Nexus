import { test, expect, type Page, type Route } from "@playwright/test"
import {
  configureRegressionTest,
  live,
  restoreSession,
} from "./regression-support"

configureRegressionTest()
test.skip(live, "Policy picker regressions use a scoped mock API")

const employees = Array.from({ length: 12 }, (_, index) => ({
  id: `employee-${index + 1}`,
  fullName: `Policy employee ${String(index + 1).padStart(2, "0")}`,
  employeeId: `EMP-${String(index + 1).padStart(3, "0")}`,
  departmentId: null,
}))

type PolicyFixture = {
  id: string
  name: string
  timeZone: string
  scheduleMode: "FLEXIBLE"
  archivedAt: string | null
  unpaidBreaksEnabled: boolean
  overnightRequiresReview: boolean
  createdAt: string
  days: {
    weekday: number
    isWorkingDay: boolean
    requiredMinutes: number
  }[]
  _count: { assignments: number }
}

function policyFixture(
  id: string,
  name: string,
  overrides: Partial<PolicyFixture> = {},
): PolicyFixture {
  return {
    id,
    name,
    timeZone: "Asia/Manila",
    scheduleMode: "FLEXIBLE",
    archivedAt: null,
    unpaidBreaksEnabled: true,
    overnightRequiresReview: false,
    createdAt: "2026-11-13T00:00:00.000Z",
    days: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      isWorkingDay: false,
      requiredMinutes: 0,
    })),
    _count: { assignments: 0 },
    ...overrides,
  }
}

function policyPage(policies: PolicyFixture[], page: number, pageSize = 10) {
  const start = (page - 1) * pageSize
  return {
    page,
    pageSize,
    total: policies.length,
    summary: {
      totalPolicies: policies.length,
      activePolicies: policies.filter(({ archivedAt }) => !archivedAt).length,
      archivedPolicies: policies.filter(({ archivedAt }) => archivedAt).length,
      assignmentPeriods: policies.reduce(
        (sum, policy) => sum + policy._count.assignments,
        0,
      ),
    },
    policies: policies.slice(start, start + pageSize),
  }
}

function deferred() {
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

async function openPolicyDirectory(
  page: Page,
  handler: (route: Route) => Promise<void>,
) {
  await page.clock.setFixedTime(new Date("2026-11-13T08:00:00Z"))
  await restoreSession(page, "ADMIN")
  await page.route("**/api/attendance/**", handler)
  await page.goto("/attendance/policies/management")
  return page.getByRole("table", { name: "Attendance policies" })
}

async function openAssignment(
  page: Page,
  failSecondAssignment = false,
  holdFirstAssignment = false,
) {
  await page.clock.setFixedTime(new Date("2026-11-13T08:00:00Z"))
  await restoreSession(page, "ADMIN")
  const assignments: unknown[] = []
  const employeePages: number[] = []
  const assignmentGate = deferred()
  const assignmentStarted = deferred()
  let shouldFail = failSecondAssignment
  await page.route("**/api/attendance/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname.endsWith("/policies")) {
      await route.fulfill({
        json: {
          policies: [
            {
              id: "policy-1",
              name: "Flexible policy",
              timeZone: "Asia/Manila",
              unpaidBreaksEnabled: true,
              overnightRequiresReview: false,
              days: Array.from({ length: 7 }, (_, weekday) => ({
                weekday,
                isWorkingDay: false,
                requiredMinutes: 0,
              })),
            },
          ],
        },
      })
    } else if (url.pathname.endsWith("/employees")) {
      const pageNumber = Number(url.searchParams.get("page"))
      employeePages.push(pageNumber)
      await route.fulfill({
        json: {
          employees: employees.slice((pageNumber - 1) * 10, pageNumber * 10),
          page: pageNumber,
          pageSize: 10,
          total: employees.length,
        },
      })
    } else if (url.pathname.endsWith("/assignments")) {
      const body: unknown = request.postDataJSON()
      assignments.push(body)
      if (holdFirstAssignment && assignments.length === 1) {
        assignmentStarted.start()
        await assignmentGate.pending
      }
      if (shouldFail && assignments.length === 2) {
        shouldFail = false
        await route.fulfill({
          status: 409,
          json: { error: "Choose a date after existing attendance records" },
        })
      } else {
        await route.fulfill({ status: 201, json: { assignment: body } })
      }
    } else await route.fallback()
  })
  await page.goto("/attendance/policies/management")
  await page
    .getByRole("button", { name: "Assign policy to employee", exact: true })
    .click()
  const panel = page.getByRole("dialog")
  await expect(panel.getByRole("checkbox")).toHaveCount(12)
  await expect(
    panel.getByRole("combobox", { name: "Select attendance employee" }),
  ).toHaveCount(0)
  await expect(
    panel.getByRole("button", { name: "Assign policy", exact: true }),
  ).toBeDisabled()
  expect(employeePages).toEqual([1, 2])
  return {
    panel,
    assignments,
    assignmentStarted: assignmentStarted.started,
    releaseAssignment: assignmentGate.release,
  }
}

async function choosePolicy(page: Page) {
  await page
    .getByRole("combobox", { name: "Attendance policy", exact: true })
    .click()
  await page.getByRole("option", { name: /Flexible policy/ }).click()
  await page
    .getByRole("button", { name: "Effective from", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Monday, November 16, 2026", exact: true })
    .click()
}

test("[PG-008-F001-A001-T002] canonical policy access and settings alias honor the access matrix", async ({
  page,
}) => {
  const context = page.context()
  const fixture = policyFixture("access-policy", "Access policy fixture")
  const cases = [
    { role: "ADMIN", active: true, allowed: true },
    { role: "SUPERADMIN", active: true, allowed: true },
    { role: "STAFF", active: true, allowed: false },
    { role: "USER", active: true, allowed: false },
    { role: "ADMIN", active: false, allowed: false },
  ] as const

  for (const scenario of cases) {
    const candidate = await context.newPage()
    await candidate.setViewportSize({ width: 1440, height: 900 })
    await candidate.clock.setFixedTime(new Date("2026-11-13T08:00:00Z"))
    await restoreSession(
      candidate,
      scenario.role,
      scenario.active ? undefined : { account: { isActive: false } },
    )
    let policyRequests = 0
    await candidate.route("**/api/attendance/**", async (route) => {
      const url = new URL(route.request().url())
      if (
        route.request().method() === "GET" &&
        url.pathname === "/api/attendance/policies"
      ) {
        policyRequests += 1
        await route.fulfill({ json: policyPage([fixture], 1) })
      } else await route.fallback()
    })

    try {
      await candidate.goto("/attendance/policies/management")
      if (scenario.allowed) {
        await expect(candidate).toHaveURL(/\/attendance\/policies\/management$/)
        await expect(
          candidate.getByRole("table", { name: "Attendance policies" }),
        ).toBeVisible()
        await expect(
          candidate.getByRole("link", { name: "Management", exact: true }),
        ).toBeVisible()
        await expect(
          candidate.getByRole("row").filter({ hasText: fixture.name }),
        ).toBeVisible()

        await candidate.goto("/attendance/settings")
        await expect(candidate).toHaveURL(/\/attendance\/policies\/management$/)
        await expect(
          candidate.getByRole("row").filter({ hasText: fixture.name }),
        ).toBeVisible()
      } else {
        await expect(candidate).not.toHaveURL(
          /\/attendance\/policies\/management(?:$|\?)/,
        )
        await expect(
          candidate.getByRole("table", { name: "Attendance policies" }),
        ).toHaveCount(0)
        expect(policyRequests).toBe(0)
      }
    } finally {
      await candidate.close()
    }
  }
})

test("[PG-008-F001-A002-T002] policy directory displays an error and retries successfully", async ({
  page,
}) => {
  const fixture = policyFixture("retry-policy", "Retry policy fixture")
  let attempts = 0
  const table = await openPolicyDirectory(page, async (route) => {
    const url = new URL(route.request().url())
    if (
      route.request().method() === "GET" &&
      url.pathname === "/api/attendance/policies" &&
      url.searchParams.get("size") === "10"
    ) {
      attempts += 1
      if (attempts === 1)
        await route.fulfill({
          status: 503,
          json: { error: "Policy list temporarily unavailable" },
        })
      else await route.fulfill({ json: policyPage([fixture], 1) })
    } else await route.fallback()
  })

  const listError = page.locator('p[role="alert"]')
  await expect(listError).toContainText("Policy list temporarily unavailable")
  await page.getByRole("button", { name: "Retry", exact: true }).click()
  await expect(
    table.getByRole("row").filter({ hasText: fixture.name }),
  ).toBeVisible()
  await expect(listError).toHaveCount(0)
  expect(attempts).toBe(2)
})

test("[PG-008-F001-A003-T002] policy search trims terms, resets pages, matches timezone, and shows empty state", async ({
  page,
}) => {
  const fixtures = Array.from({ length: 12 }, (_, index) =>
    policyFixture(
      `search-policy-${index + 1}`,
      index === 0
        ? "Alpha policy one"
        : `Directory policy ${String(index + 1).padStart(2, "0")}`,
      index === 1 ? { timeZone: "America/New_York" } : {},
    ),
  )
  const requests: { search: string | null; page: string | null }[] = []
  const table = await openPolicyDirectory(page, async (route) => {
    const url = new URL(route.request().url())
    if (
      route.request().method() === "GET" &&
      url.pathname === "/api/attendance/policies"
    ) {
      const search = url.searchParams.get("search")
      requests.push({ search, page: url.searchParams.get("page") })
      const filtered = search
        ? fixtures.filter(({ name, timeZone }) =>
            `${name} ${timeZone}`.toLowerCase().includes(search.toLowerCase()),
          )
        : fixtures
      const pageNumber = Number(url.searchParams.get("page") ?? 1)
      await route.fulfill({ json: policyPage(filtered, pageNumber) })
    } else await route.fallback()
  })

  await page.getByRole("button", { name: "Next page", exact: true }).click()
  await expect(
    table.getByRole("row").filter({ hasText: "Directory policy 12" }),
  ).toBeVisible()
  await expect.poll(() => requests.at(-1)?.page).toBe("2")

  const search = page.getByRole("searchbox", {
    name: "Search attendance policies",
    exact: true,
  })
  await search.fill("  aLpHa  ")
  await expect
    .poll(() => requests.at(-1))
    .toEqual({
      search: "alpha",
      page: "1",
    })
  await expect(
    table.getByRole("row").filter({ hasText: "Alpha policy one" }),
  ).toBeVisible()
  await expect(
    table.getByRole("row").filter({ hasText: "Directory policy 12" }),
  ).toHaveCount(0)

  await search.fill("  AMERICA/NEW_YORK  ")
  await expect
    .poll(() => requests.at(-1))
    .toEqual({
      search: "america/new_york",
      page: "1",
    })
  await expect(
    table.getByRole("row").filter({ hasText: "Directory policy 02" }),
  ).toContainText("America/New_York")

  await search.fill("no matching policy")
  await expect
    .poll(() => requests.at(-1))
    .toEqual({
      search: "no matching policy",
      page: "1",
    })
  await expect(table.getByRole("status")).toContainText("No results for")
})

test("[PG-008-F001-A003-T003] slower stale policy search cannot replace the latest result", async ({
  page,
}) => {
  const alphaGate = deferred()
  const alphaHandled = deferred()
  const alpha = policyFixture("alpha-result", "Alpha stale result")
  const beta = policyFixture("beta-result", "Beta current result")
  const requests: string[] = []
  const table = await openPolicyDirectory(page, async (route) => {
    const url = new URL(route.request().url())
    if (
      route.request().method() === "GET" &&
      url.pathname === "/api/attendance/policies"
    ) {
      const search = url.searchParams.get("search") ?? ""
      requests.push(search)
      if (search === "alpha") {
        alphaGate.start()
        await alphaGate.pending
        try {
          await route.fulfill({ json: policyPage([alpha], 1) })
        } catch {
          // The page aborts this request when its query changes.
        } finally {
          alphaHandled.start()
        }
      } else if (search === "beta")
        await route.fulfill({ json: policyPage([beta], 1) })
      else await route.fulfill({ json: policyPage([], 1) })
    } else await route.fallback()
  })

  const search = page.getByRole("searchbox", {
    name: "Search attendance policies",
    exact: true,
  })
  try {
    await search.fill("Alpha")
    await alphaGate.started
    await search.fill("Beta")
    await expect.poll(() => requests.at(-1)).toBe("beta")
    await expect(
      table.getByRole("row").filter({ hasText: beta.name }),
    ).toBeVisible()
    alphaGate.release()
    await alphaHandled.started
    await expect(
      table.getByRole("row").filter({ hasText: beta.name }),
    ).toBeVisible()
    await expect(
      table.getByRole("row").filter({ hasText: alpha.name }),
    ).toHaveCount(0)
    await expect(table).toHaveAttribute("aria-busy", "false")
  } finally {
    alphaGate.release()
  }
})

test("[PG-008-F001-A007-T001] policy row actions expose keyboard behavior and retain pointer access", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const fixture = policyFixture("keyboard-policy", "Keyboard policy")
  const table = await openPolicyDirectory(page, async (route) => {
    const url = new URL(route.request().url())
    if (
      route.request().method() === "GET" &&
      url.pathname === "/api/attendance/policies"
    )
      await route.fulfill({ json: policyPage([fixture], 1) })
    else await route.fallback()
  })
  const row = table.getByRole("row").filter({ hasText: fixture.name })
  const trigger = row.getByRole("button", {
    name: `More actions for ${fixture.name}`,
    exact: true,
  })
  const detailsAction = page.getByRole("menuitem", {
    name: "View policy details",
    exact: true,
  })
  await expect(trigger).toBeVisible()
  await trigger.focus()
  await trigger.press("ArrowDown")
  await expect(trigger).toHaveAttribute("aria-expanded", "true")
  let keyboardFailure: unknown
  try {
    await expect(detailsAction).toBeVisible({ timeout: 1500 })
    await page.keyboard.press("Escape")
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await expect(trigger).toBeFocused()
  } catch (failure: unknown) {
    keyboardFailure = failure
  }

  if ((await trigger.getAttribute("aria-expanded")) === "true") {
    await page.keyboard.press("Escape")
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
  }
  await trigger.click()
  await expect(detailsAction).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(trigger).toBeFocused()

  if (keyboardFailure !== undefined) throw keyboardFailure
})

test("[PG-008-F001-A013-T002] policy edit retains user input after API failure and recovers on retry", async ({
  page,
}) => {
  let fixture = policyFixture("edit-policy", "Policy before edit")
  let patchCount = 0
  const patchBodies: { name: string }[] = []
  const table = await openPolicyDirectory(page, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (
      request.method() === "GET" &&
      url.pathname === "/api/attendance/policies"
    ) {
      await route.fulfill({ json: policyPage([fixture], 1) })
    } else if (
      request.method() === "PATCH" &&
      url.pathname === `/api/attendance/policies/${fixture.id}`
    ) {
      patchCount += 1
      const body = request.postDataJSON() as { name: string }
      patchBodies.push(body)
      if (patchCount === 1)
        await route.fulfill({
          status: 409,
          json: { error: "The policy edit was rejected by the fixture." },
        })
      else {
        fixture = { ...fixture, name: body.name }
        await route.fulfill({ status: 200, json: { policy: fixture } })
      }
    } else await route.fallback()
  })
  const row = table.getByRole("row").filter({ hasText: fixture.name })
  await row
    .getByRole("button", { name: `More actions for ${fixture.name}` })
    .click()
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click()
  const editor = page.getByRole("dialog")
  const name = editor.getByLabel("Policy name", { exact: true })
  await name.fill("Retry edited policy")
  await editor.getByRole("button", { name: "Save policy", exact: true }).click()
  await expect(editor.getByRole("alert")).toContainText(
    "The policy edit was rejected by the fixture.",
  )
  await expect(name).toHaveValue("Retry edited policy")
  await expect(editor).toBeVisible()

  await editor.getByRole("button", { name: "Save policy", exact: true }).click()
  await expect(editor).toHaveCount(0)
  await expect(
    table.getByRole("row").filter({ hasText: "Retry edited policy" }),
  ).toBeVisible()
  expect(patchCount).toBe(2)
  expect(patchBodies.map(({ name: policyName }) => policyName)).toEqual([
    "Retry edited policy",
    "Retry edited policy",
  ])
})

test("[PG-008-F001-A014-T002] employee and policy-choice loaders recover independently before assignment is enabled", async ({
  page,
}) => {
  const policy = policyFixture("choice-policy", "Flexible policy")
  const employeeAttempts = { value: 0 }
  const policyChoiceAttempts = { value: 0 }
  await openPolicyDirectory(page, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (
      request.method() === "GET" &&
      url.pathname === "/api/attendance/policies" &&
      url.searchParams.get("size") === "10"
    ) {
      await route.fulfill({ json: policyPage([policy], 1) })
    } else if (
      request.method() === "GET" &&
      url.pathname === "/api/attendance/policies" &&
      url.searchParams.get("size") === "200"
    ) {
      policyChoiceAttempts.value += 1
      if (policyChoiceAttempts.value === 1)
        await route.fulfill({
          status: 503,
          json: { error: "Policy choices temporarily unavailable" },
        })
      else await route.fulfill({ json: policyPage([policy], 1, 200) })
    } else if (
      request.method() === "GET" &&
      url.pathname === "/api/attendance/employees"
    ) {
      employeeAttempts.value += 1
      if (employeeAttempts.value === 1)
        await route.fulfill({
          status: 503,
          json: { error: "Employee choices temporarily unavailable" },
        })
      else
        await route.fulfill({
          json: {
            employees: [employees[0]],
            page: 1,
            pageSize: 10,
            total: 1,
          },
        })
    } else await route.fallback()
  })
  await page
    .getByRole("button", { name: "Assign policy to employee", exact: true })
    .click()
  const panel = page.getByRole("dialog")
  const assign = panel.getByRole("button", {
    name: "Assign policy",
    exact: true,
  })
  await expect(assign).toBeDisabled()
  await expect(panel.getByRole("alert")).toContainText(
    "Employee choices temporarily unavailable",
  )
  await panel.getByRole("button", { name: "Retry", exact: true }).click()
  await expect(
    panel.getByRole("checkbox", { name: "Select Policy employee 01" }),
  ).toBeVisible()
  await expect(panel.getByRole("alert")).toContainText(
    "Policy choices temporarily unavailable",
  )
  await expect(assign).toBeDisabled()
  await panel.getByRole("button", { name: "Retry", exact: true }).click()
  await expect(
    panel.getByRole("combobox", { name: "Attendance policy", exact: true }),
  ).toBeVisible()
  await expect(assign).toBeDisabled()
  await panel
    .getByRole("checkbox", { name: "Select Policy employee 01", exact: true })
    .check()
  await choosePolicy(page)
  await expect(assign).toBeEnabled()
  expect(employeeAttempts.value).toBe(2)
  expect(policyChoiceAttempts.value).toBe(2)
})

test("[PG-008-F001-A015-T003] duplicate assignment confirmation while pending sends one request", async ({
  page,
}) => {
  const { panel, assignments, assignmentStarted, releaseAssignment } =
    await openAssignment(page, false, true)
  try {
    await panel
      .getByRole("checkbox", {
        name: "Select Policy employee 01",
        exact: true,
      })
      .check()
    await choosePolicy(page)
    await panel
      .getByRole("button", { name: "Assign policy", exact: true })
      .click()
    const confirmation = page.getByRole("dialog", {
      name: "Assign attendance policy?",
      exact: true,
    })
    const confirm = confirmation.getByRole("button", {
      name: "Confirm assignment",
      exact: true,
    })
    const submit = confirmation.locator('button[type="submit"]')
    await confirm.click()
    await assignmentStarted
    await expect(submit).toBeDisabled()
    await submit.dispatchEvent("click")
    expect(assignments).toHaveLength(1)
    releaseAssignment()
    await expect(confirmation).toHaveCount(0)
    expect(assignments).toHaveLength(1)
  } finally {
    releaseAssignment()
  }
})

test("[PG-008-F001-A022-T001] assignment details recover from stale responses and retry the selected page", async ({
  page,
}) => {
  const policy = policyFixture("detail-policy", "Detail policy", {
    _count: { assignments: 11 },
  })
  const stalePageGate = deferred()
  const stalePageHandled = deferred()
  let pageOneRequests = 0
  let pageTwoRequests = 0
  const assignmentRows = (prefix: string) =>
    Array.from({ length: 10 }, (_, index) => ({
      id: `${prefix}-assignment-${index + 1}`,
      employee: {
        id: `${prefix}-employee-${index + 1}`,
        fullName:
          index === 0
            ? `${prefix} current employee`
            : `${prefix} employee ${index + 1}`,
        employeeId: `${prefix.toUpperCase()}-${index + 1}`,
        departmentId: null,
        department: null,
      },
      effectiveFrom: index === 0 ? "2026-11-13" : "2026-11-12",
      effectiveUntil: null,
      status: index === 0 ? "CURRENT" : "ENDED",
    }))
  const table = await openPolicyDirectory(page, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (
      request.method() === "GET" &&
      url.pathname === "/api/attendance/policies"
    ) {
      await route.fulfill({ json: policyPage([policy], 1) })
    } else if (
      request.method() === "GET" &&
      url.pathname === `/api/attendance/policies/${policy.id}/assignments`
    ) {
      const pageNumber = Number(url.searchParams.get("page") ?? 1)
      if (pageNumber === 1) {
        pageOneRequests += 1
        const prefix = pageOneRequests === 1 ? "Initial page" : "Fresh page"
        await route.fulfill({
          json: {
            page: 1,
            pageSize: 10,
            total: 11,
            assignments: assignmentRows(prefix),
          },
        })
      } else {
        pageTwoRequests += 1
        if (pageTwoRequests === 1) {
          stalePageGate.start()
          await stalePageGate.pending
          try {
            await route.fulfill({
              json: {
                page: 2,
                pageSize: 10,
                total: 11,
                assignments: [
                  {
                    ...assignmentRows("Stale page")[0],
                    id: "stale-page-assignment",
                    employee: {
                      ...assignmentRows("Stale page")[0].employee,
                      fullName: "Stale page two response",
                    },
                  },
                ],
              },
            })
          } catch {
            // Closing the details panel aborts this obsolete page request.
          } finally {
            stalePageHandled.start()
          }
        } else if (pageTwoRequests === 2)
          await route.fulfill({
            status: 503,
            json: { error: "Assignment page temporarily unavailable" },
          })
        else
          await route.fulfill({
            json: {
              page: 2,
              pageSize: 10,
              total: 11,
              assignments: [
                {
                  ...assignmentRows("Retry page")[0],
                  id: "retry-page-assignment",
                  employee: {
                    ...assignmentRows("Retry page")[0].employee,
                    fullName: "Retry page two employee",
                  },
                },
              ],
            },
          })
      }
    } else await route.fallback()
  })

  const row = table.getByRole("row").filter({ hasText: policy.name })
  async function openDetails() {
    await row
      .getByRole("button", { name: `More actions for ${policy.name}` })
      .click()
    await page.getByRole("menuitem", { name: "View policy details" }).click()
    const details = page.getByRole("dialog")
    await details.getByRole("tab", { name: "Assigned people" }).click()
    return details
  }

  let details = await openDetails()
  await expect(details.getByRole("listitem")).toHaveCount(10)
  const currentRow = details
    .getByRole("listitem")
    .filter({ hasText: "Initial page current employee" })
  await currentRow.getByRole("button", { name: "End assignment" }).click()
  const inlineConfirmation = currentRow.getByRole("alertdialog")
  await expect(inlineConfirmation).toBeVisible()
  await details.getByRole("button", { name: "Next page", exact: true }).click()
  await stalePageGate.started
  await expect(inlineConfirmation).toHaveCount(0)
  await details.getByRole("button", { name: "Close policy details" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)

  details = await openDetails()
  await expect(
    details
      .getByRole("listitem")
      .filter({ hasText: "Fresh page current employee" }),
  ).toBeVisible()
  stalePageGate.release()
  await stalePageHandled.started
  await expect(
    details
      .getByRole("listitem")
      .filter({ hasText: "Fresh page current employee" }),
  ).toBeVisible()
  await expect(
    details
      .getByRole("listitem")
      .filter({ hasText: "Stale page two response" }),
  ).toHaveCount(0)

  await details.getByRole("button", { name: "Next page", exact: true }).click()
  await expect(details.getByRole("alert")).toContainText(
    "Assignment page temporarily unavailable",
  )
  await details.getByRole("button", { name: "Retry", exact: true }).click()
  await expect(
    details
      .getByRole("listitem")
      .filter({ hasText: "Retry page two employee" }),
  ).toBeVisible()
  await expect(details.getByRole("alert")).toHaveCount(0)
  expect(pageOneRequests).toBe(2)
  expect(pageTwoRequests).toBe(3)
})

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 1000 },
]) {
  test(`policy checkbox selection survives searches at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    const { panel, assignments } = await openAssignment(page)
    const search = panel.getByRole("searchbox", {
      name: "Search attendance employees",
    })
    await panel
      .getByRole("checkbox", { name: "Select Policy employee 01", exact: true })
      .check()
    await search.fill("EMP-012")
    await expect(panel.getByRole("checkbox")).toHaveCount(1)
    await panel
      .getByRole("checkbox", { name: "Select Policy employee 12", exact: true })
      .check()
    await expect(panel.getByRole("status")).toHaveText("2 selected")
    await search.fill("no matching employee")
    await expect(
      panel.getByText("No employees match your search."),
    ).toBeVisible()
    await expect(panel.getByRole("status")).toHaveText("2 selected")
    await search.clear()
    await expect(
      panel.getByRole("checkbox", {
        name: "Select Policy employee 01",
        exact: true,
      }),
    ).toBeChecked()
    await panel
      .getByRole("checkbox", { name: "Select Policy employee 12", exact: true })
      .uncheck()
    await expect(panel.getByRole("status")).toHaveText("1 selected")
    await panel
      .getByRole("checkbox", { name: "Select Policy employee 12", exact: true })
      .check()
    await choosePolicy(page)
    await search.scrollIntoViewIfNeeded()
    await panel.screenshot({
      path: test.info().outputPath(`policy-checkboxes-${viewport.width}.png`),
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true)
    await panel
      .getByRole("button", { name: "Assign policy", exact: true })
      .click()
    const confirmation = page.getByRole("dialog", {
      name: "Assign attendance policy?",
      exact: true,
    })
    await expect(confirmation.getByText("2 employees selected")).toBeVisible()
    await confirmation
      .getByRole("button", { name: "Confirm assignment", exact: true })
      .click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    expect(assignments).toEqual([
      {
        employeeId: "employee-1",
        policyId: "policy-1",
        effectiveFrom: "2026-11-16",
      },
      {
        employeeId: "employee-12",
        policyId: "policy-1",
        effectiveFrom: "2026-11-16",
      },
    ])
  })
}

test("policy assignment retries only employees that still need assignment", async ({
  page,
}) => {
  const { panel, assignments } = await openAssignment(page, true)
  await panel
    .getByRole("checkbox", { name: "Select Policy employee 01", exact: true })
    .check()
  await panel
    .getByRole("checkbox", { name: "Select Policy employee 12", exact: true })
    .check()
  await choosePolicy(page)
  await panel
    .getByRole("button", { name: "Assign policy", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Confirm assignment", exact: true })
    .click()
  await expect(panel.getByRole("alert")).toContainText(
    "Policy assigned to 1 employee. Remaining employees are still selected.",
  )
  await expect(panel.getByRole("alert")).toContainText(
    "Choose a date after existing attendance records",
  )
  await expect(
    panel.getByRole("checkbox", {
      name: "Select Policy employee 01",
      exact: true,
    }),
  ).not.toBeChecked()
  await expect(
    panel.getByRole("checkbox", {
      name: "Select Policy employee 12",
      exact: true,
    }),
  ).toBeChecked()
  await expect(panel.getByRole("status")).toHaveText("1 selected")
  await panel
    .getByRole("button", { name: "Assign policy", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Confirm assignment", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(assignments).toEqual([
    {
      employeeId: "employee-1",
      policyId: "policy-1",
      effectiveFrom: "2026-11-16",
    },
    {
      employeeId: "employee-12",
      policyId: "policy-1",
      effectiveFrom: "2026-11-16",
    },
    {
      employeeId: "employee-12",
      policyId: "policy-1",
      effectiveFrom: "2026-11-16",
    },
  ])
})
