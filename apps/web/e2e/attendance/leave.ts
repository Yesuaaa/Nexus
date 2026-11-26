import { test, expect, type Page } from "@playwright/test"
import { randomUUID } from "node:crypto"

import {
  api,
  clock,
  fixture,
  leaveFixtureCall,
  overtimeAdjustments,
  overtimeFixtureCall,
  overtimePage,
  overtimeResponse,
  overtimeRowMenu,
  routeAttendanceApi,
  seedLeaveReview,
  seedOvertimeReview,
  signIn,
} from "./support"

/** Leave deep links, submission, transfers and stale reviews. */
export function leaveTests() {
  test("typed attendance deep links enforce request type and backend scope", async ({
    page,
    browser,
  }) => {
    const overtime = await seedOvertimeReview("2026-11-03", false)
    const correctionReason = "Private reason for the typed correction link"
    const submitted = await overtimeFixtureCall(
      "staff",
      overtimeAdjustments,
      "POST",
      {
        type: "CORRECTION",
        requestKey: randomUUID(),
        startedAt: "2026-10-28T09:00:00+08:00",
        endedAt: "2026-10-28T09:30:00+08:00",
        reason: correctionReason,
      },
    )
    expect(submitted.status, await submitted.clone().text()).toBe(201)
    const { adjustment: correction } = (await submitted.json()) as {
      adjustment: { id: string; createdAt: string }
    }
    const correctionsPage = "/attendance/requests/corrections"
    const requests = [
      {
        id: overtime.id,
        route: overtimePage,
        wrongRoute: correctionsPage,
        title: "Overtime request",
        reason: overtime.reason,
      },
      {
        id: correction.id,
        route: correctionsPage,
        wrongRoute: overtimePage,
        title: "Attendance correction",
        reason: correctionReason,
      },
    ]
    const unavailable = "Attendance request not found"
    const auditDate = correction.createdAt.slice(0, 10)

    async function snapshot() {
      const details = await Promise.all(
        requests.map(async ({ id }) => {
          const response = await overtimeFixtureCall(
            "head",
            `${overtimeAdjustments}/${id}`,
          )
          expect(response.status).toBe(200)
          return response.json()
        }),
      )
      const audit = await overtimeFixtureCall(
        "head",
        `/attendance/audit?from=${auditDate}&to=${auditDate}&search=AttendanceAdjustment`,
      )
      expect(audit.status, await audit.clone().text()).toBe(200)
      return { details, audit: await audit.json() }
    }
    const before = await snapshot()
    const writes: string[] = []
    function trackAttendanceWrites(target: Page) {
      target.on("request", (request) => {
        const pathname = new URL(request.url()).pathname
        if (
          pathname.startsWith("/api/attendance/") &&
          !["GET", "HEAD"].includes(request.method())
        ) {
          writes.push(`${request.method()} ${pathname}`)
        }
      })
    }
    trackAttendanceWrites(page)
    await signIn(page, "head")
    await page.goto(overtimePage)
    const origin = new URL(page.url()).origin

    async function follow(
      target: Page,
      route: string,
      id: string,
      status: number,
    ) {
      const url = `${origin}${route}?request=${id}`
      const response = overtimeResponse(
        target,
        "GET",
        `${overtimeAdjustments}/${id}`,
      )
      await target.goto(url)
      expect((await response).status()).toBe(status)
      await expect(target).toHaveURL(url)
    }

    for (const { id, route, wrongRoute, title, reason } of requests) {
      await test.step(`${title} opens only on its matching route`, async () => {
        await follow(page, route, id, 200)
        const panel = page.getByRole("dialog", { name: title })
        await expect(panel.getByText(reason, { exact: true })).toBeVisible()

        await follow(page, wrongRoute, id, 200)
        const error = page
          .getByRole("alert")
          .getByText(unavailable, { exact: true })
        async function expectUnavailable() {
          await expect(error.or(panel)).toBeVisible()
          expect
            .soft(await error.isVisible(), `${title} under ${wrongRoute}`)
            .toBe(true)
          expect.soft(await panel.count()).toBe(0)
          expect.soft(await overtimeRowMenu(page, id).count()).toBe(0)
          expect
            .soft(await page.getByText(reason, { exact: true }).count())
            .toBe(0)
        }
        await expectUnavailable()
        const reloaded = overtimeResponse(
          page,
          "GET",
          `${overtimeAdjustments}/${id}`,
        )
        await page.reload()
        expect((await reloaded).status()).toBe(200)
        await expectUnavailable()
        await expect(page).toHaveURL(`${origin}${wrongRoute}?request=${id}`)
      })
    }

    for (const { id, route } of requests) {
      await page.goto(route)
      await expect(overtimeRowMenu(page, id)).toBeVisible()
      const other = requests.find((request) => request.id !== id)
      if (other) await expect(overtimeRowMenu(page, other.id)).toHaveCount(0)
    }
    await follow(page, overtimePage, randomUUID(), 404)
    await expect(
      page.getByRole("alert").getByText(unavailable, { exact: true }),
    ).toBeVisible()
    await expect(page.getByRole("dialog")).toHaveCount(0)

    const context = await browser.newContext()
    try {
      const outsider = await context.newPage()
      trackAttendanceWrites(outsider)
      await routeAttendanceApi(outsider)
      await signIn(outsider, "correction-dst")
      for (const { id, route, wrongRoute, reason } of requests) {
        for (const path of [route, wrongRoute]) {
          await follow(outsider, path, id, 404)
          await expect(
            outsider.getByRole("alert").getByText(unavailable, { exact: true }),
          ).toBeVisible()
          await expect(outsider.getByRole("dialog")).toHaveCount(0)
          await expect(outsider.getByText(reason, { exact: true })).toHaveCount(
            0,
          )
        }
      }
    } finally {
      await context.close()
    }
    expect(writes).toEqual([])
    expect(await snapshot()).toEqual(before)
  })

  test("Superadmin opens organization leave by direct URL and notification", async ({
    page,
    context,
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

    // PG-011-F001-A001-T002: an ordinary Staff user can reach the same page
    // through Attendance > Requests & Approvals > Leave, then by its URL.
    const staffPage = await context.newPage()
    await routeAttendanceApi(staffPage)
    await signIn(staffPage, "staff")
    await staffPage.goto("/attendance/requests/overview")
    await staffPage.getByRole("link", { name: "Leave", exact: true }).click()
    await expect(staffPage).toHaveURL(/\/attendance\/requests\/leave$/)
    await staffPage.goto("/attendance/requests/leave")
    await expect(
      staffPage.getByRole("heading", { name: "Leave Requests" }),
    ).toBeVisible()
    await staffPage.close()

    await signIn(page, "superadmin")
    await page.goto(link)
    const detail = page.getByRole("dialog", { name: "Leave request" })
    await expect(detail.getByText(reason, { exact: true })).toBeVisible()
    // PG-011-F001-A010-T001: read mode displays its source summaries and
    // decision history without exposing an action form.
    await expect(
      detail.getByRole("heading", { name: "Request summary" }),
    ).toBeVisible()
    await expect(
      detail.getByRole("heading", { name: "Policy coverage" }),
    ).toBeVisible()
    await expect(
      detail.getByRole("heading", { name: "Decision history" }),
    ).toBeVisible()
    await expect(detail.getByLabel("Decision note")).toHaveCount(0)

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

    // PG-011-F001-A018-T001: reversal is confirmed before the page posts the
    // action, then the refreshed row reflects the persisted terminal status.
    const reversalCreated = await leaveFixtureCall("staff", "/leave/requests", {
      requestKey: randomUUID(),
      type: "ANNUAL",
      reason: "UI reversal candidate",
      startDate: "2026-11-19",
      endDate: "2026-11-19",
    })
    expect(reversalCreated.status, await reversalCreated.clone().text()).toBe(
      201,
    )
    const { request: reversalRequest } = (await reversalCreated.json()) as {
      request: { id: string }
    }
    const verified = await leaveFixtureCall(
      "head",
      `/leave/requests/${reversalRequest.id}/verify`,
      {
        actionId: randomUUID(),
        expectedVersion: 1,
        note: "Verified before reversal UI check",
      },
    )
    expect(verified.status, await verified.clone().text()).toBe(200)
    const approved = await leaveFixtureCall(
      "superadmin",
      `/leave/requests/${reversalRequest.id}/approve`,
      {
        actionId: randomUUID(),
        expectedVersion: 2,
        note: "Approved before reversal UI check",
      },
    )
    expect(approved.status, await approved.clone().text()).toBe(200)

    await page.goto("/attendance/requests/leave")
    const reversePath = `/api/leave/requests/${reversalRequest.id}/reverse`
    let reversalPosts = 0
    page.on("request", (item) => {
      if (new URL(item.url()).pathname === reversePath) reversalPosts += 1
    })
    await page.locator(`[id="leave-actions-${reversalRequest.id}"]`).click()
    await page.getByRole("menuitem", { name: "Reverse approval" }).click()
    const reversePanel = page.getByRole("dialog", { name: "Reverse approval" })
    await reversePanel
      .getByLabel("Decision note")
      .fill("Coverage is no longer required")
    await reversePanel.getByRole("button", { name: "Reverse approval" }).click()
    const reverseConfirmation = page
      .getByRole("dialog")
      .filter({ hasText: "This removes approved leave coverage" })
    await expect(reverseConfirmation).toBeVisible()
    expect(reversalPosts).toBe(0)
    const reversalResponse = page.waitForResponse(
      (item) => new URL(item.url()).pathname === reversePath,
    )
    await reverseConfirmation
      .getByRole("button", { name: "Reverse approval" })
      .click()
    const reversed = await reversalResponse
    expect(reversed.status()).toBe(200)
    expect(reversed.request().postDataJSON()).toMatchObject({
      expectedVersion: 3,
      note: "Coverage is no longer required",
    })
    await expect(
      page
        .getByRole("table", { name: "Leave requests" })
        .getByRole("row")
        .filter({ hasText: "Nov 19, 2026" }),
    ).toContainText("Reversed")
    expect(reversalPosts).toBe(1)
  })

  test("[PG-011-F001-A013-T001] browser submission persists the leave request and reviewer notice", async ({
    page,
  }) => {
    await clock("2026-11-13T20:00:00+08:00")
    await signIn(page, "staff")
    await page.goto("/attendance/requests/leave")
    await page.getByRole("button", { name: "Request leave" }).click()
    const form = page.getByRole("dialog", { name: "Request leave" })
    await form.getByRole("combobox", { name: "Leave type" }).click()
    await page.getByRole("option", { name: "Sick leave", exact: true }).click()
    await form.getByLabel("Leave start date").fill("2026-12-08")
    await form.getByLabel("Leave end date").fill("2026-12-08")
    await form
      .getByPlaceholder("Explain the leave request for authorized reviewers.")
      .fill("Medical appointment follow-up")
    await expect(form.getByRole("status")).toContainText("1 working day(s)")
    await expect(
      form.getByRole("button", { name: "Submit request" }),
    ).toBeEnabled()

    const submitted = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/leave/requests" &&
        response.request().method() === "POST",
    )
    await form.getByRole("button", { name: "Submit request" }).click()
    const result = await submitted
    expect(result.status(), await result.text()).toBe(201)
    const { request } = (await result.json()) as {
      request: { id: string; status: string; version: number }
    }
    const payload = result.request().postDataJSON() as {
      requestKey: string
      type: string
      reason: string
      startDate: string
      endDate: string
    }
    expect(payload).toMatchObject({
      type: "SICK",
      reason: "Medical appointment follow-up",
      startDate: "2026-12-08",
      endDate: "2026-12-08",
    })
    expect(payload.requestKey).toMatch(/^[0-9a-f-]{36}$/i)
    expect(request).toMatchObject({ status: "SUBMITTED", version: 1 })
    await expect(form).toHaveCount(0)
    await expect(
      page
        .getByRole("table", { name: "Leave requests" })
        .getByRole("row")
        .filter({ hasText: "Dec 8, 2026" }),
    ).toContainText("Sick")

    const saved = await leaveFixtureCall(
      "staff",
      `/leave/requests/${request.id}`,
    )
    expect(saved.status).toBe(200)
    const { request: persisted } = (await saved.json()) as {
      request: {
        id: string
        employeeId: string
        type: string
        reason: string
        startDate: string
        endDate: string
        status: string
        days: { workDate: string; leaveMinutes: number }[]
        decisions: { action: string; version: number }[]
      }
    }
    expect(persisted).toMatchObject({
      id: request.id,
      employeeId: fixture.actors.staff.employeeId,
      type: "SICK",
      reason: "Medical appointment follow-up",
      status: "SUBMITTED",
    })
    expect(persisted.startDate.slice(0, 10)).toBe("2026-12-08")
    expect(persisted.endDate.slice(0, 10)).toBe("2026-12-08")
    expect(persisted.days).toHaveLength(1)
    expect(persisted.days[0]).toMatchObject({
      workDate: "2026-12-08T00:00:00.000Z",
      leaveMinutes: 480,
    })
    expect(
      persisted.decisions.map(({ action, version }) => ({ action, version })),
    ).toEqual([{ action: "SUBMITTED", version: 1 }])

    const inbox = await leaveFixtureCall(
      "head",
      "/request-workflows/notifications",
    )
    expect(inbox.status).toBe(200)
    const { notifications } = (await inbox.json()) as {
      notifications: { entityId: string; type: string }[]
    }
    expect(
      notifications.filter(
        ({ entityId, type }) =>
          entityId === request.id && type === "LEAVE_SUBMITTED",
      ),
    ).toHaveLength(1)
  })

  test("WC-I3-F01 Employee Directory transfer routes both Leave review stages to the receiving Head", async ({
    page,
    context,
  }) => {
    const subject = "leave-transfer"
    const formerHead = "wc07-origin-head"
    const receivingHead = "wc07-destination-head"
    const employeePath = `/employees/${fixture.actors[subject].employeeId}`
    const inboxPath = "/request-workflows/notifications"
    const portal = "/attendance/requests/leave"
    const inbox = async (actor: string) => {
      const response = await leaveFixtureCall(actor, inboxPath)
      expect(response.status).toBe(200)
      return (await response.json()) as {
        unreadCount: number
        notifications: { id: string; entityId: string; readAt: string | null }[]
      }
    }
    const prepared = await overtimeFixtureCall("admin", employeePath, "PUT", {
      employeeId: "EXP-LEAVE-TRANSFER",
      contactNumber: "09123456789",
      position: "QA Specialist",
      startDate: "2026-01-01",
      email: "leave-transfer@attendance-browser.test",
    })
    expect(prepared.status, await prepared.clone().text()).toBe(200)
    await clock("2026-11-22T00:00:00Z")
    async function submit(date: string, reason: string) {
      const response = await leaveFixtureCall(subject, "/leave/requests", {
        requestKey: randomUUID(),
        type: "ANNUAL",
        reason,
        startDate: date,
        endDate: date,
      })
      expect(response.status, await response.clone().text()).toBe(201)
      const { request } = (await response.json()) as { request: { id: string } }
      return request.id
    }
    const pending = await submit("2026-12-03", "Submitted transfer fixture")
    const verified = await submit("2026-12-04", "Verified transfer fixture")
    const verifiedPath = `/leave/requests/${verified}`
    const decision = {
      actionId: randomUUID(),
      expectedVersion: 1,
      note: "Verified by the original Department Head",
    }
    expect(
      (await leaveFixtureCall(formerHead, `${verifiedPath}/verify`, decision))
        .status,
    ).toBe(200)
    const oldNotice = (await inbox(formerHead)).notifications.find(
      ({ entityId }) => entityId === pending,
    )
    expect(oldNotice).toBeDefined()
    const unreadBefore = (await inbox(receivingHead)).unreadCount

    await signIn(page, "admin")
    await page.goto("/employees")
    await page
      .getByRole("searchbox", { name: "Search employees" })
      .fill(subject)
    await page
      .getByRole("button", {
        name: "More actions for Attendance leave-transfer",
      })
      .click()
    await page.getByRole("menuitem", { name: "Edit", exact: true }).click()
    const form = page.getByRole("dialog", { name: "Edit Employee" })
    await form
      .getByRole("combobox", { name: "Department", exact: true })
      .click()
    await page
      .getByRole("option", { name: "WC07 transfer destination" })
      .click()
    await form.getByRole("combobox", { name: "Team", exact: true }).click()
    await page.getByRole("option", { name: "No Team", exact: true }).click()
    const placement = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api${employeePath}` &&
        response.request().method() === "PUT",
    )
    await form.getByRole("button", { name: "Save Employee" }).click()
    const moved = await placement
    expect(moved.status(), await moved.text()).toBe(200)
    await expect(form).toHaveCount(0)
    const newInbox = await inbox(receivingHead)
    expect(newInbox.unreadCount).toBe(unreadBefore + 2)
    expect(newInbox.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityId: pending, readAt: null }),
        expect.objectContaining({ entityId: verified, readAt: null }),
      ]),
    )
    expect((await leaveFixtureCall(formerHead, verifiedPath)).status).toBe(404)
    expect(
      (await leaveFixtureCall(formerHead, `${verifiedPath}/verify`, decision))
        .status,
    ).toBe(404)
    expect(
      (
        await overtimeFixtureCall(
          formerHead,
          `${inboxPath}/${oldNotice!.id}/read`,
          "PATCH",
        )
      ).status,
    ).toBe(404)

    const reviewer = await context.newPage()
    await routeAttendanceApi(reviewer, { realNotifications: true })
    await signIn(reviewer, receivingHead)
    await reviewer.goto(new URL(portal, page.url()).href)
    const bell = reviewer.getByRole("button", {
      name: /^Notifications, \d+ unread$/,
    })
    for (const [id, reason] of [
      [pending, "Submitted transfer fixture"],
      [verified, "Verified transfer fixture"],
    ]) {
      const link = `${portal}?request=${id}`
      await bell.click()
      await reviewer
        .getByRole("menuitem")
        .and(reviewer.locator(`[href="${link}"]`))
        .click()
      await expect(reviewer).toHaveURL(
        (url) => url.pathname + url.search === link,
      )
      const detail = reviewer.getByRole("dialog", { name: "Leave request" })
      await expect(detail.getByText(reason, { exact: true })).toBeVisible()
      await expect
        .poll(
          async () =>
            (await inbox(receivingHead)).notifications.find(
              ({ entityId }) => entityId === id,
            )?.readAt,
        )
        .toEqual(expect.any(String))
      await detail.getByRole("button", { name: "Close", exact: true }).click()
    }
    expect((await inbox(receivingHead)).unreadCount).toBe(unreadBefore)
    await reviewer.locator(`[id="leave-actions-${verified}"]`).click()
    await reviewer.getByRole("menuitem", { name: "Verify request" }).click()
    const review = reviewer.getByRole("dialog", { name: "Verify request" })
    await review
      .getByLabel("Decision note")
      .fill("Verified by the receiving Department Head")
    const reviewResponse = reviewer.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api${verifiedPath}/verify`,
    )
    await review.getByRole("button", { name: "Verify request" }).click()
    const result = await reviewResponse
    expect(result.status()).toBe(200)
    // PG-011-F001-A016-T001: preserve the submitted version and note together
    // with the refreshed response state.
    const reviewPayload = result.request().postDataJSON() as {
      actionId: string
      expectedVersion: number
      note: string
    }
    expect(reviewPayload).toMatchObject({
      expectedVersion: 2,
      note: "Verified by the receiving Department Head",
    })
    expect(reviewPayload.actionId).toMatch(/^[0-9a-f-]{36}$/i)
    expect(await result.json()).toMatchObject({
      request: {
        status: "VERIFIED",
        version: 3,
        routeDepartmentId: fixture.transferDestinationId,
        capabilities: { requiresReverification: false },
      },
    })
  })

  test("stale HR approval refreshes leave after Superadmin rejection", async ({
    page,
    browser,
  }) => {
    const path = await seedLeaveReview("2026-12-15")
    const portal = "/attendance/requests/leave"
    const rowMenu = page.locator(
      `[id="leave-actions-${path.split("/").at(-1)}"]`,
    )
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
      const rejection = supervisor.getByRole("dialog", {
        name: "Reject request",
      })
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
    const staleApproval = await conflict
    expect(staleApproval.status()).toBe(409)
    // PG-011-F001-A017-T001: the stale command keeps its original payload and
    // does not produce an approval success notification.
    expect(staleApproval.request().postDataJSON()).toMatchObject({
      expectedVersion: 2,
      note: "HR approval prepared earlier",
    })
    await expect(
      page.getByText("Leave request approved", { exact: true }),
    ).toHaveCount(0)
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
}
