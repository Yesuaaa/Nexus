import { test, expect, type Page } from "@playwright/test"
import { randomUUID } from "node:crypto"

import {
  api,
  approveCorrection,
  clock,
  createApprovedCorrection,
  fixture,
  routeAttendanceApi,
  signIn,
} from "./support"

/** Device-zone corrections and replacement Head notices. */
export function correctionNoticeTests() {
  test.describe("device-zone correction timestamps", () => {
    test.use({ timezoneId: "America/Los_Angeles" })
    const actor = "correction-dst"

    test.beforeEach(async ({ page }) => {
      await clock("2026-11-13T20:00:00+08:00")
      await page.clock.setFixedTime(new Date("2026-11-13T12:00:00Z"))
      await signIn(page, actor)
    })

    async function readAttendance(path: string): Promise<unknown> {
      const response = await fetch(`${api}/api/attendance${path}`, {
        headers: { authorization: `Bearer ${fixture.actors[actor].token}` },
      })
      expect(response.status).toBe(200)
      return response.json()
    }

    async function missingSession(page: Page, start: string, end: string) {
      await page
        .getByRole("button", { name: "Request correction", exact: true })
        .click()
      const dialog = page.getByRole("dialog", {
        name: "Request missing attendance",
      })
      await expect(
        dialog.getByText(/device timezone \(America\/Los_Angeles\)/),
      ).toBeVisible()
      await dialog.getByLabel("Actual clock-in", { exact: true }).fill(start)
      await dialog.getByLabel("Actual clock-out", { exact: true }).fill(end)
      await dialog
        .getByLabel("Reason", { exact: true })
        .fill("Record the actual local working times")
      return dialog
    }

    async function submitAndApprove(
      page: Page,
      timestamps: {
        startedAt: string
        endedAt: string
        sessionId?: string
      },
    ) {
      const response = page.waitForResponse(
        (item) =>
          item.request().method() === "POST" &&
          new URL(item.url()).pathname === "/api/attendance/adjustments",
      )
      await page
        .getByRole("button", { name: "Submit request", exact: true })
        .click()
      const posted = await response
      expect(posted.status(), await posted.text()).toBe(201)
      expect(posted.request().postDataJSON()).toMatchObject(timestamps)
      const { adjustment } = (await posted.json()) as {
        adjustment: { id: string }
      }
      expect(adjustment).toMatchObject({
        proposedStartedAt: timestamps.startedAt,
        proposedEndedAt: timestamps.endedAt,
        sessionId: timestamps.sessionId ?? null,
      })
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await approveCorrection(adjustment.id)
    }

    test("spring gaps in either field leave requests and attendance unchanged", async ({
      page,
    }) => {
      const historyPath = "/me/history?from=2026-03-08&to=2026-03-09"
      const listPath = "/adjustments?scope=mine&type=CORRECTION"
      const before = await readAttendance(historyPath)
      const beforeRequests = await readAttendance(listPath)
      let posts = 0
      page.on("request", (request) => {
        if (
          request.method() === "POST" &&
          new URL(request.url()).pathname === "/api/attendance/adjustments"
        )
          posts++
      })
      await page.goto("/attendance/requests/corrections")
      const dialog = await missingSession(
        page,
        "2026-03-08T02:30",
        "2026-03-08T04:00",
      )
      const clockIn = dialog.getByLabel("Actual clock-in", { exact: true })
      const clockOut = dialog.getByLabel("Actual clock-out", { exact: true })
      const submit = dialog.getByRole("button", {
        name: "Submit request",
        exact: true,
      })
      await submit.click()
      await expect(dialog.getByRole("alert")).toHaveText(
        "Actual clock-in is not a valid local time in America/Los_Angeles. Choose another time.",
      )
      await expect(clockIn).toHaveValue("2026-03-08T02:30")
      await expect(clockIn).toHaveAttribute("aria-invalid", "true")
      await clockIn.fill("2026-03-08T01:30")
      await clockOut.fill("2026-03-08T02:30")
      await submit.click()
      await expect(dialog.getByRole("alert")).toHaveText(
        "Actual clock-out is not a valid local time in America/Los_Angeles. Choose another time.",
      )
      await expect(clockOut).toHaveValue("2026-03-08T02:30")
      await expect(dialog.getByRole("combobox")).toHaveCount(0)
      expect(posts).toBe(0)
      expect(await readAttendance(listPath)).toEqual(beforeRequests)
      expect(await readAttendance(historyPath)).toEqual(before)
    })

    test("fall offsets determine ordering and the approved 30-minute interval", async ({
      page,
    }) => {
      const historyPath = "/me/history?from=2026-11-01&to=2026-11-01"
      const listPath = "/adjustments?scope=mine&type=CORRECTION"
      const before = await readAttendance(historyPath)
      const beforeRequests = await readAttendance(listPath)
      await page.goto("/attendance/requests/corrections")
      const dialog = await missingSession(
        page,
        "2026-11-01T01:45",
        "2026-11-01T01:15",
      )
      const clockOut = dialog.getByLabel("Actual clock-out", { exact: true })
      await clockOut.press("Alt+ArrowDown")
      await page
        .getByRole("button", { name: "Apply date & time", exact: true })
        .click()
      await expect(clockOut).toHaveValue("2026-11-01T01:15")
      const submit = dialog.getByRole("button", {
        name: "Submit request",
        exact: true,
      })
      await submit.click()
      await expect(dialog.getByRole("alert")).toHaveText(
        "Choose a UTC offset for actual clock-in.",
      )
      const startOffset = dialog.getByRole("combobox", {
        name: "Actual clock-in occurrence",
      })
      const endOffset = dialog.getByRole("combobox", {
        name: "Actual clock-out occurrence",
      })
      await startOffset.click()
      await page.getByRole("option", { name: "UTC-08:00", exact: true }).click()
      await endOffset.click()
      await page.getByRole("option", { name: "UTC-07:00", exact: true }).click()
      await submit.click()
      await expect(dialog.getByRole("alert")).toHaveText(
        "Actual clock-out must be after actual clock-in.",
      )
      expect(await readAttendance(listPath)).toEqual(beforeRequests)
      expect(await readAttendance(historyPath)).toEqual(before)
      await startOffset.click()
      await page.getByRole("option", { name: "UTC-07:00", exact: true }).click()
      await endOffset.click()
      await page.getByRole("option", { name: "UTC-08:00", exact: true }).click()
      const timestamps = {
        startedAt: "2026-11-01T08:45:00.000Z",
        endedAt: "2026-11-01T09:15:00.000Z",
      }
      await submitAndApprove(page, timestamps)
      expect(await readAttendance(historyPath)).toMatchObject({
        total: 1,
        workdays: [
          {
            workDate: "2026-11-01",
            timeZone: "Asia/Manila",
            workedMinutes: 30,
            requiredMinutes: 480,
            sessions: [timestamps],
          },
        ],
      })
    })

    test("existing-session prefills retain the recorded repeated offset and seconds", async ({
      page,
    }) => {
      const startedAt = "2026-11-01T09:25:12.345Z"
      const endedAt = "2026-11-01T09:40:12.345Z"
      await createApprovedCorrection(
        startedAt,
        endedAt,
        "Seed recorded second-occurrence timestamps",
        actor,
      )
      const historyPath = "/me/history?from=2026-11-01&to=2026-11-01"
      const before = await readAttendance(historyPath)
      const { workdays } = before as {
        workdays: { sessions: { id: string; startedAt: string }[] }[]
      }
      const session = workdays[0].sessions.find(
        (item) => item.startedAt === startedAt,
      )
      expect(session).toBeDefined()
      await page.goto("/attendance/check-ins")
      await page
        .getByRole("table", { name: "Attendance history" })
        .last()
        .getByRole("button", { name: "Actions for 2026-11-01", exact: true })
        .click()
      await page
        .getByRole("menuitem", { name: "View details", exact: true })
        .click()
      await page
        .getByRole("button", { name: "Request correction", exact: true })
        .last()
        .click()
      const dialog = page.getByRole("dialog", {
        name: "Request attendance correction",
      })
      await expect(
        dialog.getByLabel("Actual clock-in", { exact: true }),
      ).toHaveValue("2026-11-01T01:25")
      await expect(
        dialog.getByLabel("Actual clock-out", { exact: true }),
      ).toHaveValue("2026-11-01T01:40")
      await expect(
        dialog.getByRole("combobox", { name: "Actual clock-in occurrence" }),
      ).toHaveText("UTC-08:00")
      await expect(
        dialog.getByRole("combobox", { name: "Actual clock-out occurrence" }),
      ).toHaveText("UTC-08:00")
      await dialog
        .getByLabel("Reason", { exact: true })
        .fill("Confirm the existing timestamps at their original offset")
      await submitAndApprove(page, {
        startedAt,
        endedAt,
        sessionId: session!.id,
      })
      expect(await readAttendance(historyPath)).toEqual(before)
    })

    test("ordinary overnight entries follow the policy workday", async ({
      page,
    }) => {
      await page.goto("/attendance/requests/corrections")
      const deviceOvernight = {
        startedAt: "2026-11-06T07:30:00.000Z",
        endedAt: "2026-11-06T09:15:00.000Z",
      }
      const policyOvernight = {
        startedAt: "2026-11-05T15:30:00.000Z",
        endedAt: "2026-11-05T17:15:00.000Z",
      }
      for (const [start, end, timestamps] of [
        ["2026-11-05T23:30", "2026-11-06T01:15", deviceOvernight],
        ["2026-11-05T07:30", "2026-11-05T09:15", policyOvernight],
      ] as const) {
        const dialog = await missingSession(page, start, end)
        await expect(dialog.getByRole("combobox")).toHaveCount(0)
        await submitAndApprove(page, timestamps)
      }
      expect(
        await readAttendance("/me/history?from=2026-11-05&to=2026-11-06"),
      ).toMatchObject({
        total: 2,
        workdays: [
          {
            workDate: "2026-11-06",
            timeZone: "Asia/Manila",
            workedMinutes: 105,
            hasOvernightSessions: false,
            sessions: [deviceOvernight],
          },
          {
            workDate: "2026-11-05",
            timeZone: "Asia/Manila",
            workedMinutes: 105,
            hasOvernightSessions: true,
            sessions: [policyOvernight],
          },
        ],
      })
    })
  })

  test("replacement Head opens and marks a real pending correction notice", async ({
    page,
  }) => {
    const reason = "Record the shift before the browser Head handoff"
    function request(
      actor: string,
      path: string,
      method = "GET",
      body?: object,
    ) {
      return fetch(`${api}/api${path}`, {
        method,
        headers: {
          authorization: `Bearer ${fixture.actors[actor].token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      })
    }
    const submitted = await request(
      "staff",
      "/attendance/adjustments",
      "POST",
      {
        requestKey: randomUUID(),
        startedAt: "2026-10-29T02:15:00.000Z",
        endedAt: "2026-10-29T02:45:00.000Z",
        reason,
      },
    )
    expect(submitted.status, await submitted.clone().text()).toBe(201)
    const { adjustment } = (await submitted.json()) as {
      adjustment: { id: string }
    }
    const path = `/attendance/adjustments/${adjustment.id}`
    const formerDetail = await request("head", path)
    expect(formerDetail.status).toBe(200)
    const {
      adjustment: {
        employee: { departmentId },
      },
    } = (await formerDetail.json()) as {
      adjustment: { employee: { departmentId: string } }
    }
    const link = `/attendance/requests/corrections?request=${adjustment.id}`
    async function pendingNotice(actor: string) {
      const response = await request(actor, "/request-workflows/notifications")
      expect(response.status).toBe(200)
      const { notifications } = (await response.json()) as {
        notifications: {
          id: string
          entityId: string
          type: string
          readAt: string | null
        }[]
      }
      return notifications.find(
        (item) =>
          item.entityId === adjustment.id &&
          item.type === "ATTENDANCE_CORRECTION_PENDING",
      )
    }
    async function setHead(actor: string) {
      const response = await request(
        "admin",
        `/departments/${departmentId}`,
        "PUT",
        {
          headId: fixture.actors[actor].userId,
        },
      )
      expect(response.status, await response.text()).toBe(200)
    }
    expect(await pendingNotice("head")).toBeDefined()
    await setHead("correction-dst")
    try {
      expect((await request("head", path)).status).toBe(404)
      expect(await pendingNotice("head")).toBeUndefined()
      expect(await pendingNotice("correction-dst")).toMatchObject({
        readAt: null,
      })
      await page.unroute("**/api/**")
      await routeAttendanceApi(page, { realNotifications: true })
      await signIn(page, "correction-dst")
      await page.goto("/attendance/check-ins")
      await page
        .getByRole("button", { name: /^Notifications, \d+ unread$/ })
        .click()
      await page
        .getByRole("menuitem", {
          name: /attendance correction awaiting department verification/,
        })
        .and(page.locator(`[href="${link}"]`))
        .click()
      await expect(page).toHaveURL((url) => url.pathname + url.search === link)
      const detail = page.getByRole("dialog", { name: "Attendance correction" })
      await expect(detail.getByText(reason, { exact: true })).toBeVisible()
      await expect
        .poll(async () => (await pendingNotice("correction-dst"))?.readAt)
        .toEqual(expect.any(String))
    } finally {
      await setHead("head")
    }
  })

  test("replacement Head opens and marks a real pending overtime notice", async ({
    page,
  }) => {
    function request(
      actor: string,
      path: string,
      method = "GET",
      body?: object,
    ) {
      return fetch(`${api}/api${path}`, {
        method,
        headers: {
          authorization: `Bearer ${fixture.actors[actor].token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      })
    }
    const requester = "overtime-staff"
    const replacement = "correction-dst"
    await clock("2026-10-30T08:00:00+08:00")
    const opened = await request(
      requester,
      "/attendance/me/clock-in",
      "POST",
      {},
    )
    expect(opened.status, await opened.clone().text()).toBe(201)
    const { workday } = (await opened.json()) as {
      workday: { activeSessionId: string }
    }
    await clock("2026-10-30T18:00:00+08:00")
    const closed = await request(
      requester,
      "/attendance/me/clock-out",
      "POST",
      {
        sessionId: workday.activeSessionId,
      },
    )
    expect(closed.status, await closed.text()).toBe(200)
    const list = await request(
      requester,
      "/attendance/adjustments?scope=mine&type=OVERTIME&status=PENDING",
    )
    expect(list.status).toBe(200)
    const { adjustments } = (await list.json()) as {
      adjustments: {
        id: string
        employee: { departmentId: string }
        overtimeMinutes: number
      }[]
    }
    expect(adjustments).toHaveLength(1)
    const [
      {
        id,
        employee: { departmentId },
        overtimeMinutes,
      },
    ] = adjustments
    expect(overtimeMinutes).toBe(120)
    const link = `/attendance/requests/overtime?request=${id}`
    async function pendingNotice(actor: string) {
      const response = await request(actor, "/request-workflows/notifications")
      expect(response.status).toBe(200)
      const { notifications } = (await response.json()) as {
        notifications: {
          id: string
          entityId: string
          type: string
          readAt: string | null
        }[]
      }
      return notifications.find(
        (item) =>
          item.entityId === id && item.type === "ATTENDANCE_OVERTIME_PENDING",
      )
    }
    async function setHead(actor: string) {
      const response = await request(
        "admin",
        `/departments/${departmentId}`,
        "PUT",
        {
          headId: fixture.actors[actor].userId,
        },
      )
      expect(response.status, await response.text()).toBe(200)
    }
    const former = await pendingNotice("head")
    if (!former)
      throw new Error("Expected a pending notice for the original Head")
    await setHead(replacement)
    try {
      expect(
        (await request("head", `/attendance/adjustments/${id}`)).status,
      ).toBe(404)
      expect(await pendingNotice("head")).toBeUndefined()
      expect(
        (
          await request(
            "head",
            `/request-workflows/notifications/${former.id}/read`,
            "PATCH",
          )
        ).status,
      ).toBe(404)
      expect(await pendingNotice(replacement)).toMatchObject({ readAt: null })
      await page.unroute("**/api/**")
      await routeAttendanceApi(page, { realNotifications: true })
      await signIn(page, replacement)
      await page.goto("/attendance/check-ins")
      await page
        .getByRole("button", { name: /^Notifications, \d+ unread$/ })
        .click()
      await page
        .getByRole("menuitem", {
          name: /120 overtime minutes awaiting department verification/,
        })
        .and(page.locator(`[href="${link}"]`))
        .click()
      await expect(page).toHaveURL((url) => url.pathname + url.search === link)
      const detail = page.getByRole("dialog", { name: "Overtime request" })
      await expect(
        detail.getByText("120 minutes", { exact: true }),
      ).toBeVisible()
      await expect
        .poll(async () => (await pendingNotice(replacement))?.readAt)
        .toEqual(expect.any(String))
    } finally {
      await setHead("head")
    }
  })
}
