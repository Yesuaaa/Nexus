import { test, expect, type Page } from "@playwright/test"
import { randomUUID } from "node:crypto"

import {
  type OverviewScope,
  type OverviewSource,
  api,
  clock,
  fixture,
  leaveFixtureCall,
  overtimeAdjustments,
  overtimeFixtureCall,
  overviewQuery,
  overviewResponse,
  requestGate,
  routeAttendanceApi,
  seedLeaveReview,
  seedOvertimeReview,
  signIn,
} from "./support"

const requestsOverviewPage = "/attendance/requests/overview"

async function holdOverview(
  page: Page,
  source: OverviewSource,
  scope: OverviewScope,
  omitAuthorization = false,
) {
  const gate = requestGate()
  let finish!: () => void
  const finished = new Promise<void>((resolve) => (finish = resolve))
  const path = `/api${overviewQuery(source, scope)}`
  await page.route(
    `**${path}`,
    async (route) => {
      try {
        const response = await route.fetch({
          url: `${api}${path}`,
          ...(omitAuthorization ? { headers: { authorization: "" } } : {}),
        })
        expect(response.status()).toBe(omitAuthorization ? 401 : 200)
        gate.start()
        await gate.pending
        await route.fulfill({ response })
      } finally {
        finish()
      }
    },
    { times: 1 },
  )
  return { ...gate, finished }
}

function overviewSections(page: Page) {
  return {
    figures: page.getByLabel("Request figures"),
    status: page.getByRole("region", { name: "Request status", exact: true }),
    attention: page.getByRole("region", { name: "Needs attention" }),
    leave: page.getByRole("region", { name: "Leave", exact: true }),
    corrections: page.getByRole("region", { name: "Corrections", exact: true }),
    overtime: page.getByRole("region", { name: "Overtime", exact: true }),
    scope: page.getByRole("group", { name: "Request summary view" }),
  }
}

async function overviewTotals(actor: string, scope: OverviewScope) {
  const [adjustments, leave] = await Promise.all(
    (["adjustments", "leave"] as const).map(async (source) => {
      const response = await leaveFixtureCall(
        actor,
        overviewQuery(source, scope),
      )
      expect(response.status).toBe(200)
      const { groups } = (await response.json()) as {
        groups: { count: number; status: string; type: string }[]
      }
      return groups
    }),
  )
  const count = (groups: typeof adjustments) =>
    groups.reduce((sum, group) => sum + group.count, 0)
  const groups = [...adjustments, ...leave]
  return {
    total: count(groups),
    leave: count(leave),
    corrections: count(
      adjustments.filter((group) => group.type === "CORRECTION"),
    ),
    overtime: count(adjustments.filter((group) => group.type === "OVERTIME")),
    pending: count(
      groups.filter(({ status }) => ["PENDING", "SUBMITTED"].includes(status)),
    ),
    awaiting: count(
      groups.filter(({ status }) =>
        ["PENDING", "SUBMITTED", "VERIFIED"].includes(status),
      ),
    ),
  }
}

async function expectOverviewTotals(
  page: Page,
  totals: Awaited<ReturnType<typeof overviewTotals>>,
) {
  const ui = overviewSections(page)
  await expect(
    ui.status.getByText(`${totals.total} total`, { exact: true }),
  ).toBeVisible()
  await expect(
    ui.attention.getByText(`${totals.awaiting} awaiting`, { exact: true }),
  ).toBeVisible()
  await expect(
    ui.leave.getByText(`${totals.leave} total`, { exact: true }),
  ).toBeVisible()
  await expect(
    ui.corrections.getByText(`${totals.corrections} total`, { exact: true }),
  ).toBeVisible()
  await expect(
    ui.overtime.getByText(`${totals.overtime} total`, { exact: true }),
  ).toBeVisible()
  await expect(
    ui.figures.getByRole("definition").first().locator("span").first(),
  ).toHaveText(String(totals.pending))
  if (totals.total > 0) {
    const pending = ui.status.getByRole("row").filter({
      has: page.getByRole("cell", { name: "Pending", exact: true }),
    })
    await expect(pending.getByRole("cell").nth(1)).toHaveText(
      String(totals.pending),
    )
    await expect(pending.getByRole("cell").nth(2)).toHaveText(
      `${Math.round((totals.pending / totals.total) * 100)}%`,
    )
  }
}

