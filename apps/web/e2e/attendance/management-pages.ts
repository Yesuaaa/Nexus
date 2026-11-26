import { test, expect } from "@playwright/test"
import { randomUUID } from "node:crypto"

import {
  api,
  assertNoPageOverflow,
  clock,
  createApprovedCorrection,
  fixture,
  routeAttendanceApi,
  signIn,
} from "./support"

/** Head review, time logs, policy creation and shared page design. */
export function managementPageTests() {
  test("department head reviews scoped requests and HR policy settings work", async ({
    page,
  }) => {
    const requestReason = "Standalone head review fixture request"
    const requestResponse = await fetch(`${api}/api/attendance/adjustments`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${fixture.actors.staff.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "CORRECTION",
        requestKey: randomUUID(),
        startedAt: "2026-11-10T02:00:00.000Z",
        endedAt: "2026-11-10T03:00:00.000Z",
        reason: requestReason,
      }),
    })
    expect(requestResponse.status).toBe(201)

    await signIn(page, "head")
    await page.goto("/attendance/adjustments")
    await expect(
      page.getByRole("heading", { name: "Requests & Approvals", exact: true }),
    ).toBeVisible()
    const requestRow = page.getByRole("row").filter({ hasText: requestReason })
    await requestRow
      .getByRole("button", { name: /More actions for .* request/ })
      .click()
    await page
      .getByRole("menuitem", { name: "Verify correction", exact: true })
      .click()
    await page
      .getByRole("textbox", { name: "Review note", exact: true })
      .fill("Verified the service work with the department")
    await page
      .getByRole("button", { name: "Confirm decision", exact: true })
      .click()
    await expect(page.getByText("Verified", { exact: true })).toBeVisible()
    await page.goto("/attendance/time-logs/records")
    await page
      .getByRole("button", {
        name: "View logs for Attendance staff",
        exact: true,
      })
      .click()
    await expect(
      page.getByRole("table", { name: "Attendance history" }),
    ).toBeVisible()
    await page
      .getByRole("main", { name: "Attendance workspace" })
      .getByRole("button", { name: "Employees", exact: true })
      .click()
    await page
      .getByRole("combobox", { name: "Attendance department", exact: true })
      .click()
    await page
      .getByRole("option", {
        name: "Attendance browser department",
        exact: true,
      })
      .click()
    await expect(page.getByRole("table", { name: "Employees" })).toBeVisible()
  })

  test("time logs employee table preserves filters and opens individual or all logs", async ({
    page,
  }) => {
    await signIn(page, "admin")
    await page.goto("/attendance/time-logs/records")
    const workspace = page.getByRole("main", { name: "Attendance workspace" })
    const table = page.getByRole("table", { name: "Employees", exact: true })
    await expect(table).toHaveAttribute("aria-busy", "false")
    await expect(
      page.getByRole("table", { name: "Attendance history" }),
    ).toHaveCount(0)
    const search = page.getByRole("searchbox", {
      name: "Search attendance employees",
    })
    await search.fill("No matching employee")
    await expect(
      table.getByText("No employees match your search."),
    ).toBeVisible()
    await search.fill("BROWSER-staff")
    await expect(
      table.getByRole("button", {
        name: "View logs for Attendance staff",
        exact: true,
      }),
    ).toBeVisible()
    const individual = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return (
        url.pathname === "/api/attendance/records" &&
        url.searchParams.get("employeeId") ===
          fixture.actors.staff.employeeId &&
        response.status() === 200
      )
    })
    await table
      .getByRole("button", {
        name: "View logs for Attendance staff",
        exact: true,
      })
      .click()
    await individual
    await expect(
      page.getByRole("heading", {
        name: "Time Logs for Attendance staff",
        exact: true,
      }),
    ).toBeVisible()
    await expect(table).toHaveCount(0)
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await workspace
      .getByRole("button", { name: "Employees", exact: true })
      .click()
    await expect(search).toHaveValue("BROWSER-staff")
    const all = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return (
        url.pathname === "/api/attendance/records" &&
        url.searchParams.get("employeeId") === "" &&
        response.status() === 200
      )
    })
    await page.getByRole("button", { name: "All logs", exact: true }).click()
    await all
    await expect(
      page.getByRole("heading", { name: "Time Log Records", exact: true }),
    ).toBeVisible()
    for (const width of [390, 820, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      await assertNoPageOverflow(page)
      await workspace
        .getByRole("button", { name: "Employees", exact: true })
        .click()
      await expect(table).toBeVisible()
      await assertNoPageOverflow(page)
      await page.screenshot({
        path: test.info().outputPath(`time-log-employees-${width}.png`),
        fullPage: true,
      })
      const individualReload = page.waitForResponse((response) => {
        const url = new URL(response.url())
        return (
          url.pathname === "/api/attendance/records" &&
          url.searchParams.get("employeeId") ===
            fixture.actors.staff.employeeId &&
          response.status() === 200
        )
      })
      await page
        .getByRole("button", {
          name: "View logs for Attendance staff",
          exact: true,
        })
        .click()
      await individualReload
      await expect(
        page.getByRole("table", { name: "Attendance history" }),
      ).toBeVisible()
      await assertNoPageOverflow(page)
    }
  })

  test("attendance employee search keeps a single pending state until results settle", async ({
    page,
  }) => {
    await signIn(page, "admin")
    let releaseSearch!: () => void
    let notifySearchStarted!: () => void
    const searchStarted = new Promise<void>((resolve) => {
      notifySearchStarted = resolve
    })
    const pendingSearch = new Promise<void>((resolve) => {
      releaseSearch = resolve
    })
    await page.route("**/api/attendance/employees?**", async (route) => {
      if (
        new URL(route.request().url()).searchParams.get("search") ===
        "No matching employee"
      ) {
        notifySearchStarted()
        await pendingSearch
      }
      await route.fallback()
    })
    try {
      await page.goto("/attendance/time-logs/records")
      const table = page.getByRole("table", { name: "Employees", exact: true })
      const search = page.getByRole("searchbox", {
        name: "Search attendance employees",
      })
      // Search for the seeded row because fixture growth can move it off page one.
      await search.fill("BROWSER-staff")
      await expect(
        table.getByRole("button", { name: "View logs for Attendance staff" }),
      ).toBeVisible()
      await search.fill("No matching employee")
      await searchStarted
      await expect(table).toHaveAttribute("aria-busy", "true")
      const searchSkeletons = table
        .getByRole("rowgroup")
        .nth(1)
        .getByRole("row")
      await expect(searchSkeletons).toHaveCount(10)
      for (const skeleton of await searchSkeletons.all())
        await expect(skeleton.getByRole("cell")).toHaveCount(4)
      await expect(table.getByRole("status")).toContainText(
        "Loading employees…",
      )
      await expect(
        table.getByRole("button", { name: "View logs for Attendance staff" }),
      ).toHaveCount(0)
      await expect(
        table.getByText("No employees match your search.", { exact: true }),
      ).toHaveCount(0)
      releaseSearch()
      await expect(table).toHaveAttribute("aria-busy", "false")
      await expect(
        table.getByText("No employees match your search.", { exact: true }),
      ).toBeVisible()
      await expect(table.getByRole("status")).toHaveCount(0)
    } finally {
      releaseSearch()
    }
  })

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 820, height: 1180 },
    { width: 1440, height: 1000 },
  ]) {
    test(`real attendance layout at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await signIn(page, "staff")
      await page.goto("/attendance/check-ins")
      await expect(page.getByLabel("Elapsed work")).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true)
      if (viewport.width < 768) {
        await page.getByRole("button", { name: "Open navigation menu" }).click()
        await expect(
          page
            .locator("#app-sidebar")
            .getByRole("link", { name: "Check-Ins", exact: true }),
        ).toBeVisible()
        await page
          .locator("#app-sidebar")
          .getByRole("button", { name: "Close navigation menu", exact: true })
          .click()
      } else {
        const collapse = page.getByRole("button", {
          name: "Collapse sidebar",
          exact: true,
        })
        if (await collapse.isVisible()) await collapse.click()
        await page
          .getByRole("button", { name: "Attendance", exact: true })
          .click()
        await expect(
          page.getByRole("menuitem", { name: "Check-Ins", exact: true }),
        ).toBeVisible()
        await page.keyboard.press("Escape")
      }
      await page.screenshot({
        path: test.info().outputPath(`attendance-${viewport.width}.png`),
        fullPage: true,
      })
    })
  }

  test("Admin policy creation and assignment are live; clients remain denied", async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date("2026-11-13T08:00:00Z"))
    await signIn(page, "admin")
    await page.goto("/attendance/policies/management")
    await page
      .getByRole("button", { name: "Create policy", exact: true })
      .click()
    await page
      .getByLabel("Policy name", { exact: true })
      .fill("Browser new policy")
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Create policy", exact: true })
      .click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    const createdPolicyRow = page
      .getByRole("row")
      .filter({ hasText: "Browser new policy" })
    await expect(createdPolicyRow).toBeVisible()
    // PG-008-F001-A006-T001 adds row-projection checks to the existing
    // browser/API/PGlite create-and-assign workflow; C001 remains deferred.
    await expect(
      createdPolicyRow.getByText("Flexible", { exact: true }),
    ).toBeVisible()
    await expect(
      createdPolicyRow.getByRole("cell", { name: "Asia/Manila", exact: true }),
    ).toBeVisible()
    await expect(
      createdPolicyRow.getByRole("cell", { name: "0 hrs/week", exact: true }),
    ).toBeVisible()
    await expect(
      createdPolicyRow.getByRole("cell", {
        name: "0 assignments",
        exact: true,
      }),
    ).toBeVisible()
    await page
      .getByRole("button", { name: "Assign policy to employee", exact: true })
      .click()
    await page
      .getByRole("checkbox", { name: "Select Attendance staff", exact: true })
      .check()
    await page
      .getByRole("combobox", { name: "Attendance policy", exact: true })
      .click()
    await page.getByRole("option", { name: /Browser new policy/ }).click()
    await page
      .getByRole("button", { name: "Effective from", exact: true })
      .click()
    await page
      .getByRole("button", { name: "Monday, November 16, 2026", exact: true })
      .click()
    await page
      .getByRole("button", { name: "Assign policy", exact: true })
      .click()
    await page
      .getByRole("button", { name: "Confirm assignment", exact: true })
      .click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(
      createdPolicyRow.getByRole("cell", {
        name: "1 assignments",
        exact: true,
      }),
    ).toBeVisible()
    const clientPage = await page.context().newPage()
    await signIn(clientPage, "client")
    await routeAttendanceApi(clientPage)
    await clientPage.goto("/attendance/check-ins")
    await expect(clientPage).toHaveURL(/\/dashboard$/)
    await clientPage.close()
  })

  test("Admin can create and inspect a fixed overnight schedule", async ({
    page,
  }) => {
    await clock("2026-11-13T20:00:00+08:00")
    await page.clock.setFixedTime(new Date("2026-11-13T12:00:00Z"))
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, "admin")
    await page.goto("/attendance/policies/management")
    await page
      .getByRole("button", { name: "Create policy", exact: true })
      .click()
    const editor = page.getByRole("dialog")
    await editor
      .getByLabel("Policy name", { exact: true })
      .fill("Browser fixed shift")
    await editor.getByRole("combobox", { name: "Schedule type" }).click()
    await page
      .getByRole("option", { name: "Fixed schedule", exact: true })
      .click()
    await editor.getByRole("checkbox", { name: "Monday", exact: true }).check()
    await expect(editor.getByLabel("Monday required hours")).toHaveCount(0)
    await editor.getByLabel("Monday start time").fill("22:00")
    await editor.getByLabel("Monday end time").fill("06:00")
    const unpaidBreaks = editor.getByRole("checkbox", {
      name: /Allow employees to record unpaid breaks/,
    })
    const breakMinutes = editor.getByLabel(
      "Monday scheduled unpaid break minutes",
    )
    await expect(unpaidBreaks.or(breakMinutes).first()).toHaveAccessibleName(
      /Allow employees to record unpaid breaks/,
    )
    await unpaidBreaks.uncheck()
    await expect(breakMinutes).toHaveCount(0)
    await unpaidBreaks.check()
    await breakMinutes.fill("30")
    await editor
      .getByRole("button", { name: "Create policy", exact: true })
      .click()
    await expect(editor).toHaveCount(0)
    const row = page.getByRole("row").filter({ hasText: "Browser fixed shift" })
    await expect(row.getByText("Fixed schedule", { exact: true })).toBeVisible()
    await expect(row.getByText(/7\.5 hrs\/week/)).toBeVisible()
    await row
      .getByRole("button", { name: "More actions for Browser fixed shift" })
      .click()
    await page.getByRole("menuitem", { name: "View policy details" }).click()
    const details = page.getByRole("dialog")
    await expect(details.getByText("22:00–06:00 (next day)")).toBeVisible()
    await expect(
      details.getByText("7.5 required hours · 30 min unpaid break"),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true)
    await details.getByRole("button", { name: "Done", exact: true }).click()
    await page
      .getByRole("button", {
        name: "More actions for Browser flexible policy",
        exact: true,
      })
      .click()
    await page.getByRole("menuitem", { name: "View policy details" }).click()
    await details.getByRole("tab", { name: "Assigned people" }).click()
    const head = details
      .getByRole("listitem")
      .filter({ hasText: "Attendance head" })
    await page.setViewportSize({ width: 1000, height: 844 })
    await expect(
      head.getByRole("button", { name: "Replace policy", exact: true }),
    ).toBeVisible()
    await expect(
      head.getByRole("button", { name: "End assignment", exact: true }),
    ).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await head
      .getByRole("button", { name: "End assignment", exact: true })
      .click()
    const end = head.getByRole("alertdialog", {
      name: "End Attendance head’s assignment?",
    })
    await expect(
      end.getByText(/Coverage ends at the start of tomorrow in Asia\/Manila/),
    ).toBeVisible()
    const cancelEnd = end.getByRole("button", { name: "Cancel", exact: true })
    await expect(cancelEnd).toBeFocused()
    await cancelEnd.press("Escape")
    const endAssignment = head.getByRole("button", {
      name: "End assignment",
      exact: true,
    })
    await expect(end).toHaveCount(0)
    await expect(endAssignment).toBeFocused()
    const endRoute = "**/api/attendance/assignments/*/unassign"
    await page.route(endRoute, (route) =>
      route.fulfill({
        status: 409,
        json: { error: "Recorded attendance prevents ending this assignment." },
      }),
    )
    await endAssignment.click()
    const endRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" && request.url().endsWith("/unassign"),
    )
    await end
      .getByRole("button", { name: "End assignment", exact: true })
      .click()
    expect((await endRequest).postDataJSON()).toEqual({
      expectedStatus: "CURRENT",
    })
    await expect(end.getByRole("alert")).toHaveText(
      "Recorded attendance prevents ending this assignment.",
    )
    await cancelEnd.click()
    await expect(end).toHaveCount(0)
    await page.unroute(endRoute)
    await head
      .getByRole("button", { name: "Replace policy", exact: true })
      .click()
    const replacement = page.getByRole("dialog", {
      name: "Replace attendance policy",
      exact: true,
    })
    await expect(
      replacement.getByText(
        /replace Browser flexible policy for Attendance head/,
      ),
    ).toBeVisible()
    await expect(
      replacement.getByRole("button", { name: "Cancel", exact: true }),
    ).toHaveCount(0)
    await replacement.getByRole("button", { name: "Back", exact: true }).click()
    await expect(
      details.getByRole("tab", { name: "Assigned people", selected: true }),
    ).toBeVisible()
    await head
      .getByRole("button", { name: "Replace policy", exact: true })
      .click()
    await replacement
      .getByRole("combobox", { name: "Attendance policy" })
      .click()
    await expect(
      page.getByRole("option", { name: /Browser flexible policy/ }),
    ).toHaveCount(0)
    await page.getByRole("option", { name: /Browser fixed shift/ }).click()
    await replacement.getByRole("button", { name: "Effective from" }).click()
    await page
      .getByRole("button", { name: "Monday, November 16, 2026", exact: true })
      .click()
    await replacement
      .getByRole("button", { name: "Replace policy", exact: true })
      .click()
    const confirmation = page.getByRole("dialog", {
      name: "Replace attendance policy?",
      exact: true,
    })
    await expect(
      confirmation.getByText(/2026-11-16 at midnight in Asia\/Manila/),
    ).toBeVisible()
    await confirmation
      .getByRole("button", { name: "Confirm replacement" })
      .click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await row
      .getByRole("button", { name: "More actions for Browser fixed shift" })
      .click()
    await page.getByRole("menuitem", { name: "View policy details" }).click()
    await details.getByRole("tab", { name: "Assigned people" }).click()
    await expect(head.getByText("Scheduled", { exact: true })).toBeVisible()
    await head
      .getByRole("button", { name: "Cancel scheduled assignment", exact: true })
      .click()
    await page
      .getByRole("dialog", { name: "Cancel scheduled assignment?" })
      .getByRole("button", { name: "Cancel scheduled assignment", exact: true })
      .click()
    await expect(
      details.getByText("No people assigned to this policy yet."),
    ).toBeVisible()
    await details.getByRole("button", { name: "Done", exact: true }).click()
    const directory = await fetch(`${api}/api/attendance/policies`, {
      headers: { authorization: `Bearer ${fixture.actors.admin.token}` },
    })
    const { policies } = (await directory.json()) as {
      policies: { id: string; name: string }[]
    }
    const policy = policies.find(({ name }) => name === "Browser fixed shift")
    expect(policy).toBeDefined()
    const path = `${api}/api/attendance/policies/${policy!.id}`
    const headers = { authorization: `Bearer ${fixture.actors.admin.token}` }
    expect(
      (await fetch(`${path}/archive`, { method: "POST", headers })).ok,
    ).toBe(true)
    expect((await fetch(path, { method: "DELETE", headers })).ok).toBe(true)
  })

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 820, height: 1180 },
    { width: 1440, height: 1000 },
  ]) {
    test(`real HR policy context in workload at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await page.clock.setFixedTime(new Date("2026-11-13T08:00:00Z"))
      const response = await fetch(`${api}/api/workload/capacity`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${fixture.actors.head.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          employeeId: fixture.actors.staff.employeeId,
          week: "2026-11-09",
          scheduledHours: 40,
          timeOffHours: 8,
        }),
      })
      expect(response.status).toBe(200)
      await signIn(page, "head")
      await page.goto("/staff-workload")
      await expect(page.getByText("0 / 32 hrs", { exact: true })).toBeVisible()
      await page
        .getByRole("button", {
          name: "More actions for Attendance staff",
          exact: true,
        })
        .click()
      await page
        .getByRole("menuitem", { name: "View workload", exact: true })
        .click()
      const drawer = page.getByRole("dialog")
      await expect(
        drawer.getByText("56 hrs/week", { exact: true }),
      ).toBeVisible()
      await expect(drawer.getByText("32 hrs", { exact: true })).toBeVisible()
      await expect(drawer.getByText("Unknown", { exact: true })).toBeVisible()
      await expect(
        drawer
          .getByLabel("Daily policy requirements", { exact: true })
          .locator("dt"),
      ).toHaveCount(7)
      await expect(drawer).toContainText(
        "Clock-in status and attendance hours do not establish task availability or productivity.",
      )
      await expect(drawer).toContainText(
        "No known timed commitments from supported sources. Free time is unconfirmed.",
      )
      await expect
        .poll(async () => {
          const bounds = await drawer.boundingBox()
          return bounds ? bounds.x + bounds.width : Infinity
        })
        .toBeLessThanOrEqual(viewport.width + 1)
      expect((await drawer.boundingBox())!.x).toBeGreaterThanOrEqual(0)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true)
      await page.screenshot({
        path: test
          .info()
          .outputPath(`workload-hr-context-${viewport.width}.png`),
        fullPage: true,
      })
    })
  }

  test("loaded attendance screens follow the Department Management design", async ({
    page,
  }) => {
    const approvedReason = "Approved design fixture request"
    await createApprovedCorrection(
      "2026-11-11T02:00:00.000Z",
      "2026-11-11T03:00:00.000Z",
      approvedReason,
    )
    await page.setViewportSize({ width: 1440, height: 1000 })
    await signIn(page, "admin")
    await page.goto("/departments")
    await expect(
      page
        .getByRole("table")
        .getByText("Attendance browser department", { exact: true }),
    ).toBeVisible()
    const reference = await page.locator("main h1").evaluate((heading) => ({
      size: getComputedStyle(heading).fontSize,
      weight: getComputedStyle(heading).fontWeight,
    }))
    await page.screenshot({
      path: test.info().outputPath("reference-departments.png"),
      fullPage: true,
    })
    await page.goto("/employees")
    await expect(
      page.getByRole("table").getByText("Attendance staff", { exact: true }),
    ).toBeVisible()
    await page.screenshot({
      path: test.info().outputPath("reference-employees.png"),
      fullPage: true,
    })
    for (const tab of [
      "overview",
      "my",
      "records",
      "adjustments",
      "settings",
    ]) {
      await page.goto("/attendance/" + tab)
      if (tab === "overview")
        await expect(
          page.getByRole("heading", {
            name: "Personal attendance",
            exact: true,
          }),
        ).toBeVisible()
      if (tab === "my")
        await expect(page.getByLabel("Elapsed work")).toBeVisible()
      if (tab === "records")
        await expect(
          page.getByRole("table", { name: "Employees" }),
        ).toHaveAttribute("aria-busy", "false")
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
          page.getByRole("row").filter({ hasText: "Browser flexible policy" }),
        ).toBeVisible()
      expect(
        await page.locator("main h1").evaluate((heading) => ({
          size: getComputedStyle(heading).fontSize,
          weight: getComputedStyle(heading).fontWeight,
        })),
      ).toEqual(reference)
      await assertNoPageOverflow(page)
      await page.screenshot({
        path: test.info().outputPath("attendance-" + tab + ".png"),
        fullPage: true,
      })
    }
  })
}
