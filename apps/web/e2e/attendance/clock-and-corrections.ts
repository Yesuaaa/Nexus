import { test, expect } from "@playwright/test"
import { randomUUID } from "node:crypto"
import type {
  AttendanceHistory,
  AttendanceState,
  AttendanceWorkday,
} from "../../src/features/attendance/api/attendance-api"
import {
  api,
  clock,
  confirm,
  fixture,
  overtimeAdjustments,
  overtimeFixtureCall,
  overtimeResponse,
  overtimeRowMenu,
  signIn,
} from "./support"

/** Clocking, breaks and submitted corrections. */
export function clockAndCorrectionTests() {
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
    // PG-006-F001-A003-T007 adds visible workday/progress assertions to this
    // existing persistence-backed clocking flow.
    await expect(page.getByText("Clocked in", { exact: true })).toBeVisible()
    const daily = page.getByRole("region", { name: "Daily required hours" })
    await expect(
      daily.getByRole("progressbar", {
        name: "Daily required-hours progress",
      }),
    ).toHaveAttribute("aria-valuenow", "100")
    await expect(daily).toContainText("8.00")
    await expect(daily).toContainText("8 hours")
    await expect(daily.getByText("Daily requirement complete")).toBeVisible()
    await expect(daily.getByText("Browser flexible policy")).toBeVisible()
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

    // PG-006-F001-A009-T017 adds deterministic assertions for optional row
    // fields while retaining the real persistence assertions above.
    const summaryPage = await page.context().newPage()
    await signIn(summaryPage, "staff")
    const summaryState: AttendanceState = {
      asOf: "2026-11-14T04:00:00.000Z",
      employeeId: fixture.actors.staff.employeeId,
      needsPolicy: true,
      workday: null,
    }
    const summarySession = {
      id: "pg006-summary-session",
      startedAt: "2026-11-13T12:00:00.000Z",
      endedAt: "2026-11-13T20:00:00.000Z",
      breaks: [],
    }
    const summaryWorkday: AttendanceWorkday = {
      id: "pg006-summary-workday",
      employeeId: fixture.actors.staff.employeeId,
      workDate: "2026-11-13",
      timeZone: "Asia/Manila",
      isWorkingDay: true,
      requiredMinutes: 480,
      workedMilliseconds: 8 * 60 * 60 * 1000,
      workedHours: 8,
      remainingMinutes: 0,
      excessMinutes: 0,
      excessRequiresReview: false,
      progressPercent: 100,
      status: "COMPLETE",
      isComplete: true,
      activeSessionId: null,
      activeBreakId: null,
      sessions: [summarySession],
      policy: {
        id: "pg006-summary-policy",
        name: "PG-006 scheduled policy",
        unpaidBreaksEnabled: true,
        overnightRequiresReview: false,
      },
      schedule: {
        startsAt: "09:00",
        endsAt: "17:00",
        unpaidBreakMinutes: 30,
        lateArrivalMinutes: 15,
        earlyDepartureMinutes: 20,
      },
      overnightRequiresReview: false,
      pendingCorrections: 1,
    }
    const summaryHistory: AttendanceHistory = {
      asOf: summaryState.asOf,
      employeeId: fixture.actors.staff.employeeId,
      total: 1,
      page: 1,
      pageSize: 20,
      workdays: [summaryWorkday],
    }
    await summaryPage.route("**/api/attendance/me/current", (route) =>
      route.fulfill({ json: summaryState }),
    )
    await summaryPage.route("**/api/attendance/me/history**", (route) =>
      route.fulfill({ json: summaryHistory }),
    )
    await summaryPage.goto("/attendance/check-ins?pg006-summary=1")
    const summaryRow = summaryPage
      .getByRole("table", { name: "Attendance history" })
      .getByRole("row")
      .filter({ hasText: "2026-11-13" })
    await expect(summaryRow).toContainText("Nov 13, 2026, 8:00 PM")
    await expect(summaryRow).toContainText("Nov 14, 2026, 4:00 AM")
    await expect(summaryRow).toContainText("08:00:00 / 8h")
    await expect(summaryRow).toContainText("Complete")
    await expect(summaryRow).toContainText("Overnight")
    await expect(summaryRow).toContainText("Correction pending")
    await expect(summaryRow).toContainText("Late arrival")
    await expect(summaryRow).toContainText("Early departure")
    await summaryPage.close()

    await page.goto("/employees")
    await expect(page).toHaveURL(/\/module$/)
  })

  test("[PG-006-F001-A004-T009] the page continues the prior overnight workday and persists the added session", async ({
    page,
  }) => {
    await clock("2026-12-07T20:00:00+08:00")
    const overnightActor = fixture.actors["pg006-overnight"]
    const overnightHeaders = {
      authorization: `Bearer ${overnightActor.token}`,
      "content-type": "application/json",
    }
    const started = await fetch(`${api}/api/attendance/me/clock-in`, {
      method: "POST",
      headers: overnightHeaders,
      body: "{}",
    })
    expect(started.status, await started.clone().text()).toBe(201)
    const startState = (await started.json()) as {
      workday: { id: string; activeSessionId: string }
    }
    const workdayId = startState.workday.id
    const firstSessionId = startState.workday.activeSessionId

    await clock("2026-12-08T04:00:00+08:00")
    const firstClockOut = await fetch(`${api}/api/attendance/me/clock-out`, {
      method: "POST",
      headers: overnightHeaders,
      body: JSON.stringify({ sessionId: firstSessionId }),
    })
    expect(firstClockOut.status, await firstClockOut.clone().text()).toBe(200)
    await clock("2026-12-08T04:30:00+08:00")

    await signIn(page, "pg006-overnight")
    await page.goto("/attendance/check-ins")
    const continueButton = page.getByRole("button", {
      name: "Continue 2026-12-07",
      exact: true,
    })
    await expect(continueButton).toBeVisible()
    await continueButton.click()
    const dialog = page.getByRole("dialog")
    const continuationRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/attendance/me/clock-in",
    )
    await dialog
      .getByRole("button", { name: "Continue overnight workday", exact: true })
      .click()
    const posted = await continuationRequest
    expect(
      JSON.parse(posted.postData() ?? "{}") as { workdayId?: string },
    ).toEqual({ workdayId })
    await expect(dialog).toHaveCount(0)
    await expect(page.getByText("Clocked in", { exact: true })).toBeVisible()

    await clock("2026-12-08T05:30:00+08:00")
    await confirm(page, "Clock out")
    const historyResponse = await fetch(
      `${api}/api/attendance/me/history?from=2026-12-07&to=2026-12-08`,
      { headers: { authorization: `Bearer ${overnightActor.token}` } },
    )
    expect(historyResponse.status).toBe(200)
    const history = (await historyResponse.json()) as {
      workdays: {
        id: string
        workDate: string
        requiredMinutes: number
        workedHours: number
        sessions: { id: string }[]
      }[]
    }
    expect(history.workdays).toEqual([
      expect.objectContaining({
        id: workdayId,
        workDate: "2026-12-07",
        requiredMinutes: 480,
        workedHours: 9,
        sessions: [
          expect.objectContaining({ id: firstSessionId }),
          expect.objectContaining({ id: expect.any(String) }),
        ],
      }),
    ])
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
    await expect(
      page.getByText("On unpaid break", { exact: true }),
    ).toBeVisible()
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

  test("[PG-004-F001-A006-T008] mixed queue submits and reloads a persisted correction", async ({
    page,
  }) => {
    const reason = `PG-004 direct correction ${randomUUID()}`
    await clock("2026-11-17T12:00:00+08:00")
    await signIn(page, "staff")
    await page.goto("/attendance/adjustments")
    await page
      .getByRole("button", { name: "Request correction", exact: true })
      .click()
    const dialog = page.getByRole("dialog", {
      name: "Request missing attendance",
    })
    await dialog
      .getByLabel("Actual clock-in", { exact: true })
      .fill("2026-11-16T09:00")
    await dialog
      .getByLabel("Actual clock-out", { exact: true })
      .fill("2026-11-16T10:00")
    await dialog.getByLabel("Reason", { exact: true }).fill(reason)

    const submitted = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/attendance/adjustments",
    )
    const refreshed = page
      .waitForResponse((response) => {
        const url = new URL(response.url())
        return (
          response.request().method() === "GET" &&
          url.pathname === "/api/attendance/adjustments" &&
          url.searchParams.get("scope") === "mine"
        )
      })
      .catch(() => undefined)
    await dialog
      .getByRole("button", { name: "Submit request", exact: true })
      .click()
    const createdResponse = await submitted
    const createdBody = await createdResponse.text()
    expect(createdResponse.status(), createdBody).toBe(201)
    const { adjustment: created } = JSON.parse(createdBody) as {
      adjustment: {
        id: string
        type: string
        status: string
        requestedById: string
        reason: string
      }
    }
    expect(created).toMatchObject({
      type: "CORRECTION",
      status: "PENDING",
      requestedById: fixture.actors.staff.userId,
      reason,
    })
    expect((await refreshed)?.status()).toBe(200)
    await expect(dialog).toHaveCount(0)
    await expect(
      page.getByText("Correction requested", { exact: true }),
    ).toBeVisible()
    const row = page.getByRole("row").filter({ hasText: reason })
    await expect(row.getByText("Correction", { exact: true })).toBeVisible()
    await expect(row.getByText("Pending", { exact: true })).toBeVisible()

    const persisted = await overtimeFixtureCall(
      "staff",
      `${overtimeAdjustments}/${created.id}`,
    )
    expect(persisted.status, await persisted.clone().text()).toBe(200)
    expect(await persisted.json()).toMatchObject({
      adjustment: {
        id: created.id,
        type: "CORRECTION",
        status: "PENDING",
        requestedById: fixture.actors.staff.userId,
        reason,
      },
    })
  })

  test("[PG-010-F001-A015-T019] Corrections route submission persists through Next, Express, and PGlite", async ({
    page,
  }) => {
    const reason = `PG-010 integrated correction ${randomUUID()}`
    await clock("2026-11-24T12:00:00+08:00")
    await signIn(page, "staff")
    await page.goto("/attendance/requests/corrections")
    await expect(
      page.getByRole("heading", { name: "Attendance Corrections" }),
    ).toBeVisible()
    await page
      .getByRole("button", { name: "Request correction", exact: true })
      .click()
    const dialog = page.getByRole("dialog", {
      name: "Request missing attendance",
    })
    await dialog
      .getByLabel("Actual clock-in", { exact: true })
      .fill("2026-11-23T09:00")
    await dialog
      .getByLabel("Actual clock-out", { exact: true })
      .fill("2026-11-23T10:00")
    await dialog.getByLabel("Reason", { exact: true }).fill(reason)

    const submitted = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/api/attendance/adjustments",
    )
    const refreshed = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return (
        response.request().method() === "GET" &&
        url.pathname === "/api/attendance/adjustments" &&
        url.searchParams.get("type") === "CORRECTION"
      )
    })
    await dialog
      .getByRole("button", { name: "Submit request", exact: true })
      .click()
    const createdResponse = await submitted
    const createdText = await createdResponse.text()
    expect(createdResponse.status(), createdText).toBe(201)
    const payload = createdResponse.request().postDataJSON() as {
      type?: string
      requestKey: string
      sessionId?: string
      startedAt: string
      endedAt: string
      reason: string
    }
    expect(payload.type).toBe("CORRECTION")
    expect(payload.requestKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(payload.sessionId).toBeUndefined()
    expect(payload.reason).toBe(reason)
    expect(Date.parse(payload.startedAt)).not.toBeNaN()
    expect(Date.parse(payload.endedAt)).not.toBeNaN()

    const { adjustment: created } = JSON.parse(createdText) as {
      adjustment: {
        id: string
        type: string
        status: string
        requestedById: string
        sessionId: string | null
        reason: string
        proposedStartedAt: string
        proposedEndedAt: string
      }
    }
    expect(created).toMatchObject({
      type: "CORRECTION",
      status: "PENDING",
      requestedById: fixture.actors.staff.userId,
      sessionId: null,
      reason,
      proposedStartedAt: new Date(payload.startedAt).toISOString(),
      proposedEndedAt: new Date(payload.endedAt).toISOString(),
    })
    expect((await refreshed).status()).toBe(200)
    await expect(dialog).toHaveCount(0)
    await expect(
      page.getByText("Correction requested", { exact: true }),
    ).toBeVisible()
    const row = page.getByRole("row").filter({ hasText: reason })
    await expect(row.getByText("Correction", { exact: true })).toBeVisible()
    await expect(row.getByText("Pending", { exact: true })).toBeVisible()

    const persisted = await overtimeFixtureCall(
      "staff",
      `${overtimeAdjustments}/${created.id}`,
    )
    expect(persisted.status, await persisted.clone().text()).toBe(200)
    expect(await persisted.json()).toMatchObject({
      adjustment: {
        id: created.id,
        type: "CORRECTION",
        status: "PENDING",
        requestedById: fixture.actors.staff.userId,
        sessionId: null,
        reason,
        proposedStartedAt: created.proposedStartedAt,
        proposedEndedAt: created.proposedEndedAt,
      },
    })
    const inbox = await overtimeFixtureCall(
      "head",
      "/request-workflows/notifications",
    )
    expect(inbox.status, await inbox.clone().text()).toBe(200)
    const { notifications } = (await inbox.json()) as {
      notifications: { type: string; entityId: string }[]
    }
    expect(
      notifications.some(
        ({ type, entityId }) =>
          type === "ATTENDANCE_CORRECTION_PENDING" && entityId === created.id,
      ),
    ).toBe(true)
  })

  test("[PG-004-F001-A009-T014] mixed queue finalizes and rejects corrections", async ({
    page,
  }) => {
    await clock("2026-11-20T12:00:00+08:00")
    const approvedReason = `PG-004 HR approval ${randomUUID()}`
    const rejectedReason = `PG-004 HR rejection ${randomUUID()}`
    const approvedTimes = {
      startedAt: "2026-11-18T02:00:00.000Z",
      endedAt: "2026-11-18T03:00:00.000Z",
    }
    const rejectedTimes = {
      startedAt: "2026-11-19T02:00:00.000Z",
      endedAt: "2026-11-19T03:00:00.000Z",
    }

    async function submitCorrection(
      reason: string,
      times: typeof approvedTimes,
    ) {
      const response = await overtimeFixtureCall(
        "staff",
        overtimeAdjustments,
        "POST",
        {
          type: "CORRECTION",
          requestKey: randomUUID(),
          ...times,
          reason,
        },
      )
      expect(response.status, await response.clone().text()).toBe(201)
      return ((await response.json()) as { adjustment: { id: string } })
        .adjustment.id
    }

    const approvedId = await submitCorrection(approvedReason, approvedTimes)
    const rejectedId = await submitCorrection(rejectedReason, rejectedTimes)
    const verification = await overtimeFixtureCall(
      "head",
      `${overtimeAdjustments}/${approvedId}/review`,
      "POST",
      {
        decision: "APPROVED",
        note: "Department Head verified this correction",
      },
    )
    expect(verification.status, await verification.clone().text()).toBe(200)
    expect(await verification.json()).toMatchObject({
      adjustment: { id: approvedId, status: "VERIFIED" },
    })
    const rejectedVerification = await overtimeFixtureCall(
      "head",
      `${overtimeAdjustments}/${rejectedId}/review`,
      "POST",
      {
        decision: "APPROVED",
        note: "Department Head verified the second correction",
      },
    )
    expect(
      rejectedVerification.status,
      await rejectedVerification.clone().text(),
    ).toBe(200)
    expect(await rejectedVerification.json()).toMatchObject({
      adjustment: { id: rejectedId, status: "VERIFIED" },
    })

    const rejectionHistoryBefore = await overtimeFixtureCall(
      "staff",
      "/attendance/me/history?from=2026-11-19&to=2026-11-19",
    )
    expect(rejectionHistoryBefore.status).toBe(200)
    const before = (await rejectionHistoryBefore.json()) as {
      workdays: { sessions: { startedAt: string; endedAt: string | null }[] }[]
    }

    await signIn(page, "admin")
    await page.goto("/attendance/adjustments")
    await expect(
      page.getByRole("row").filter({ hasText: approvedReason }),
    ).toBeVisible()
    await expect(
      page.getByRole("row").filter({ hasText: rejectedReason }),
    ).toBeVisible()

    const approvedMenu = overtimeRowMenu(page, approvedId)
    await approvedMenu.click()
    await page
      .getByRole("menuitem", { name: "Approve request", exact: true })
      .click()
    const approvalPanel = page.getByRole("dialog", {
      name: "Approve attendance correction",
    })
    await approvalPanel
      .getByRole("textbox", { name: "Review note", exact: true })
      .fill("HR approved the verified correction")
    const approvedResponse = overtimeResponse(
      page,
      "POST",
      `${overtimeAdjustments}/${approvedId}/review`,
    )
    await approvalPanel
      .getByRole("button", { name: "Confirm decision", exact: true })
      .click()
    const approvalResult = await approvedResponse
    expect(approvalResult.status()).toBe(200)
    expect(await approvalResult.json()).toMatchObject({
      adjustment: { id: approvedId, status: "APPROVED" },
    })
    await expect(approvalPanel).toHaveCount(0)
    await expect(
      page.getByRole("row").filter({ hasText: approvedReason }),
    ).toContainText("Approved")

    const rejectedMenu = overtimeRowMenu(page, rejectedId)
    await rejectedMenu.click()
    await page
      .getByRole("menuitem", { name: "Reject request", exact: true })
      .click()
    const rejectionPanel = page.getByRole("dialog", {
      name: "Reject attendance correction",
    })
    await rejectionPanel
      .getByRole("textbox", { name: "Review note", exact: true })
      .fill("HR rejected the unsupported correction")
    const rejectedResponse = overtimeResponse(
      page,
      "POST",
      `${overtimeAdjustments}/${rejectedId}/review`,
    )
    await rejectionPanel
      .getByRole("button", { name: "Confirm decision", exact: true })
      .click()
    const rejectionResult = await rejectedResponse
    expect(rejectionResult.status()).toBe(200)
    expect(await rejectionResult.json()).toMatchObject({
      adjustment: { id: rejectedId, status: "REJECTED" },
    })
    await expect(rejectionPanel).toHaveCount(0)
    await expect(
      page.getByRole("row").filter({ hasText: rejectedReason }),
    ).toContainText("Rejected")

    const [approvedDetail, rejectedDetail, approvedHistory, rejectedHistory] =
      await Promise.all([
        overtimeFixtureCall("staff", `${overtimeAdjustments}/${approvedId}`),
        overtimeFixtureCall("staff", `${overtimeAdjustments}/${rejectedId}`),
        overtimeFixtureCall(
          "staff",
          "/attendance/me/history?from=2026-11-18&to=2026-11-18",
        ),
        overtimeFixtureCall(
          "staff",
          "/attendance/me/history?from=2026-11-19&to=2026-11-19",
        ),
      ])
    for (const response of [
      approvedDetail,
      rejectedDetail,
      approvedHistory,
      rejectedHistory,
    ])
      expect(response.status, await response.clone().text()).toBe(200)
    expect(await approvedDetail.json()).toMatchObject({
      adjustment: { id: approvedId, status: "APPROVED" },
    })
    expect(await rejectedDetail.json()).toMatchObject({
      adjustment: { id: rejectedId, status: "REJECTED" },
    })
    const approved = (await approvedHistory.json()) as {
      workdays: { sessions: { startedAt: string; endedAt: string | null }[] }[]
    }
    const rejected = (await rejectedHistory.json()) as {
      workdays: { sessions: { startedAt: string; endedAt: string | null }[] }[]
    }
    expect(approved.workdays.flatMap(({ sessions }) => sessions)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          startedAt: approvedTimes.startedAt,
          endedAt: approvedTimes.endedAt,
        }),
      ]),
    )
    expect(rejected.workdays.flatMap(({ sessions }) => sessions)).toEqual(
      before.workdays.flatMap(({ sessions }) => sessions),
    )
  })
}