async function expectCombinedUnavailable(page: Page, pending = false) {
  const ui = overviewSections(page)
  await expect(ui.figures).toHaveAttribute("aria-busy", String(pending))
  await expect(ui.figures.getByRole("definition")).toHaveText(
    pending ? ["", "", "", ""] : ["—", "—", "—", "—"],
  )
  await expect(ui.status.getByRole("table")).toHaveCount(0)
  await expect(ui.status.getByText(/\d+ total/)).toHaveCount(0)
  await expect(ui.attention.getByText(/\d+ awaiting/)).toHaveCount(0)
  await expect(ui.attention.getByRole("definition")).toHaveCount(0)
  if (!pending) {
    await expect(
      ui.status.getByText("Request summaries unavailable."),
    ).toBeVisible()
    await expect(
      ui.attention.getByText("Request summaries unavailable."),
    ).toBeVisible()
  }
}

/** Requests Overview totals and terminal leave. */
export function requestsOverviewTests() {
  test.describe("WC-06-F01 Requests Overview", () => {
    let adjustmentPath: string
    let leavePath: string
    let departmentPath: string

    test.beforeAll(async () => {
      await clock("2026-11-13T20:00:00+08:00")
      leavePath = await seedLeaveReview("2026-12-21")
      const headLeave = await leaveFixtureCall("head", "/leave/requests", {
        requestKey: randomUUID(),
        type: "ANNUAL",
        reason: "Personal leave for overview scope comparison",
        startDate: "2026-12-22",
        endDate: "2026-12-22",
      })
      expect(headLeave.status).toBe(201)
      const adjustment = await leaveFixtureCall("staff", overtimeAdjustments, {
        type: "CORRECTION",
        requestKey: randomUUID(),
        startedAt: "2026-10-20T09:00:00+08:00",
        endedAt: "2026-10-20T10:00:00+08:00",
        reason: "Missing time for overview scope comparison",
      })
      expect(adjustment.status).toBe(201)
      const {
        adjustment: { id },
      } = (await adjustment.json()) as { adjustment: { id: string } }
      adjustmentPath = `${overtimeAdjustments}/${id}`
      const detail = await leaveFixtureCall("head", leavePath)
      expect(detail.status).toBe(200)
      const {
        request: { employee },
      } = (await detail.json()) as {
        request: { employee: { departmentId: string } }
      }
      departmentPath = `/departments/${employee.departmentId}`
    })

    test("waits for both scopes and ignores an older response without writing", async ({
      page,
    }) => {
      const snapshot = () =>
        Promise.all(
          [adjustmentPath, leavePath, "/request-workflows/notifications"].map(
            async (path) => {
              const response = await leaveFixtureCall("staff", path)
              expect(response.status).toBe(200)
              return response.json()
            },
          ),
        )
      const before = await snapshot()
      const writes: string[] = []
      page.on("request", (request) => {
        const pathname = new URL(request.url()).pathname
        if (
          /^\/api\/(attendance|leave|request-workflows)\//.test(pathname) &&
          request.method() !== "GET"
        )
          writes.push(`${request.method()} ${pathname}`)
      })
      const team = await overviewTotals("head", "team")
      const mine = await overviewTotals("head", "mine")
      expect(team.leave).toBeGreaterThan(mine.leave)
      await signIn(page, "head")
      await page.goto(requestsOverviewPage)
      await expectOverviewTotals(page, team)

      const ui = overviewSections(page)
      const myLeave = await holdOverview(page, "leave", "mine")
      try {
        const adjustments = overviewResponse(page, "adjustments", "mine")
        await ui.scope.getByRole("button", { name: "My requests" }).click()
        expect((await adjustments).status()).toBe(200)
        await myLeave.started
        await expect(
          ui.corrections.getByText(`${mine.corrections} total`),
        ).toBeVisible()
        await expectCombinedUnavailable(page, true)
        await expect(ui.leave.getByText(/\d+ total/)).toHaveCount(0)
      } finally {
        myLeave.release()
      }
      await expectOverviewTotals(page, mine)

      const teamAdjustments = await holdOverview(page, "adjustments", "team")
      const teamLeave = await holdOverview(page, "leave", "team")
      try {
        await ui.scope
          .getByRole("button", { name: "Department requests" })
          .click()
        await Promise.all([teamAdjustments.started, teamLeave.started])
        await expectCombinedUnavailable(page, true)
        await expect(ui.corrections.getByText(/\d+ total/)).toHaveCount(0)
        await expect(ui.leave.getByText(/\d+ total/)).toHaveCount(0)
        teamAdjustments.release()
        await expect(
          ui.corrections.getByText(`${team.corrections} total`),
        ).toBeVisible()
        await expectCombinedUnavailable(page, true)
        await ui.scope.getByRole("button", { name: "My requests" }).click()
        await expectOverviewTotals(page, mine)
      } finally {
        teamAdjustments.release()
        teamLeave.release()
      }
      await teamLeave.finished
      await expectOverviewTotals(page, mine)
      expect(writes).toEqual([])
      expect(await snapshot()).toEqual(before)
    })

    test("clears prior department totals when the Head receives real 403 responses", async ({
      page,
    }) => {
      await signIn(page, "head")
      await page.goto(requestsOverviewPage)
      const teamTotals = await overviewTotals("head", "team")
      await expectOverviewTotals(page, teamTotals)
      const ui = overviewSections(page)
      const mine = await holdOverview(page, "leave", "mine")
      try {
        await ui.scope.getByRole("button", { name: "My requests" }).click()
        await mine.started
        const revoked = await overtimeFixtureCall(
          "admin",
          departmentPath,
          "PUT",
          { headId: null },
        )
        expect(revoked.status).toBe(200)
        const responses = [
          overviewResponse(page, "adjustments", "team"),
          overviewResponse(page, "leave", "team"),
        ]
        await ui.scope
          .getByRole("button", { name: "Department requests" })
          .click()
        const results = await Promise.all(responses)
        expect(results.map((result) => result.status())).toEqual([403, 403])
        const { error } = (await results[0].json()) as { error: string }
        await expect(
          page.getByRole("alert").filter({ hasText: error }),
        ).toBeVisible()
        await expectCombinedUnavailable(page)
        for (const section of [ui.leave, ui.corrections, ui.overtime])
          await expect(section.getByText(/\d+ total/)).toHaveCount(0)
        mine.release()
        await mine.finished
        await expectCombinedUnavailable(page)
      } finally {
        mine.release()
        const restored = await overtimeFixtureCall(
          "admin",
          departmentPath,
          "PUT",
          { headId: fixture.actors.head.userId },
        )
        expect(restored.status).toBe(200)
      }

      // PG-013-F001-A011-T006: retry the real team reads after restoring Head.
      const recoveredResponses = [
        overviewResponse(page, "adjustments", "team"),
        overviewResponse(page, "leave", "team"),
      ]
      await page.getByRole("button", { name: "Retry", exact: true }).click()
      const recovered = await Promise.all(recoveredResponses)
      expect(recovered.map((response) => response.status())).toEqual([200, 200])
      await expectOverviewTotals(page, teamTotals)
    })

    test("hides successful sibling counts after a real 401 response", async ({
      page,
    }) => {
      await signIn(page, "head")
      await page.goto(requestsOverviewPage)
      await expectOverviewTotals(page, await overviewTotals("head", "team"))
      const ui = overviewSections(page)
      const leaveDenied = await holdOverview(page, "leave", "mine", true)
      try {
        const adjustment = overviewResponse(page, "adjustments", "mine")
        await ui.scope.getByRole("button", { name: "My requests" }).click()
        expect((await adjustment).status()).toBe(200)
        await expect(ui.corrections.getByText(/\d+ total/)).toBeVisible()
        await leaveDenied.started
        const denied = overviewResponse(page, "leave", "mine")
        leaveDenied.release()
        expect((await denied).status()).toBe(401)
        await expect(
          page
            .getByRole("alert")
            .filter({ hasText: "Authentication required" }),
        ).toBeVisible()
        await expectCombinedUnavailable(page)
        for (const section of [ui.leave, ui.corrections, ui.overtime])
          await expect(section.getByText(/\d+ total/)).toHaveCount(0)
      } finally {
        leaveDenied.release()
      }
    })

    for (const failed of [
      ["leave"],
      ["adjustments"],
      ["adjustments", "leave"],
    ] as const) {
      test(`preserves current data and retries a 503 from ${failed.join(" and ")}`, async ({
        page,
      }) => {
        const team = await overviewTotals("head", "team")
        await signIn(page, "head")
        const unavailable = new Set<OverviewSource>(failed)
        for (const source of failed) {
          await page.route(
            `**/api${overviewQuery(source, "team")}`,
            (route) =>
              route.fulfill({
                status: 503,
                json: { error: `${source} temporarily unavailable` },
              }),
            { times: 1 },
          )
        }
        const responses = [
          overviewResponse(page, "adjustments", "team"),
          overviewResponse(page, "leave", "team"),
        ]
        await page.goto(requestsOverviewPage)
        expect(
          (await Promise.all(responses)).map((response) => response.status()),
        ).toEqual([
          unavailable.has("adjustments") ? 503 : 200,
          unavailable.has("leave") ? 503 : 200,
        ])
        const ui = overviewSections(page)
        const sections = [
          {
            source: "adjustments",
            section: ui.corrections,
            count: team.corrections,
            error: "Request summaries unavailable.",
          },
          {
            source: "leave",
            section: ui.leave,
            count: team.leave,
            error: "Leave request summaries unavailable.",
          },
        ] as const
        for (const { source, section, count, error } of sections) {
          if (unavailable.has(source)) {
            await expect(
              section.getByText(error, { exact: true }),
            ).toBeVisible()
            await expect(section.getByText(/\d+ total/)).toHaveCount(0)
          } else {
            await expect(
              section.getByText(`${count} total`, { exact: true }),
            ).toBeVisible()
          }
        }
        await expectCombinedUnavailable(page)
        const retries = await Promise.all(
          failed.map((source) => holdOverview(page, source, "team")),
        )
        try {
          await page.getByRole("button", { name: "Retry", exact: true }).click()
          await Promise.all(retries.map((retry) => retry.started))
          await expectCombinedUnavailable(page, true)
          for (const { source, section, count } of sections) {
            if (!unavailable.has(source))
              await expect(
                section.getByText(`${count} total`, { exact: true }),
              ).toBeVisible()
          }
        } finally {
          for (const retry of retries) retry.release()
        }
        await expectOverviewTotals(page, team)
      })
    }

    for (const { actor, initial, toggle } of [
      { actor: "staff", initial: "mine", toggle: false },
      { actor: "admin", initial: "team", toggle: true },
      { actor: "superadmin", initial: "team", toggle: false },
    ] as const) {
      test(`shows the authorized ${actor} overview scope`, async ({ page }) => {
        await signIn(page, actor)
        await page.goto(requestsOverviewPage)
        await expectOverviewTotals(page, await overviewTotals(actor, initial))
        const ui = overviewSections(page)
        await expect(ui.scope).toHaveCount(toggle ? 1 : 0)
        if (toggle) {
          await expect(
            ui.scope.getByRole("button", { name: "Organization requests" }),
          ).toHaveAttribute("aria-pressed", "true")
          await ui.scope.getByRole("button", { name: "My requests" }).click()
          await expectOverviewTotals(page, await overviewTotals(actor, "mine"))
        }
      })
    }

    test("[PG-013-F001-A002-T001] summary links navigate to their canonical queues", async ({
      page,
    }) => {
      await signIn(page, "head")
      await page.goto(requestsOverviewPage)
      const destinations = [
        {
          section: overviewSections(page).overtime,
          link: "View requests",
          path: "/attendance/requests/overtime",
          heading: "Overtime",
        },
        {
          section: overviewSections(page).corrections,
          link: "View requests",
          path: "/attendance/requests/corrections",
          heading: "Attendance Corrections",
        },
        {
          section: overviewSections(page).leave,
          link: "View leave requests",
          path: "/attendance/requests/leave",
          heading: "Leave Requests",
        },
      ] as const
      for (const destination of destinations) {
        await destination.section
          .getByRole("link", { name: destination.link, exact: true })
          .click()
        await expect(page).toHaveURL(new RegExp(destination.path + "$"))
        await expect(
          page.getByRole("heading", {
            level: 1,
            name: destination.heading,
            exact: true,
          }),
        ).toBeVisible()
        if (destination !== destinations.at(-1))
          await page.goto(requestsOverviewPage)
      }
    })

    test("[PG-013-F001-A012-T002] ignores pending response after overview unmount and revisit", async ({
      page,
    }) => {
      const oldTotals = await overviewTotals("head", "team")
      const currentTotals = await overviewTotals("pg007-overview", "mine")
      expect(oldTotals.total).toBeGreaterThan(currentTotals.total)
      const pageErrors: string[] = []
      page.on("pageerror", (error) => pageErrors.push(error.message))
      const pending = await holdOverview(page, "leave", "team")
      let revisited: Page | undefined
      try {
        await signIn(page, "head")
        await page.goto(requestsOverviewPage)
        await pending.started
        await expectCombinedUnavailable(page, true)
        await page.goto("/attendance/overview")
        await expect(
          page.getByRole("heading", {
            level: 1,
            name: "Attendance Overview",
            exact: true,
          }),
        ).toBeVisible()
        revisited = await page.context().newPage()
        await routeAttendanceApi(revisited)
        revisited.on("pageerror", (error) => pageErrors.push(error.message))
        await signIn(revisited, "pg007-overview")
        await revisited.goto(requestsOverviewPage)
        await expectOverviewTotals(revisited, currentTotals)
        await expect(
          overviewSections(revisited).status.getByText(
            "No requests in this scope.",
          ),
        ).toBeVisible()
        pending.release()
        await pending.finished
        await expectOverviewTotals(revisited, currentTotals)
        await expect(
          overviewSections(revisited).status.getByText(
            "No requests in this scope.",
          ),
        ).toBeVisible()
        expect(await overviewTotals("pg007-overview", "mine")).toEqual(
          currentTotals,
        )
        expect(currentTotals.total).not.toBe(oldTotals.total)
        expect(pageErrors).toEqual([])
      } finally {
        pending.release()
        await revisited?.close()
      }
    })

    test("[PG-013-F001-A016-T001] scope toggle supports keyboard navigation and activation", async ({
      page,
    }) => {
      await signIn(page, "head")
      await page.goto(requestsOverviewPage)
      await expectOverviewTotals(page, await overviewTotals("head", "team"))
      const scope = overviewSections(page).scope
      const department = scope.getByRole("button", {
        name: "Department requests",
        exact: true,
      })
      const mine = scope.getByRole("button", {
        name: "My requests",
        exact: true,
      })
      await expect(scope).toHaveAccessibleName("Request summary view")
      await expect(department).toHaveAttribute("aria-pressed", "true")
      await department.focus()
      await page.keyboard.press("Tab")
      await expect(mine).toBeFocused()
      await page.keyboard.press("Space")
      await expect(mine).toHaveAttribute("aria-pressed", "true")
      await expect(department).toHaveAttribute("aria-pressed", "false")
      await expectOverviewTotals(page, await overviewTotals("head", "mine"))
      await department.focus()
      await page.keyboard.press("Enter")
      await expect(department).toHaveAttribute("aria-pressed", "true")
      await expect(mine).toHaveAttribute("aria-pressed", "false")
      await expectOverviewTotals(page, await overviewTotals("head", "team"))
    })

    test("[PG-013-F001-A017-T001] overview remains reachable without horizontal overflow at supported widths", async ({
      page,
    }) => {
      await signIn(page, "head")
      await page.goto(requestsOverviewPage)
      await expectOverviewTotals(page, await overviewTotals("head", "team"))
      for (const width of [390, 820, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        const ui = overviewSections(page)
        for (const section of [
          ui.figures,
          ui.status,
          ui.attention,
          ui.leave,
          ui.corrections,
          ui.overtime,
          ui.scope,
        ])
          await expect(section).toBeVisible()
        await expect(
          ui.overtime.getByRole("link", { name: "View requests", exact: true }),
        ).toBeVisible()
        await expect(
          ui.corrections.getByRole("link", {
            name: "View requests",
            exact: true,
          }),
        ).toBeVisible()
        await expect(
          ui.leave.getByRole("link", {
            name: "View leave requests",
            exact: true,
          }),
        ).toBeVisible()
        const dimensions = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }))
        expect(
          dimensions.scrollWidth,
          "document width at " + width + " CSS pixels",
        ).toBeLessThanOrEqual(dimensions.clientWidth)
      }
    })
  })

  test("WC-06-F03 accounts for terminal Leave and groups matching review stages", async ({
    page,
    browser,
  }) => {
    test.setTimeout(60_000)
    const requester = "wc06-requester"
    const head = "wc06-head"
    await clock("2026-11-13T20:00:00+08:00")
    const requestPaths: string[] = []
    async function submitLeave(
      day: number,
      type: "ANNUAL" | "SICK" = "ANNUAL",
    ) {
      const date = `2026-12-${day}`
      const result = await leaveFixtureCall(requester, "/leave/requests", {
        requestKey: randomUUID(),
        type,
        reason: `Overview fixture for ${date}`,
        startDate: date,
        endDate: date,
      })
      expect(result.status).toBe(201)
      const { request } = (await result.json()) as { request: { id: string } }
      const path = `/leave/requests/${request.id}`
      requestPaths.push(path)
      return path
    }

    async function decide(
      actor: string,
      path: string,
      action: string,
      version = 1,
    ) {
      const result = await leaveFixtureCall(actor, `${path}/${action}`, {
        actionId: randomUUID(),
        expectedVersion: version,
        note: `Synthetic ${action} decision`,
      })
      expect(result.status, await result.clone().text()).toBe(200)
    }

    await submitLeave(10)
    await submitLeave(11, "SICK")
    await decide("superadmin", await submitLeave(12), "approve")
    await decide(requester, await submitLeave(13), "cancel")
    const correction = await leaveFixtureCall(requester, overtimeAdjustments, {
      type: "CORRECTION",
      requestKey: randomUUID(),
      reason: "Synthetic missing time",
      startedAt: "2026-10-20T09:00:00+08:00",
      endedAt: "2026-10-20T10:00:00+08:00",
    })
    expect(correction.status).toBe(201)
    const { adjustment } = (await correction.json()) as {
      adjustment: { id: string }
    }
    const correctionPath = `${overtimeAdjustments}/${adjustment.id}`
    requestPaths.push(correctionPath)
    const verification = await leaveFixtureCall(
      head,
      `${correctionPath}/review`,
      {
        decision: "APPROVED",
        note: "Synthetic correction verification",
      },
    )
    expect(verification.status).toBe(200)
    expect(await verification.json()).toMatchObject({
      adjustment: { status: "VERIFIED" },
    })

    const writes: string[] = []
    function trackWrites(target: Page) {
      target.on("request", (request) => {
        const pathname = new URL(request.url()).pathname
        if (
          /^\/api\/(attendance|leave|request-workflows)\//.test(pathname) &&
          request.method() !== "GET"
        )
          writes.push(`${request.method()} ${pathname}`)
      })
    }
    trackWrites(page)
    await signIn(page, head)
    await page.goto(requestsOverviewPage)
    const ui = overviewSections(page)

    async function tableRows(section: typeof ui.status) {
      const rows = section
        .getByRole("row")
        .filter({ has: page.getByRole("cell") })
      return Promise.all(
        (await rows.all()).map(async (row) =>
          (await row.getByRole("cell").allTextContents()).map((cell) =>
            cell.trim(),
          ),
        ),
      )
    }

    async function attentionRows() {
      const labels = await ui.attention.getByRole("term").allTextContents()
      const values = await ui.attention
        .getByRole("definition")
        .allTextContents()
      return labels
        .map((label, index) => `${label} ${values[index].trim()}`)
        .sort()
    }

    const five = await overviewTotals(head, "team")
    expect(five).toMatchObject({
      total: 5,
      corrections: 1,
      leave: 4,
      pending: 2,
      awaiting: 3,
    })
    await expectOverviewTotals(page, five)
    const initialRows = await tableRows(ui.status)
    expect
      .soft(initialRows.reduce((sum, [, count]) => sum + Number(count), 0))
      .toBe(5)
    expect.soft(initialRows).toContainEqual(["Cancelled", "1", "20%"])
    expect.soft(await tableRows(ui.leave)).toEqual([
      ["Submitted", "2"],
      ["Approved", "1"],
      ["Cancelled", "1"],
    ])
    expect
      .soft(await attentionRows())
      .toEqual(["Correction 1 awaiting HR", "Leave 2 pending"])
    expect(test.info().errors).toHaveLength(0)

    await decide(head, await submitLeave(14, "SICK"), "verify")
    await decide(head, await submitLeave(15), "reject")
    const reversed = await submitLeave(16)
    await decide("superadmin", reversed, "approve")
    await decide("admin", reversed, "reverse", 2)
    const overtime = await seedOvertimeReview("2026-11-12", false, requester)
    requestPaths.push(`${overtimeAdjustments}/${overtime.id}`)

    async function snapshot() {
      const auditDate = new Date().toISOString().slice(0, 10)
      const auditPath = `/attendance/audit?from=${auditDate}&to=${auditDate}&departmentId=${overtime.employee.departmentId}`
      const reads = [
        ...[...requestPaths, auditPath].map((path) =>
          leaveFixtureCall("superadmin", path),
        ),
        ...[requester, head, "admin", "superadmin"].map((actor) =>
          leaveFixtureCall(actor, "/request-workflows/notifications"),
        ),
      ]
      return Promise.all(
        (await Promise.all(reads)).map(async (response) => {
          expect(response.status).toBe(200)
          return response.json()
        }),
      )
    }
    const before = await snapshot()
    const full = await overviewTotals(head, "team")
    expect(full).toMatchObject({
      total: 9,
      overtime: 1,
      corrections: 1,
      leave: 7,
      pending: 3,
      awaiting: 5,
    })
    await page.reload()
    await expectOverviewTotals(page, full)
    const expectedRows = [
      ["Pending", "3", "33%"],
      ["Verified", "2", "22%"],
      ["Approved", "1", "11%"],
      ["Rejected", "1", "11%"],
      ["Cancelled", "1", "11%"],
      ["Reversed", "1", "11%"],
    ]
    expect(await tableRows(ui.status)).toEqual(expectedRows)
    expect(await tableRows(ui.leave)).toEqual([
      ["Submitted", "2"],
      ["Verified", "1"],
      ["Approved", "1"],
      ["Rejected", "1"],
      ["Cancelled", "1"],
      ["Reversed", "1"],
    ])
    expect(await attentionRows()).toEqual([
      "Correction 1 awaiting HR",
      "Leave 1 awaiting HR",
      "Leave 2 pending",
      "Overtime 1 pending",
    ])

    const mine = ui.scope.getByRole("button", { name: "My requests" })
    const team = ui.scope.getByRole("button", { name: "Department requests" })
    async function expectEmpty() {
      // PG-013-F001-A010-T002: preserve each section-specific empty state.
      await expect(
        ui.status.getByText("0 total", { exact: true }),
      ).toBeVisible()
      await expect(
        ui.status.getByText("No requests in this scope."),
      ).toBeVisible()
      await expect(ui.status.getByRole("table")).toHaveCount(0)
      await expect(
        ui.attention.getByText("0 awaiting", { exact: true }),
      ).toBeVisible()
      for (const section of [ui.corrections, ui.overtime]) {
        await expect(
          section.getByText("No requests in this scope.", { exact: true }),
        ).toBeVisible()
        await expect(section.getByRole("table")).toHaveCount(0)
      }
      await expect(
        ui.leave.getByText("No leave requests in this scope.", { exact: true }),
      ).toBeVisible()
      await expect(ui.leave.getByRole("table")).toHaveCount(0)
    }
    await mine.click()
    await expectEmpty()
    const older = await holdOverview(page, "leave", "team")
    try {
      await team.click()
      await older.started
      await expectCombinedUnavailable(page, true)
      await mine.click()
      await expectEmpty()
    } finally {
      older.release()
    }
    await older.finished
    await expectEmpty()

    const leaveTeamPath = `/api${overviewQuery("leave", "team")}`
    await page.route(
      `**${leaveTeamPath}`,
      (route) =>
        route.fulfill({
          status: 503,
          json: { error: "Synthetic retryable failure" },
        }),
      { times: 1 },
    )
    await team.click()
    await expectCombinedUnavailable(page)
    await expect(
      ui.overtime.getByText("1 total", { exact: true }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Retry", exact: true }).click()
    await expectOverviewTotals(page, full)
    expect(await tableRows(ui.status)).toEqual(expectedRows)

    await page.route(
      `**${leaveTeamPath}`,
      async (route) => {
        const denied = await leaveFixtureCall(
          requester,
          overviewQuery("leave", "team"),
        )
        expect(denied.status).toBe(403)
        await route.fulfill({
          status: denied.status,
          json: await denied.json(),
        })
      },
      { times: 1 },
    )
    await page.reload()
    await expectCombinedUnavailable(page)
    await expect(ui.leave.getByText(/\d+ total/)).toHaveCount(0)
    await expect(ui.corrections.getByText(/\d+ total/)).toHaveCount(0)

    const origin = new URL(page.url()).origin
    for (const [actor, scope] of [
      [requester, "mine"],
      ["admin", "team"],
      ["superadmin", "team"],
    ] as const) {
      const context = await browser.newContext()
      try {
        const reviewer = await context.newPage()
        await routeAttendanceApi(reviewer)
        trackWrites(reviewer)
        await signIn(reviewer, actor)
        await reviewer.goto(origin + requestsOverviewPage)
        await expectOverviewTotals(reviewer, await overviewTotals(actor, scope))
        const status = overviewSections(reviewer).status
        for (const terminal of ["Cancelled", "Reversed"]) {
          const row = status.getByRole("row").filter({
            has: reviewer.getByRole("cell", { name: terminal, exact: true }),
          })
          await expect(row.getByRole("cell").nth(1)).toHaveText(/^[1-9]\d*$/)
        }
        await reviewer.unrouteAll({ behavior: "wait" })
      } finally {
        await context.close()
      }
    }
    expect(writes).toEqual([])
    expect(await snapshot()).toEqual(before)
    await clock("2026-11-13T20:00:00+08:00")

    // PG-013-F001-A006-T002: one Leave request populates only Pending.
    const sparseRequest = await leaveFixtureCall(
      "pg013-sparse-head",
      "/leave/requests",
      {
        requestKey: randomUUID(),
        type: "ANNUAL",
        reason: "PG013 one-record status boundary",
        startDate: "2026-12-18",
        endDate: "2026-12-18",
      },
    )
    expect(sparseRequest.status, await sparseRequest.clone().text()).toBe(201)
    await signIn(page, "pg013-sparse-head")
    await page.goto(requestsOverviewPage)
    const sparseTotals = await overviewTotals("pg013-sparse-head", "team")
    expect(sparseTotals).toEqual({
      total: 1,
      leave: 1,
      corrections: 0,
      overtime: 0,
      pending: 1,
      awaiting: 1,
    })
    await expectOverviewTotals(page, sparseTotals)
    const sparseRows = await tableRows(overviewSections(page).status)
    expect(sparseRows).toEqual([
      ["Pending", "1", "100%"],
      ["Verified", "0", "0%"],
      ["Approved", "0", "0%"],
      ["Rejected", "0", "0%"],
      ["Cancelled", "0", "0%"],
      ["Reversed", "0", "0%"],
    ])
    expect(sparseRows.some(([, count]) => /NaN|Infinity/.test(count))).toBe(
      false,
    )
    for (const [status, count] of sparseRows) {
      const bar = overviewSections(page).status.getByRole("img", {
        name: status + ": " + count + " requests",
        exact: true,
      })
      await expect(bar).toHaveCount(1)
      await expect(bar.locator(":scope > span")).toHaveAttribute(
        "style",
        "width: " + (Number(count) === 1 ? "100%" : "0%") + ";",
      )
    }
  })
}
