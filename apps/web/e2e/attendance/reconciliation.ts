import { test, expect } from "@playwright/test"

import {
  api,
  clock,
  confirm,
  fixture,
  overtimeFixtureCall,
  requestGate,
  routeAttendanceApi,
  signIn,
} from "./support"

/** Skeletons and suspended-session reconciliation. */
export function reconciliationTests() {
  for (const width of [1280, 390])
    test(`attendance policy skeletons match the responsive grid and retain rows during refresh at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await signIn(page, "admin")
      const initial = requestGate()
      const refreshed = requestGate()
      let holdingRefresh = false
      const initialQuery: { url: URL | null } = { url: null }
      await page.route("**/api/attendance/policies**", async (route) => {
        if (route.request().method() === "GET") {
          if (!holdingRefresh) initialQuery.url = new URL(route.request().url())
          const gate = holdingRefresh ? refreshed : initial
          gate.start()
          await gate.pending
        }
        await route.fallback()
      })

      await page.goto("/attendance/settings")
      const table = page.getByRole("table", { name: "Attendance policies" })
      await initial.started
      // PG-008-F001-A002-T001: the first request explicitly loads page 1, size
      // 10, active policies, and omits the empty search value.
      expect({
        page: initialQuery.url?.searchParams.get("page"),
        size: initialQuery.url?.searchParams.get("size"),
        status: initialQuery.url?.searchParams.get("status"),
        search: initialQuery.url?.searchParams.get("search"),
      }).toEqual({ page: "1", size: "10", status: "active", search: null })
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

  test("WC-06-F02 reports and exports a suspended session until reconciliation", async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const date = "2026-09-18"
    const nextDate = "2026-09-19"
    const startedAt = "2026-09-18T15:00:00.000Z"
    const suspendedAt = "2026-09-18T16:00:00.000Z"
    await clock("2026-09-19T03:00:00+08:00")
    await signIn(page, "admin")

    async function read<T>(resource: string, from: string, filters = "") {
      const response = await overtimeFixtureCall(
        "admin",
        `/attendance/${resource}?from=${from}&to=${from}${filters}`,
      )
      expect(response.status).toBe(200)
      return (await response.json()) as T
    }

    type Overview =
      import("../../src/features/attendance/api/attendance-api").AttendanceOverview
    type Workday =
      import("../../src/features/attendance/api/attendance-api").AttendanceWorkday
    type Records = { workdays: Workday[] }
    type StatusCounts = {
      total: number
      working: number
      onBreak: number
      suspended: number
      closed: number
    }
    const recordResponse = await read<Records>("records", date)
    const suspended = recordResponse.workdays.find(
      (day) => day.employee?.fullName === "WC06 Suspended",
    )!
    expect(suspended).toMatchObject({
      workDate: date,
      timeZone: "Asia/Manila",
      workedHours: 1,
      sessions: [{ startedAt, suspendedAt, endedAt: null }],
    })
    const overnight = recordResponse.workdays.find(
      (day) => day.employee?.fullName === "WC06 Overnight",
    )
    expect(overnight).toMatchObject({
      workDate: date,
      timeZone: "Asia/Manila",
      workedHours: 6,
      sessions: [
        {
          startedAt: "2026-09-18T12:00:00.000Z",
          endedAt: "2026-09-18T18:00:00.000Z",
        },
      ],
    })
    const employeeFilter = `&employeeId=${suspended.employeeId}`
    const departments = await overtimeFixtureCall(
      "admin",
      "/attendance/departments",
    )
    expect(departments.status).toBe(200)
    const { departments: choices } = (await departments.json()) as {
      departments: { id: string; name: string }[]
    }
    const departmentId = choices.find(
      ({ name }) => name === "WC06 reporting",
    )!.id
    const departmentFilter = `&departmentId=${departmentId}`
    const auditDate = new Date().toISOString().slice(0, 10)
    const audit = () =>
      read<{ total: number; events: { id: string; reason: string }[] }>(
        "audit",
        auditDate,
        employeeFilter,
      )
    const beforeAudit = await audit()

    async function selectDate(from: string) {
      await page.getByLabel("Attendance from date", { exact: true }).fill(from)
      await page
        .getByLabel("Attendance through date", { exact: true })
        .fill(from)
    }

    async function expectDistribution(counts: StatusCounts, filter = "") {
      const result = await read<Overview>("overview", date, filter)
      expect.soft(result.checkIns).toMatchObject(counts)
      const status = page.getByRole("region", {
        name: "Recorded session status",
      })
      for (const [label, count] of [
        ["Clocked in", counts.working],
        ["On unpaid break", counts.onBreak],
        ["Suspended", counts.suspended],
        ["Clocked out", counts.closed],
      ] as const) {
        const cells = status
          .getByRole("row")
          .filter({ has: page.getByRole("cell", { name: label, exact: true }) })
          .getByRole("cell")
        await expect.soft(cells.nth(1), label).toHaveText(String(count))
        await expect
          .soft(cells.nth(2), `${label} share`)
          .toHaveText(`${Math.round((count / counts.total) * 100)}%`)
      }
      const stillClockedIn = page
        .getByLabel("Time log figures")
        .locator("div")
        .filter({ has: page.getByText("Still clocked in", { exact: true }) })
        .getByRole("definition")
      await expect(stillClockedIn).toContainText(
        String(counts.working + counts.onBreak),
      )
    }

    async function exportRows() {
      const ready = page.waitForEvent("download")
      await page.getByRole("button", { name: "Export", exact: true }).click()
      const download = await ready
      expect(download.suggestedFilename()).toBe(
        `attendance-${date}-${date}-page-1.csv`,
      )
      const chunks: Buffer[] = []
      for await (const chunk of await download.createReadStream())
        chunks.push(Buffer.from(chunk))
      // These fixture fields contain no embedded quotes or line breaks.
      const [headers, ...rows] = Buffer.concat(chunks)
        .toString("utf8")
        .split("\r\n")
        .map((line) => line.slice(1, -1).split('","'))
      expect
        .soft(headers.slice(-2))
        .toEqual(["Suspension timestamps", "Session statuses"])
      return rows.map((row) =>
        Object.fromEntries(
          headers.map((header, index) => [header, row[index]]),
        ),
      )
    }

    await page.goto("/attendance/time-logs/overview")
    await selectDate(date)
    await expectDistribution({
      total: 4,
      working: 1,
      onBreak: 1,
      suspended: 1,
      closed: 1,
    })
    await page.getByRole("combobox", { name: "Time logs department" }).click()
    await page
      .getByRole("option", { name: "WC06 reporting", exact: true })
      .click()
    const onlySuspended = {
      total: 1,
      working: 0,
      onBreak: 0,
      suspended: 1,
      closed: 0,
    }
    await expectDistribution(onlySuspended, departmentFilter)
    expect((await read<Records>("records", nextDate)).workdays).toEqual([])
    await selectDate(nextDate)
    await expect(page.getByText("No check-ins in this period.")).toBeVisible()

    await page.getByRole("link", { name: "View records" }).click()
    await page.getByRole("button", { name: "All logs", exact: true }).click()
    await selectDate(date)
    const history = page.getByRole("table", { name: "Attendance history" })
    await expect(
      history.getByText("Shift suspended", { exact: true }),
    ).toBeVisible()
    const overnightRow = history.getByRole("row").filter({
      has: page.getByText("WC06 Overnight", { exact: true }),
    })
    await expect(overnightRow.getByText(`Work date ${date}`)).toBeVisible()
    await expect(
      overnightRow.getByText("Sep 19, 2026", { exact: false }),
    ).toBeVisible()
    const mixed = await exportRows()
    expect(mixed).toHaveLength(4)
    const suspendedCsv = {
      Workday: date,
      Employee: "WC06 Suspended",
      Timezone: "Asia/Manila",
      "Clock in timestamps": startedAt,
      "Clock out timestamps": "",
      "Suspension timestamps": suspendedAt,
      "Session statuses": "Suspended",
      "Worked hours": "1",
    }
    expect.soft(mixed).toContainEqual(expect.objectContaining(suspendedCsv))
    for (const [employee, status, clockOut] of [
      ["WC06 Working", "Open", ""],
      ["WC06 Break", "On unpaid break", ""],
      ["WC06 Overnight", "Closed", "2026-09-18T18:00:00.000Z"],
    ]) {
      expect.soft(mixed).toContainEqual(
        expect.objectContaining({
          Employee: employee,
          "Clock out timestamps": clockOut,
          "Suspension timestamps": "",
          "Session statuses": status,
        }),
      )
    }

    await page.getByRole("combobox", { name: "Attendance department" }).click()
    await page
      .getByRole("option", { name: "WC06 reporting", exact: true })
      .click()
    await expect(
      history.getByText("WC06 Suspended", { exact: true }),
    ).toBeVisible()
    await expect(
      history.getByText("WC06 Working", { exact: true }),
    ).toHaveCount(0)
    await page.getByRole("button", { name: "Employees", exact: true }).click()
    await page
      .getByRole("button", {
        name: "View logs for WC06 Suspended",
        exact: true,
      })
      .click()
    await expect(
      history.getByText("Shift suspended", { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText("WC06 reporting", { exact: true }),
    ).toBeVisible()
    const scopedCsv = await exportRows()
    expect(scopedCsv).toHaveLength(1)
    expect.soft(scopedCsv[0]).toMatchObject(suspendedCsv)
    expect(await read<Records>("records", date)).toEqual(recordResponse)
    expect(await audit()).toEqual(beforeAudit)

    const note = "Confirmed the suspended shift end for the reporting fixture"
    const reconciled = await overtimeFixtureCall(
      "admin",
      `/attendance/employees/${suspended.employeeId}/sessions/${suspended.sessions[0].id}/reconcile`,
      "POST",
      { endedAt: suspendedAt, note },
    )
    expect(reconciled.status).toBe(200)
    const after = await read<Records>(
      "records",
      date,
      employeeFilter + departmentFilter,
    )
    expect(after.workdays).toMatchObject([
      {
        workDate: date,
        workedHours: 1,
        sessions: [{ startedAt, suspendedAt, endedAt: suspendedAt }],
      },
    ])
    const afterAudit = await audit()
    expect(afterAudit.total).toBe(beforeAudit.total + 1)
    expect(afterAudit.events[0]).toMatchObject({ reason: note })
    expect(afterAudit.events.slice(1)).toEqual(beforeAudit.events)

    await page.reload()
    await page
      .getByRole("searchbox", { name: "Search attendance employees" })
      .fill("BROWSER-WC06-Suspended")
    await page
      .getByRole("button", {
        name: "View logs for WC06 Suspended",
        exact: true,
      })
      .click()
    await selectDate(date)
    await expect(
      history.getByText("WC06 Suspended", { exact: true }),
    ).toBeVisible()
    await expect(
      history.getByText("Shift suspended", { exact: true }),
    ).toHaveCount(0)
    expect.soft(await exportRows()).toMatchObject([
      {
        ...suspendedCsv,
        "Clock out timestamps": suspendedAt,
        "Session statuses": "Closed",
      },
    ])

    await page.goto("/attendance/time-logs/overview")
    await selectDate(date)
    await page.getByRole("combobox", { name: "Time logs department" }).click()
    await page
      .getByRole("option", { name: "WC06 reporting", exact: true })
      .click()
    await expectDistribution(
      { ...onlySuspended, suspended: 0, closed: 1 },
      departmentFilter,
    )
    await clock("2026-11-13T20:00:00+08:00")
  })

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
    expect(
      (await punch("breaks/start", actor.token, { sessionId })).status,
    ).toBe(200)
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
      await expect(
        dialog.getByRole("button", { name: "Cancel" }),
      ).toBeDisabled()
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
    await expect(
      table.getByText("Shift suspended", { exact: true }),
    ).toHaveCount(0)
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

  test.describe("WC-I3-F02 reconciliation timestamps", () => {
    test.use({ timezoneId: "America/Los_Angeles" })

    for (const { actor, offset, endedAt, workedMinutes } of [
      {
        actor: "reconcile-pdt",
        offset: "UTC-07:00",
        endedAt: "2026-11-01T08:30:00.000Z",
        workedMinutes: 20,
      },
      {
        actor: "reconcile-pst",
        offset: "UTC-08:00",
        endedAt: "2026-11-01T09:30:00.000Z",
        workedMinutes: 80,
      },
    ]) {
      test(`submits only the selected ${offset} occurrence`, async ({
        page,
      }) => {
        const { employeeId } = fixture.actors[actor]
        await clock("2026-11-01T08:10:00Z")
        const opened = await overtimeFixtureCall(
          actor,
          "/attendance/me/clock-in",
          "POST",
          {},
        )
        expect(opened.status).toBe(201)
        const { workday } = await opened.json()
        expect(
          (
            await overtimeFixtureCall(
              "admin",
              `/employees/${employeeId}/account/status`,
              "PATCH",
              { isActive: false },
            )
          ).status,
        ).toBe(204)
        await page.clock.setFixedTime(new Date("2026-11-13T12:00:00Z"))
        await signIn(page, "admin")
        await page.goto("/attendance/time-logs/records")
        await page
          .getByRole("button", { name: `View logs for Attendance ${actor}` })
          .click()
        await page
          .getByRole("button", { name: "Actions for 2026-11-01" })
          .click()
        await page.getByRole("menuitem", { name: "View details" }).click()
        await page.getByRole("button", { name: "Reconcile shift" }).click()
        const dialog = page.getByRole("dialog", {
          name: "Reconcile suspended shift",
        })
        const end = dialog.getByLabel("Confirmed clock-out", { exact: true })
        const note = "Confirmed the selected occurrence of local time"
        await dialog.getByLabel("Reason").fill(note)
        const submit = dialog.getByRole("button", { name: "Reconcile shift" })
        await end.fill("2026-03-08T02:30")
        await expect(dialog.getByRole("alert")).toHaveText(
          /not a valid local time/,
        )
        await expect(submit).toBeDisabled()
        await end.fill("2026-11-01T01:30")
        await expect(dialog.getByRole("alert")).toHaveText(
          /Choose a UTC offset/,
        )
        await expect(submit).toBeDisabled()
        const occurrence = dialog.getByRole("combobox", {
          name: "Confirmed clock-out occurrence",
        })
        await occurrence.click()
        await page.getByRole("option", { name: offset, exact: true }).click()
        await expect(occurrence).toHaveText(offset)

        const reconcile = `/attendance/employees/${employeeId}/sessions/${workday.activeSessionId}/reconcile`
        const postReconciliation = async () => {
          const response = page.waitForResponse(
            (result) => new URL(result.url()).pathname === `/api${reconcile}`,
          )
          await submit.click()
          const result = await response
          expect(result.request().postDataJSON()).toEqual({ endedAt, note })
          return result
        }
        expect((await postReconciliation()).status()).toBe(400)
        await expect(dialog.getByRole("alert")).toHaveText(
          "Clock-out cannot be in the future",
        )
        await expect(occurrence).toHaveText(offset)
        await expect(end).toHaveValue("2026-11-01T01:30")
        await expect(dialog.getByLabel("Reason")).toHaveValue(note)
        await clock("2026-11-01T10:00:00Z")
        expect((await postReconciliation()).status()).toBe(200)
        await expect(dialog).toHaveCount(0)
        const history = await overtimeFixtureCall(
          "admin",
          `/attendance/employees/${employeeId}/history?from=2026-11-01&to=2026-11-01`,
        )
        expect(history.status).toBe(200)
        expect((await history.json()).workdays).toMatchObject([
          { workedMinutes, sessions: [{ endedAt }] },
        ])
      })
    }
  })
}
