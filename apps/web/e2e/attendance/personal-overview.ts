import { test, expect } from "@playwright/test"
import type {
  AttendanceHistory,
  AttendanceState,
} from "../../src/features/attendance/api/attendance-api"
import {
  api,
  assertNoPageOverflow,
  clock,
  createApprovedCorrection,
  fixture,
  setSession,
  signIn,
} from "./support"

/** Personal attendance overview. */
export function personalOverviewTests() {
  test("[PG-007-F001-A001-T002] overview route admits STAFF and ADMIN and redirects denied roles", async ({
    page,
  }) => {
    await page.goto("/login")
    const cases = [
      { actor: "staff", pathname: "/attendance/overview", allowed: true },
      { actor: "admin", pathname: "/attendance/overview", allowed: true },
      { actor: "client", pathname: "/dashboard", allowed: false },
      { actor: "superadmin", pathname: "/module", allowed: false },
    ]
    for (const scenario of cases) {
      await setSession(page, scenario.actor)
      await page.goto("/attendance/overview")
      await expect
        .poll(() => new URL(page.url()).pathname)
        .toBe(scenario.pathname)
      const heading = page.getByRole("heading", {
        name: "Attendance Overview",
        exact: true,
      })
      if (scenario.allowed) await expect(heading).toBeVisible()
      else await expect(heading).toHaveCount(0)
    }
  })

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 820, height: 1180 },
    { width: 1440, height: 1000 },
  ]) {
    test(`attendance overview summary layout at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await signIn(page, "admin")
      await page.goto("/attendance/overview")
      const overview = page.locator('[aria-label="Attendance figures"]')
      await expect(overview).toHaveAttribute("aria-busy", "false")
      await expect(
        page.getByRole("heading", {
          name: "Check-in status",
          exact: true,
        }),
      ).toBeVisible()
      await expect(
        page.getByRole("heading", {
          name: "Recent check-in activity",
          exact: true,
        }),
      ).toBeVisible()
      await expect(
        page.getByRole("combobox", {
          name: "Attendance department",
          exact: true,
        }),
      ).toHaveCount(0)
      await expect(
        page.getByRole("heading", {
          name: "Personal attendance",
          exact: true,
        }),
      ).toBeVisible()
      const main = page.getByRole("main", { name: "Attendance workspace" })
      await expect(main.getByText("Check-ins", { exact: true })).toBeVisible()
      await expect(main.getByText("Check-outs", { exact: true })).toBeVisible()
      await expect(
        main.getByRole("link", { name: "Open Check-Ins", exact: true }),
      ).toHaveAttribute("href", "/attendance/check-ins")
      await expect(
        main.getByText(
          /time logs|overtime|corrections|requests|polic|required hours|excess/i,
        ),
      ).toHaveCount(0)
      const refreshed = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/attendance/me/overview" &&
          response.request().method() === "GET",
      )
      await main.getByRole("button", { name: "Refresh", exact: true }).click()
      // PG-007-F001-A004-T007 additive assertions; preserve the layout checks.
      const refreshResponse = await refreshed
      expect(refreshResponse.status()).toBe(200)
      const refreshUrl = new URL(refreshResponse.url())
      expect(refreshUrl.searchParams.get("from")).toBe(
        await main.getByLabel("Attendance from date").inputValue(),
      )
      expect(refreshUrl.searchParams.get("to")).toBe(
        await main.getByLabel("Attendance through date").inputValue(),
      )
      await expect(overview).toHaveAttribute("aria-busy", "false")
      await assertNoPageOverflow(page)
      await page.screenshot({
        path: test
          .info()
          .outputPath(`attendance-overview-${viewport.width}.png`),
        fullPage: true,
      })
    })
  }

  test("[PG-007-F001-A013-T020] PGlite attendance renders through the real personal overview path", async ({
    page,
  }) => {
    test.setTimeout(90000)
    const actor = fixture.actors["pg007-overview"]
    const headers = { authorization: `Bearer ${actor.token}` }
    const historyPath =
      "/api/attendance/me/history?from=2026-11-20&to=2026-11-20"
    async function readFixtureHistory() {
      const response = await fetch(`${api}${historyPath}`, { headers })
      expect(response.status, await response.clone().text()).toBe(200)
      return (await response.json()) as AttendanceHistory
    }

    try {
      const empty = await readFixtureHistory()
      expect(empty.workdays).toHaveLength(0)

      await clock("2026-11-20T09:00:00+08:00")
      const started = await fetch(`${api}/api/attendance/me/clock-in`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: "{}",
      })
      expect(started.status, await started.clone().text()).toBe(201)
      const state = (await started.json()) as AttendanceState
      const sessionId = state.workday?.activeSessionId
      expect(sessionId).toBeTruthy()
      if (!sessionId)
        throw new Error("Clock-in did not create an active session")

      await clock("2026-11-20T10:00:00+08:00")
      const closed = await fetch(`${api}/api/attendance/me/clock-out`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
      expect(closed.status, await closed.clone().text()).toBe(200)

      const beforeOverview = await readFixtureHistory()
      expect(beforeOverview.workdays).toHaveLength(1)
      const beforeDay = beforeOverview.workdays[0]
      if (!beforeDay) throw new Error("Expected the isolated workday")
      expect(beforeDay.workDate.slice(0, 10)).toBe("2026-11-20")
      expect(beforeDay.sessions).toHaveLength(1)
      const beforeSession = beforeDay.sessions[0]
      if (!beforeSession) throw new Error("Expected the isolated work session")
      expect(beforeSession.endedAt).toBeTruthy()
      const beforeDayIds = beforeOverview.workdays.map((day) => day.id)
      const beforeSessionIds = beforeOverview.workdays.flatMap((day) =>
        day.sessions.map((session) => session.id),
      )

      await page.clock.install({ time: new Date("2026-11-23T04:30:00.000Z") })
      await signIn(page, "pg007-overview")
      const overviewResponse = page.waitForResponse((response) => {
        const url = new URL(response.url())
        return (
          url.pathname === "/api/attendance/me/overview" &&
          response.request().method() === "GET"
        )
      })
      await page.goto("/attendance/overview")
      const response = await overviewResponse
      expect(response.status()).toBe(200)
      const overviewUrl = new URL(response.url())
      expect(overviewUrl.searchParams.get("from")).toBe("2026-10-24")
      expect(overviewUrl.searchParams.get("to")).toBe("2026-11-24")

      const figures = page.getByLabel("Attendance figures")
      await expect(figures).toHaveAttribute("aria-busy", "false")
      const figureValue = (label: string) =>
        figures
          .getByText(label, { exact: true })
          .locator("xpath=following-sibling::dd[1]")
          .locator("span")
          .first()
      await expect(figureValue("Attendance days")).toHaveText("1")
      await expect(figureValue("Check-ins")).toHaveText("1")
      await expect(figureValue("Check-outs")).toHaveText("1")
      await expect(
        page.getByText("100% completed", { exact: true }),
      ).toBeVisible()
      await expect(figureValue("Still clocked in")).toHaveText("0")
      await expect(
        page
          .getByText("Sessions per day", { exact: true })
          .locator("xpath=following-sibling::dd[1]"),
      ).toHaveText("1.0")
      const statusTable = page.getByRole("table").filter({
        has: page.getByRole("columnheader", {
          name: "Share",
          exact: true,
        }),
      })
      await expect(
        statusTable.getByRole("img", {
          name: "Clocked out: 1 sessions",
          exact: true,
        }),
      ).toBeVisible()
      const activityTable = page.getByRole("table").filter({
        has: page.getByRole("columnheader", {
          name: "Timestamp (UTC)",
          exact: true,
        }),
      })
      const activityRows = activityTable.locator("tbody tr")
      await expect(activityRows).toHaveCount(2)
      await expect(activityRows.nth(0)).toContainText(
        "Clocked out – Attendance PG-007 overview",
      )
      await expect(activityRows.nth(0)).toContainText("Nov 20, 2026, 2:00 AM")
      await expect(activityRows.nth(1)).toContainText(
        "Clocked in – Attendance PG-007 overview",
      )
      await expect(activityRows.nth(1)).toContainText("Nov 20, 2026, 1:00 AM")

      const afterOverview = await readFixtureHistory()
      expect(afterOverview.workdays.map((day) => day.id)).toEqual(beforeDayIds)
      expect(
        afterOverview.workdays.flatMap((day) =>
          day.sessions.map((session) => session.id),
        ),
      ).toEqual(beforeSessionIds)
    } finally {
      await clock("2026-11-13T20:00:00+08:00")
    }
  })

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 820, height: 1180 },
    { width: 1440, height: 1000 },
  ]) {
    test(
      "attendance management layout and policy panels at " +
        viewport.width +
        "px",
      async ({ page }) => {
        const date =
          viewport.width === 390
            ? "2026-11-12T02:00:00.000Z"
            : viewport.width === 820
              ? "2026-11-12T04:00:00.000Z"
              : "2026-11-12T06:00:00.000Z"
        const endDate = new Date(
          Date.parse(date) + 60 * 60 * 1000,
        ).toISOString()
        const approvedReason = `Approved ${viewport.width}px fixture request`
        await createApprovedCorrection(date, endDate, approvedReason)
        await page.setViewportSize(viewport)
        await signIn(page, "admin")
        for (const tab of ["records", "adjustments", "settings"]) {
          await page.goto("/attendance/" + tab)
          await expect(page.getByRole("table")).toBeVisible()
          if (tab === "records")
            await expect(
              page
                .getByRole("table")
                .getByRole("cell")
                .filter({ hasText: "Attendance staff" })
                .first(),
            ).toBeVisible()
          if (tab === "adjustments")
            await expect(
              page
                .getByRole("table", { name: "Attendance requests" })
                .getByRole("row")
                .filter({ hasText: approvedReason })
                .getByText("Approved", { exact: true }),
            ).toBeVisible()
          if (tab === "settings")
            await expect(
              page
                .getByRole("row")
                .filter({ hasText: "Browser flexible policy" }),
            ).toBeVisible()
          await assertNoPageOverflow(page)
          await page.screenshot({
            path: test.info().outputPath(tab + "-" + viewport.width + ".png"),
            fullPage: true,
          })
        }
        const policyRow = page
          .getByRole("row")
          .filter({ hasText: "Browser flexible policy" })
        await policyRow
          .getByRole("button", {
            name: "More actions for Browser flexible policy",
            exact: true,
          })
          .click()
        await page
          .getByRole("menuitem", { name: "View policy details", exact: true })
          .click()
        const detailsPanel = page.getByRole("dialog")
        await expect(
          detailsPanel.getByRole("heading", {
            name: "Browser flexible policy",
            exact: true,
          }),
        ).toBeVisible()
        await detailsPanel
          .getByRole("tab", { name: "Assigned people", exact: true })
          .click()
        await expect(
          detailsPanel.getByText("Attendance staff", { exact: true }),
        ).toBeVisible()
        await expect(
          detailsPanel.getByText("BROWSER-staff", { exact: false }),
        ).toBeVisible()
        await assertNoPageOverflow(page)
        await detailsPanel.screenshot({
          path: test.info().outputPath(`policy-people-${viewport.width}.png`),
        })
        const peopleWidth = await detailsPanel
          .getByRole("tabpanel")
          .evaluate((element) => ({
            content: element.scrollWidth,
            available: element.clientWidth,
          }))
        expect(peopleWidth.content).toBeLessThanOrEqual(
          peopleWidth.available + 1,
        )
        await detailsPanel
          .getByRole("tab", { name: "Overview", exact: true })
          .click()
        await expect(
          detailsPanel.getByRole("heading", {
            name: "Policy rules",
            exact: true,
          }),
        ).toBeVisible()
        await detailsPanel
          .getByRole("button", { name: "Done", exact: true })
          .click()
        await expect(page.getByRole("dialog")).toHaveCount(0)
        await page
          .getByRole("button", { name: "Create policy", exact: true })
          .click()
        const dialog = page.getByRole("dialog")
        await expect(
          dialog.getByRole("heading", {
            name: "Create attendance policy",
            exact: true,
          }),
        ).toBeVisible()
        await expect
          .poll(async () => {
            const bounds = await dialog.boundingBox()
            return bounds ? bounds.x + bounds.width : Infinity
          })
          .toBeLessThanOrEqual(viewport.width + 1)
        await dialog
          .getByRole("button", { name: "Create policy", exact: true })
          .click()
        await expect(
          page.getByLabel("Policy name", { exact: true }),
        ).toHaveAttribute("aria-invalid", "true")
        await dialog
          .getByLabel("Policy name", { exact: true })
          .fill("Draft policy")
        await page.screenshot({
          path: test
            .info()
            .outputPath("policy-panel-" + viewport.width + ".png"),
          fullPage: true,
        })
        await dialog
          .getByRole("button", { name: "Cancel", exact: true })
          .click()
        await expect(page.getByRole("dialog")).toHaveCount(0)
        await page
          .getByRole("row")
          .filter({ hasText: "Browser flexible policy" })
          .getByRole("button", {
            name: "More actions for Browser flexible policy",
            exact: true,
          })
          .click()
        await page.getByRole("menuitem", { name: "Edit", exact: true }).click()
        await expect(
          page.getByRole("heading", {
            name: "Edit attendance policy",
            exact: true,
          }),
        ).toBeVisible()
        await expect(
          page.getByLabel("Policy name", { exact: true }),
        ).toHaveValue("Browser flexible policy")
        await expect(
          page.getByLabel("Attendance timezone", { exact: true }),
        ).toHaveValue("Asia/Manila")
        // PG-008-F001-A013-T001: assigned-policy timezone remains read-only.
        await expect(
          page.getByLabel("Attendance timezone", { exact: true }),
        ).toHaveAttribute("readonly", "")
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Cancel", exact: true })
          .click()
        await expect(page.getByRole("dialog")).toHaveCount(0)
        await page
          .getByRole("button", {
            name: "Assign policy to employee",
            exact: true,
          })
          .click()
        await expect(
          page
            .getByRole("dialog")
            .getByRole("button", { name: "Assign policy", exact: true }),
        ).toBeDisabled()
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Cancel", exact: true })
          .click()
        await expect(page.getByRole("dialog")).toHaveCount(0)
      },
    )
  }
}
