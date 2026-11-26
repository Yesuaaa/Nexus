import { test, expect } from "@playwright/test"
import { randomUUID } from "node:crypto"
import {
  clock,
  fixture,
  overtimeAdjustments,
  overtimeFixtureCall,
  routeAttendanceApi,
  seedOvertimeReview,
  signIn,
} from "./support"

/** Workforce Logs viewers. */
export function workforceLogTests() {
  test("WC-07-F01 shows HR and the transfer's reset effects in the audit viewers", async ({
    page,
    browser,
  }) => {
    const requester = "wc07-requester"
    const overtime = await seedOvertimeReview("2026-11-13", false, requester)
    const response = await overtimeFixtureCall(
      requester,
      overtimeAdjustments,
      "POST",
      {
        requestKey: randomUUID(),
        startedAt: "2026-11-12T08:00:00+08:00",
        endedAt: "2026-11-12T10:00:00+08:00",
        reason: "Attendance correction before transfer",
      },
    )
    expect(response.status, await response.clone().text()).toBe(201)
    const { adjustment: correction } = (await response.json()) as {
      adjustment: { id: string }
    }
    for (const { id } of [correction, overtime]) {
      const verified = await overtimeFixtureCall(
        "wc07-origin-head",
        `${overtimeAdjustments}/${id}/review`,
        "POST",
        {
          decision: "APPROVED",
          note: "Verified before the transfer",
        },
      )
      expect(verified.status, await verified.clone().text()).toBe(200)
      expect(await verified.json()).toMatchObject({
        adjustment: { status: "VERIFIED" },
      })
    }
    const transfer = await overtimeFixtureCall(
      "admin",
      `/employees/${fixture.actors[requester].employeeId}`,
      "PUT",
      {
        departmentId: fixture.transferDestinationId,
      },
    )
    expect(transfer.status, await transfer.clone().text()).toBe(200)
    const correlationId = transfer.headers.get("x-correlation-id")
    if (!correlationId) throw new Error("Expected the transfer correlation ID")

    await signIn(page, "wc07-destination-head")
    await page.goto("/attendance/audit")
    await page
      .getByRole("searchbox", { name: "Search audit events" })
      .fill("Attendance admin")
    const audit = page.getByRole("table", { name: "Attendance audit events" })
    for (const label of ["attendance correction", "overtime request"]) {
      const reset = audit
        .getByRole("row")
        .filter({ hasText: `Updated an ${label}` })
      await expect(
        reset.getByText("Attendance admin", { exact: true }),
      ).toBeVisible()
    }

    const oversight = await browser.newContext()
    try {
      const logs = await oversight.newPage()
      await routeAttendanceApi(logs)
      await signIn(logs, "superadmin")
      await logs.goto("/module/attendance-monitoring/logs")
      await logs
        .getByRole("searchbox", { name: "Search logs" })
        .fill(correlationId)
      await logs
        .getByRole("button", {
          name: /View log: Changed department placement for Attendance wc07-requester/,
        })
        .click()
      const detail = logs.getByRole("dialog")
      await expect(
        detail.getByText("Employee department placement", { exact: true }),
      ).toBeVisible()
      await expect(
        detail.getByText("Attendance correction", { exact: true }),
      ).toBeVisible()
      await expect(
        detail.getByText("Overtime request", { exact: true }),
      ).toBeVisible()
      await expect(
        detail.getByText(correlationId, { exact: true }),
      ).toBeVisible()
    } finally {
      await oversight.close()
    }
  })

  test("WC-07-F02 keeps Workforce Logs search pages stable through a real employee rename", async ({
    page,
  }) => {
    await signIn(page, "superadmin")
    await page.goto("/module/attendance-monitoring/logs")
    const search = "Workforce Paging Needle"
    const matches = (pageNumber: number, term = search) =>
      page.waitForResponse((response) => {
        const url = new URL(response.url())
        return (
          url.pathname === "/api/workforce-compliance-logs" &&
          url.searchParams.get("search") === term &&
          url.searchParams.get("page") === String(pageNumber) &&
          response.ok()
        )
      })
    const firstResponse = matches(1)
    await page.getByRole("searchbox", { name: "Search logs" }).fill(search)
    const first = (await (await firstResponse).json()) as {
      snapshot: string
      asOf: string
    }
    expect(first.snapshot).toBeTruthy()
    await expect(page.getByText("Showing 1–25 of 27 logs")).toBeVisible()
    const rename = await overtimeFixtureCall(
      "admin",
      `/employees/${fixture.pagingEmployeeId}`,
      "PUT",
      { fullName: "Workforce Paging Renamed" },
    )
    expect(rename.status, await rename.clone().text()).toBe(200)

    const next = matches(2)
    const nextButton = page.getByRole("button", {
      name: "Next page",
      exact: true,
    })
    await nextButton.click()
    const second = await next
    const params = new URL(second.url()).searchParams
    expect(params.get("snapshot")).toBe(first.snapshot)
    expect(params.get("asOf")).toBe(first.asOf)
    const { events } = (await second.json()) as { events: { id: string }[] }
    expect(events.map(({ id }) => id)).toEqual([
      "attendance:browser-wc07-page-25",
      "attendance:browser-wc07-page-26",
    ])
    await expect(page.getByText("Showing 26–27 of 27 logs")).toBeVisible()

    await page
      .getByRole("button", { name: "Previous page", exact: true })
      .click()
    await expect(
      page.getByText(
        "Started an attendance session for Workforce Paging Renamed.",
        { exact: true },
      ),
    ).toBeVisible()
    await expect(page.getByText("Showing 1–25 of 27 logs")).toBeVisible()

    await page.route(
      "**/api/workforce-compliance-logs?**",
      (route) =>
        route.fulfill({
          status: 409,
          json: {
            error:
              "This log window is no longer available. Refresh logs to start again.",
          },
        }),
      { times: 1 },
    )
    await nextButton.click()
    await expect(
      page.getByText(/This log window is no longer available/),
    ).toBeVisible()
    const retry = matches(1)
    await page.getByRole("button", { name: "Try again" }).click()
    expect(new URL((await retry).url()).searchParams.has("snapshot")).toBe(
      false,
    )
    await expect(page.getByText("Showing 1–25 of 26 logs")).toBeVisible()
    await expect(
      page.getByText(
        "Started an attendance session for Workforce Paging Renamed.",
        { exact: true },
      ),
    ).toHaveCount(0)

    const refreshed = matches(1)
    await page.getByRole("button", { name: "Refresh logs" }).click()
    expect(new URL((await refreshed).url()).searchParams.has("asOf")).toBe(
      false,
    )
    await expect(page.getByText("Showing 1–25 of 26 logs")).toBeVisible()

    const changedSearch = "Workforce Paging Renamed"
    const changed = matches(1, changedSearch)
    await page
      .getByRole("searchbox", { name: "Search logs" })
      .fill(changedSearch)
    expect(new URL((await changed).url()).searchParams.has("snapshot")).toBe(
      false,
    )
    await expect(page.getByText("Showing 1–1 of 1 logs")).toBeVisible()
  })

  test("WC-07-F03 shows suspension and reconciliation details from the real backend", async ({
    page,
  }) => {
    const actor = "wc07-reconcile"
    const { employeeId } = fixture.actors[actor]
    await clock("2026-11-13T08:00:00+08:00")
    const opened = await overtimeFixtureCall(
      actor,
      "/attendance/me/clock-in",
      "POST",
      {},
    )
    expect(opened.status, await opened.clone().text()).toBe(201)
    const { workday } = (await opened.json()) as {
      workday: { activeSessionId: string }
    }
    const disabled = await overtimeFixtureCall(
      "admin",
      `/employees/${employeeId}/account/status`,
      "PATCH",
      { isActive: false },
    )
    expect(disabled.status, await disabled.clone().text()).toBe(204)
    const endedAt = "2026-11-13T18:00:00+08:00"
    const note = "Private reconciliation browser reason"
    await clock(endedAt)
    const reconciled = await overtimeFixtureCall(
      "admin",
      `/attendance/employees/${employeeId}/sessions/${workday.activeSessionId}/reconcile`,
      "POST",
      { endedAt, note },
    )
    expect(reconciled.status, await reconciled.clone().text()).toBe(200)

    await signIn(page, "superadmin")
    await page.goto("/module/attendance-monitoring/logs")
    const search = page.getByRole("searchbox", { name: "Search logs" })
    async function openLog(response: Response, message: string) {
      const trace = response.headers.get("x-correlation-id")
      if (!trace) throw new Error("Expected the operation correlation ID")
      await search.fill(trace)
      await page
        .getByRole("button", {
          name: `View log: ${message} for Attendance wc07-reconcile.`,
        })
        .click()
      const detail = page.getByRole("dialog")
      await expect(detail.getByText(trace, { exact: true })).toBeVisible()
      await expect(
        detail.getByText("Attendance admin", { exact: true }).first(),
      ).toBeVisible()
      return detail
    }
    const suspension = await openLog(
      disabled,
      "Suspended an open attendance session",
    )
    await expect(
      suspension.getByText("Suspension time", { exact: true }),
    ).toBeVisible()
    await suspension.getByRole("button", { name: "Close log details" }).click()
    const reconciliation = await openLog(
      reconciled,
      "Reconciled a suspended attendance session",
    )
    await expect(
      reconciliation.getByText("End time", { exact: true }),
    ).toBeVisible()
    await expect(
      reconciliation
        .getByText("2026-11-13T10:00:00+00:00", { exact: true })
        .first(),
    ).toBeVisible()
    await expect(
      reconciliation.getByText("Overtime request", { exact: true }),
    ).toBeVisible()
    await expect(
      reconciliation.getByText("Overtime minutes", { exact: true }),
    ).toBeVisible()
    await expect(reconciliation.getByText(note, { exact: true })).toHaveCount(0)
  })

  test("WC-07-F04 finds the same real Workforce Logs pages by area name and code", async ({
    page,
  }) => {
    await signIn(page, "superadmin")
    await page.goto("/module/attendance-monitoring/logs")
    await page.getByLabel("Filter by area").click()
    await page.getByRole("option", { name: "Time Logs", exact: true }).click()
    const search = page.getByRole("searchbox", { name: "Search logs" })
    const next = page.getByRole("button", { name: "Next page", exact: true })

    function waitForPage(term: string, pageNumber: number) {
      return page.waitForResponse((response) => {
        const url = new URL(response.url())
        return (
          url.pathname === "/api/workforce-compliance-logs" &&
          url.searchParams.get("source") === "time-logs" &&
          url.searchParams.get("search") === term &&
          url.searchParams.get("page") === String(pageNumber) &&
          response.ok()
        )
      })
    }
    type LogPage = {
      total: number
      snapshot: string
      asOf: string
      events: { id: string }[]
    }
    async function searchPages(term: string) {
      const firstResponse = waitForPage(term, 1)
      await search.fill(term)
      const first = (await (await firstResponse).json()) as LogPage
      expect(first.total).toBeGreaterThan(25)
      await expect(
        page.getByText(`Showing 1–25 of ${first.total} logs`),
      ).toBeVisible()

      const secondResponse = waitForPage(term, 2)
      await next.click()
      const response = await secondResponse
      const params = new URL(response.url()).searchParams
      expect(params.get("snapshot")).toBe(first.snapshot)
      expect(params.get("asOf")).toBe(first.asOf)
      const second = (await response.json()) as LogPage
      expect(second.total).toBe(first.total)
      await expect(
        page.getByText(
          `Showing 26–${Math.min(50, first.total)} of ${first.total} logs`,
        ),
      ).toBeVisible()
      return {
        total: first.total,
        ids: [...first.events, ...second.events].map(({ id }) => id),
      }
    }

    const byName = await searchPages("Time Logs")
    expect(await searchPages("time-logs")).toEqual(byName)
  })
}
