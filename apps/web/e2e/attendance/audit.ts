import { test, expect } from "@playwright/test"

import type { AttendanceAuditEvent } from "../../src/features/attendance/api/attendance-api"
import { assertNoPageOverflow, routeAttendanceApi, signIn } from "./support"

function auditEvent(
  id: string,
  overrides: Partial<AttendanceAuditEvent> = {},
): AttendanceAuditEvent {
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
    ...overrides,
  }
}

function auditPayload(
  events: AttendanceAuditEvent[],
  page: number,
  total: number,
) {
  return {
    asOf: "2026-11-15T00:00:00.000Z",
    total,
    page,
    pageSize: 10,
    events,
    actionCounts: [],
  }
}

/** Route boundaries, time log overview and the audit trail. */
export function auditTests() {
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
    const superadminPage = await page.context().newPage()
    await signIn(superadminPage, "superadmin")
    await routeAttendanceApi(superadminPage)
    await superadminPage.goto("/attendance/policies/overview")
    await expect(superadminPage).toHaveURL(/\/attendance\/policies\/overview$/)
    await expect(
      superadminPage.getByRole("heading", {
        name: "Policies Overview",
        exact: true,
      }),
    ).toBeVisible()
    await superadminPage.close()

    const headPage = await page.context().newPage()
    await signIn(headPage, "head")
    await routeAttendanceApi(headPage)
    await headPage.goto("/attendance/time-logs/overview")
    await expect(
      headPage.getByRole("heading", {
        name: "Time Logs Overview",
        exact: true,
      }),
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
        route.fulfill({
          status: 503,
          json: { error: "Summary temporarily unavailable." },
        }),
      )
      const available = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
          `/api/attendance/${failed === "departments" ? "overview" : "departments"}`,
      )
      await page.goto("/attendance/time-logs/overview")
      const response = await available
      expect(response.status()).toBe(200)
      const main = page.getByRole("main", { name: "Attendance workspace" })
      const figures = main.getByLabel("Time log figures")
      const selector = main.getByRole("combobox", {
        name: "Time logs department",
      })
      await expect(figures).toHaveAttribute("aria-busy", "false")
      await expect(
        main.getByRole("button", { name: "Retry", exact: true }),
      ).toBeVisible()
      if (failed === "departments") {
        // PG-014-F001-A009-T002
        await selector.click()
        await expect(page.getByRole("option")).toHaveText([
          "All permitted departments",
        ])
        await page.keyboard.press("Escape")
        const data = await response.json()
        await expect(
          figures
            .locator(":scope > div")
            .filter({ has: page.getByText("Check-ins", { exact: true }) })
            .getByRole("definition"),
        ).toHaveText(String(data.checkIns.total))
      } else {
        // PG-014-F001-A010-T002
        await expect(
          main.getByText("Record summaries unavailable."),
        ).toBeVisible()
        await expect(
          main
            .getByRole("region", { name: "Coverage" })
            .getByRole("definition"),
        ).toHaveText(["—", "—", "—", "—"])
        await expect(
          figures.getByRole("definition").filter({ hasText: "—" }),
        ).toHaveCount(4)
        await expect(
          main.getByRole("combobox", { name: "Time logs department" }),
        ).toBeEnabled()
      }
      await page.unroute(pattern)
      const retryReads: string[] = []
      const trackRead = (request: import("@playwright/test").Request) => {
        const pathname = new URL(request.url()).pathname
        if (
          ["/api/attendance/overview", "/api/attendance/departments"].includes(
            pathname,
          )
        )
          retryReads.push(pathname)
      }
      page.on("request", trackRead)
      const retried = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/attendance/" + failed,
      )
      await main.getByRole("button", { name: "Retry", exact: true }).click()
      const retryResponse = await retried
      expect(retryResponse.status()).toBe(200)
      await expect(
        main.getByRole("button", { name: "Retry", exact: true }),
      ).toHaveCount(0)
      await expect(figures).toHaveAttribute("aria-busy", "false")
      await expect(
        figures.getByRole("definition").filter({ hasText: "—" }),
      ).toHaveCount(0)
      await assertNoPageOverflow(page)
      page.off("request", trackRead)
      expect(retryReads).toEqual(["/api/attendance/" + failed])
      if (failed === "departments") {
        const { departments } = (await retryResponse.json()) as {
          departments: { name: string }[]
        }
        await selector.click()
        await expect(page.getByRole("option")).toHaveText([
          "All permitted departments",
          ...departments.map(({ name }) => name),
        ])
        await page.keyboard.press("Escape")
      } else {
        const query = new URL(retryResponse.url()).searchParams
        expect(Object.fromEntries(query)).toEqual({
          from: await main.getByLabel("Attendance from date").inputValue(),
          to: await main.getByLabel("Attendance through date").inputValue(),
          departmentId: "",
        })
      }
    }
  })

  test("attendance audit search stays in sync with pagination and keeps rows during refresh", async ({
    page,
  }) => {
    await signIn(page, "admin")
    const queries: string[] = []
    let releaseInitial!: () => void
    let notifyInitialRequest!: () => void
    let initialRequestPending = true
    const initialRequested = new Promise<void>((resolve) => {
      notifyInitialRequest = resolve
    })
    const pendingInitialResponse = new Promise<void>((resolve) => {
      releaseInitial = resolve
    })
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
      if (initialRequestPending) {
        initialRequestPending = false
        notifyInitialRequest()
        await pendingInitialResponse
      }
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
            ? [
                auditEvent(
                  search === "latest" ? "latest-match" : "payroll-match",
                ),
              ]
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
    const navigation = page.goto("/attendance/audit")
    await initialRequested
    const table = page.getByRole("table", { name: "Attendance audit events" })
    try {
      // PG-005-F001-A006-T008: the initial request shows five skeleton rows.
      await expect(table).toHaveAttribute("aria-busy", "true")
      await expect(table.getByRole("status")).toContainText(
        "Loading audit events",
      )
      await expect(table.getByRole("row")).toHaveCount(6)
    } finally {
      releaseInitial()
    }
    await navigation
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
    await expect(table.getByText("payroll-match", { exact: true })).toHaveCount(
      0,
    )

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
    await expect(
      table.getByText("payroll-match", { exact: true }),
    ).toBeVisible()
  })

  test("[PG-005-F001-A002-T003] department filter resets pagination and reaches audit API", async ({
    page,
  }) => {
    await signIn(page, "admin")
    const auditQueries: URL[] = []
    await page.route("**/api/attendance/departments", (route) =>
      route.fulfill({
        json: {
          departments: [
            { id: "dept-engineering", name: "Engineering" },
            { id: "dept-finance", name: "Finance" },
          ],
        },
      }),
    )
    await page.route("**/api/attendance/audit?**", async (route) => {
      const url = new URL(route.request().url())
      auditQueries.push(url)
      const pageNumber = Number(url.searchParams.get("page") ?? "1")
      const departmentId = url.searchParams.get("departmentId")
      if (departmentId === "dept-finance")
        return route.fulfill({
          json: auditPayload(
            [
              auditEvent("finance-event", {
                employee: { fullName: "Finance Employee" },
              }),
            ],
            pageNumber,
            1,
          ),
        })
      const events = Array.from({ length: 10 }, (_, index) =>
        auditEvent("audit-event-" + ((pageNumber - 1) * 10 + index + 1)),
      )
      return route.fulfill({ json: auditPayload(events, pageNumber, 20) })
    })

    await page.goto("/attendance/audit")
    const table = page.getByRole("table", { name: "Attendance audit events" })
    await expect(
      table.getByText("audit-event-1", { exact: true }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Page 2", exact: true }).click()
    await expect(
      table.getByText("audit-event-11", { exact: true }),
    ).toBeVisible()

    await page.getByRole("combobox", { name: "Audit department" }).click()
    await page.getByRole("option", { name: "Finance", exact: true }).click()
    await expect(
      table.getByText("Finance Employee", { exact: true }),
    ).toBeVisible()
    await expect
      .poll(() => {
        const latest = auditQueries.at(-1)
        return latest
          ? [
              latest.searchParams.get("page"),
              latest.searchParams.get("departmentId"),
            ].join(":")
          : ""
      })
      .toBe("1:dept-finance")
  })

  test("[PG-005-F001-A004-T005] date controls submit the UTC range and reset pagination", async ({
    page,
  }) => {
    await signIn(page, "admin")
    const auditQueries: URL[] = []
    await page.route("**/api/attendance/departments", (route) =>
      route.fulfill({ json: { departments: [] } }),
    )
    await page.route("**/api/attendance/audit?**", async (route) => {
      const url = new URL(route.request().url())
      auditQueries.push(url)
      const pageNumber = Number(url.searchParams.get("page") ?? "1")
      return route.fulfill({
        json: auditPayload(
          [auditEvent("audit-page-" + pageNumber)],
          pageNumber,
          20,
        ),
      })
    })

    await page.goto("/attendance/audit")
    const table = page.getByRole("table", { name: "Attendance audit events" })
    await expect(table.getByText("audit-page-1", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Page 2", exact: true }).click()
    await expect(table.getByText("audit-page-2", { exact: true })).toBeVisible()

    const from = page.getByLabel("Attendance from date")
    const through = page.getByLabel("Attendance through date")
    await from.fill("2026-11-12")
    await through.fill("2026-11-13")
    await expect(through).toHaveAttribute("min", "2026-11-12")
    await expect(from).toHaveAttribute("max", "2026-11-13")
    await expect
      .poll(() => {
        const latest = auditQueries.at(-1)
        return latest
          ? [
              latest.searchParams.get("from"),
              latest.searchParams.get("to"),
              latest.searchParams.get("page"),
            ].join(":")
          : ""
      })
      .toBe("2026-11-12:2026-11-13:1")
    await expect(table.getByText("audit-page-1", { exact: true })).toBeVisible()
    await expect(
      page.getByText(/Dates filter the event timestamp in UTC/),
    ).toBeVisible()
  })

  test("[PG-005-F001-A002-T009] department choices recover through their retry control", async ({
    page,
  }) => {
    await signIn(page, "admin")
    let departmentRequests = 0
    await page.route("**/api/attendance/departments", async (route) => {
      departmentRequests += 1
      if (departmentRequests === 1)
        return route.fulfill({
          status: 503,
          json: { error: "Department choices unavailable." },
        })
      return route.fulfill({
        json: { departments: [{ id: "dept-operations", name: "Operations" }] },
      })
    })
    await page.route("**/api/attendance/audit?**", (route) =>
      route.fulfill({ json: auditPayload([], 1, 0) }),
    )

    await page.goto("/attendance/audit")
    const alert = page
      .getByRole("alert")
      .filter({ hasText: "Department choices unavailable." })
    await expect(alert).toContainText("Department choices unavailable.")
    await alert.getByRole("button", { name: "Retry", exact: true }).click()
    await expect.poll(() => departmentRequests).toBe(2)
    const department = page.getByRole("combobox", {
      name: "Audit department",
    })
    await department.click()
    await expect(
      page.getByRole("option", { name: "Operations", exact: true }),
    ).toBeVisible()
  })

  test.describe("PG-005 audit row summaries in explicit UTC", () => {
    test.use({ timezoneId: "Pacific/Auckland" })

    test("[PG-005-F001-A007-T011] row labels include UTC time and identity fallbacks", async ({
      page,
    }) => {
      await signIn(page, "admin")
      await page.route("**/api/attendance/departments", (route) =>
        route.fulfill({ json: { departments: [] } }),
      )
      await page.route("**/api/attendance/audit?**", (route) =>
        route.fulfill({
          json: auditPayload(
            [
              auditEvent("named-event", {
                createdAt: "2026-11-13T23:30:00.000Z",
                actor: { fullName: "Audit Actor" },
                employee: { fullName: "Audit Employee" },
              }),
              auditEvent("missing-identity", {
                actorId: "missing-actor",
                actor: { fullName: "  " },
                employee: null,
              }),
              auditEvent("policy-event", {
                entityType: "AttendancePolicy",
                action: "INSERT",
                actorId: null,
                actor: null,
                employee: null,
              }),
              auditEvent("unknown-event", {
                entityType: "UnknownRecordType",
                action: "CUSTOM_ACTION",
                actorId: null,
                actor: null,
                employee: null,
              }),
            ],
            1,
            4,
          ),
        }),
      )

      await page.goto("/attendance/audit")
      const table = page.getByRole("table", {
        name: "Attendance audit events",
      })
      await expect(
        table.getByText("Nov 13, 2026, 11:30 PM", { exact: true }),
      ).toBeVisible()
      await expect(
        table.getByText("Nov 14, 2026, 12:30 PM", { exact: true }),
      ).toHaveCount(0)
      await expect(
        table.getByText("Audit Actor", { exact: true }),
      ).toBeVisible()
      await expect(
        table.getByText("Audit Employee", { exact: true }),
      ).toBeVisible()
      await expect(
        table.getByText("Name unavailable", { exact: true }),
      ).toBeVisible()
      await expect(
        table.getByText("No actor recorded", { exact: true }),
      ).toHaveCount(2)
      await expect(
        table.getByText("Not applicable (policy change)", { exact: true }),
      ).toBeVisible()
      await expect(
        table.getByText("Employee unavailable", { exact: true }),
      ).toHaveCount(2)
      await expect(
        table.getByText("Created an attendance policy", { exact: true }),
      ).toBeVisible()
      await expect(
        table.getByText("Custom action an unknown record type", {
          exact: true,
        }),
      ).toBeVisible()
    })
  })

  test("[PG-005-F001-A008-T012] detail panel renders allowlisted snapshots read-only", async ({
    page,
  }) => {
    await signIn(page, "admin")
    await page.route("**/api/attendance/departments", (route) =>
      route.fulfill({ json: { departments: [] } }),
    )
    await page.route("**/api/attendance/audit?**", (route) =>
      route.fulfill({
        json: auditPayload(
          [
            auditEvent("event-details", {
              entityType: "AttendanceAdjustment",
              action: "UPDATE",
              reason: "Approved overtime",
              before: {
                status: "PENDING",
                reviewNote: "Old review note",
                proposedStartedAt: "2026-11-13T22:00:00.000Z",
              },
              after: {
                type: "OVERTIME",
                status: "APPROVED",
                overtimeMinutes: 45,
                startedAt: "2026-11-13T23:30:00.000Z",
                reviewNote: "Approved note",
                isWorkingDay: true,
                privateMetadata: "PRIVATE-UNLISTED-SNAPSHOT",
                createdAt: null,
              },
            }),
            auditEvent("array-snapshot", {
              entityType: "AttendanceWorkday",
              before: null,
              after: ["unsupported", "snapshot"],
            }),
          ],
          1,
          2,
        ),
      }),
    )

    await page.goto("/attendance/audit")
    await page
      .getByRole("button", { name: "View audit event event-details" })
      .click()
    const details = page.getByRole("dialog", { name: "Audit event details" })
    await expect(details).toBeVisible()
    await expect(
      details.getByText("Approved overtime", { exact: true }),
    ).toBeVisible()
    await expect(details.getByText("Overtime", { exact: true })).toBeVisible()
    await expect(details.getByText("Approved", { exact: true })).toBeVisible()
    await expect(details.getByText("45 minutes", { exact: true })).toBeVisible()
    await expect(
      details.getByText("Nov 13, 2026, 11:30 PM", { exact: true }),
    ).toBeVisible()
    await expect(
      details.getByRole("heading", { name: "Previous values", exact: true }),
    ).toBeVisible()
    await expect(
      details.getByText("Old review note", { exact: true }),
    ).toBeVisible()
    await expect(details).not.toContainText("PRIVATE-UNLISTED-SNAPSHOT")
    await expect(details).not.toContainText("isWorkingDay")
    await expect(
      details.getByRole("button", {
        name: /^(Edit|Save|Delete|Approve|Reject)$/i,
      }),
    ).toHaveCount(0)

    await details.getByRole("button", { name: "Done", exact: true }).click()
    await expect(details).toHaveCount(0)
    await page
      .getByRole("button", { name: "View audit event array-snapshot" })
      .click()
    const emptyDetails = page.getByRole("dialog", {
      name: "Audit event details",
    })
    await expect(
      emptyDetails.getByText("No additional event details were recorded."),
    ).toBeVisible()
    await expect(
      emptyDetails.getByRole("heading", { name: "Previous values" }),
    ).toHaveCount(0)
  })

  test("[PG-005-F001-A009-T013] keyboard opens and dismisses event details at 390px", async ({
    page,
  }) => {
    await signIn(page, "admin")
    await page.setViewportSize({ width: 390, height: 844 })
    await page.route("**/api/attendance/departments", (route) =>
      route.fulfill({ json: { departments: [] } }),
    )
    await page.route("**/api/attendance/audit?**", (route) =>
      route.fulfill({
        json: auditPayload([auditEvent("keyboard-event")], 1, 1),
      }),
    )

    await page.goto("/attendance/audit")
    const trigger = page.getByRole("button", {
      name: "View audit event keyboard-event",
    })
    await expect(trigger).toBeVisible()
    await trigger.focus()
    await trigger.press("Enter")
    const details = page.getByRole("dialog", { name: "Audit event details" })
    await expect(details).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(details).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await assertNoPageOverflow(page)
  })
}
