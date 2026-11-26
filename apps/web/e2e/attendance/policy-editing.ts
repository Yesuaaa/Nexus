import { test, expect } from "@playwright/test"

import {
  type PolicyOverviewSummary,
  api,
  assertNoPageOverflow,
  clock,
  fixture,
  focusLinkByTab,
  policyFigureValue,
  policyOverviewSection,
  signIn,
} from "./support"

/** Policy editing and lifecycle actions. */
export function policyEditingTests() {
  test("policy editing updates the existing row and archive/restore/delete reuse the directory actions", async ({
    page,
  }) => {
    await signIn(page, "admin")
    await page.goto("/attendance/policies/management")
    await page
      .getByRole("button", { name: "Create policy", exact: true })
      .click()
    await page
      .getByLabel("Policy name", { exact: true })
      .fill("Lifecycle policy")
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Create policy", exact: true })
      .click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    const original = page
      .getByRole("row")
      .filter({ hasText: "Lifecycle policy" })
    const originalId = await original
      .getByRole("button", {
        name: "More actions for Lifecycle policy",
        exact: true,
      })
      .getAttribute("id")
    await original
      .getByRole("button", {
        name: "More actions for Lifecycle policy",
        exact: true,
      })
      .click()
    await page.getByRole("menuitem", { name: "Edit", exact: true }).click()
    await expect(page.getByLabel("Policy name", { exact: true })).toHaveValue(
      "Lifecycle policy",
    )
    await page
      .getByLabel("Policy name", { exact: true })
      .fill("Updated lifecycle policy")
    await page.getByRole("checkbox", { name: "Monday", exact: true }).check()
    await page.getByLabel("Monday required hours", { exact: true }).fill("6")
    await page.getByRole("button", { name: "Save policy", exact: true }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    const updated = page
      .getByRole("row")
      .filter({ hasText: "Updated lifecycle policy" })
    await expect(updated).toContainText("6 hrs/week")
    await expect(
      updated.getByRole("button", {
        name: "More actions for Updated lifecycle policy",
        exact: true,
      }),
    ).toHaveAttribute("id", originalId!)
    await expect(
      page.getByRole("button", {
        name: "More actions for Lifecycle policy",
        exact: true,
      }),
    ).toHaveCount(0)
    async function action(label: string) {
      await page
        .getByRole("button", {
          name: "More actions for Updated lifecycle policy",
          exact: true,
        })
        .click()
      await page.getByRole("menuitem", { name: label, exact: true }).click()
    }
    async function status(label: string) {
      await page
        .getByRole("group", { name: "Policy view", exact: true })
        .getByRole("button", { name: label, exact: true })
        .click()
    }
    await action("Archive")
    await page
      .getByRole("button", { name: "Archive policy", exact: true })
      .click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(updated).toHaveCount(0)
    await status("Archived policies")
    await expect(updated).toBeVisible()
    await action("Restore")
    await page
      .getByRole("button", { name: "Restore policy", exact: true })
      .click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(updated).toHaveCount(0)
    await status("Active policies")
    await expect(updated).toBeVisible()
    await action("Archive")
    await page
      .getByRole("button", { name: "Archive policy", exact: true })
      .click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await status("Archived policies")
    await action("Delete permanently")
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete permanently", exact: true })
      .click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(updated).toHaveCount(0)
  })

  for (const width of [390, 820, 1440]) {
    test(
      "grouped attendance pages use live scoped data at " + width + "px",
      async ({ page }) => {
        test.setTimeout(90000)
        await page.setViewportSize({ width, height: 1000 })
        await signIn(page, "admin")
        const pages = [
          ["overview", "Attendance Overview", "/api/attendance/me/overview"],
          ["my", "Check-Ins", "/api/attendance/me/current"],
          [
            "time-logs/overview",
            "Time Logs Overview",
            "/api/attendance/overview",
          ],
          ["records", "Time Log Records", "/api/attendance/employees"],
          ["audit", "Attendance Audit Trail", "/api/attendance/audit"],
          [
            "requests/overview",
            "Requests & Approvals Overview",
            "/api/attendance/adjustments/overview",
          ],
          ["requests/overtime", "Overtime", "/api/attendance/adjustments"],
          [
            "requests/corrections",
            "Attendance Corrections",
            "/api/attendance/adjustments",
          ],
          [
            "policies/overview",
            "Policies Overview",
            "/api/attendance/policies",
          ],
          ["settings", "Policy Management", "/api/attendance/policies"],
        ]
        for (const [path, title, endpoint] of pages) {
          let myWorkDate: string | null = null
          let myWorkdayId: string | null = null
          if (path === "my") {
            myWorkDate =
              width === 390
                ? "2026-11-20"
                : width === 820
                  ? "2026-11-21"
                  : "2026-11-22"
            const adminHeaders = {
              authorization: `Bearer ${fixture.actors.admin.token}`,
              "content-type": "application/json",
            }
            await clock(`${myWorkDate}T09:00:00+08:00`)
            const started = await fetch(`${api}/api/attendance/me/clock-in`, {
              method: "POST",
              headers: adminHeaders,
              body: "{}",
            })
            expect(started.status, await started.clone().text()).toBe(201)
            const startState = (await started.json()) as {
              workday: { id: string; activeSessionId: string | null }
            }
            myWorkdayId = startState.workday.id
            expect(startState.workday.activeSessionId).toBeTruthy()
            await clock(`${myWorkDate}T10:00:00+08:00`)
            const ended = await fetch(`${api}/api/attendance/me/clock-out`, {
              method: "POST",
              headers: adminHeaders,
              body: JSON.stringify({
                sessionId: startState.workday.activeSessionId,
              }),
            })
            expect(ended.status, await ended.clone().text()).toBe(200)
          }
          const read = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === endpoint &&
              response.request().method() === "GET",
          )
          await page.goto("/attendance/" + path)
          const response = await read
          expect(response.status()).toBe(200)
          await expect(
            page.getByRole("heading", { name: title, exact: true }),
          ).toBeVisible()
          await expect(
            page.getByRole("button", { name: "Retry", exact: true }),
          ).toHaveCount(0)
          if (path === "time-logs/overview") {
            const main = page.getByRole("main", {
              name: "Attendance workspace",
            })
            for (const title of ["Recorded session status", "Coverage"])
              await expect(
                main.getByRole("heading", { name: title, exact: true }),
              ).toBeVisible()
            await expect(
              main.getByRole("link", { name: "View records", exact: true }),
            ).toHaveAttribute("href", "/attendance/time-logs/records")
            await expect(
              main.getByRole("link", { name: "Open audit trail", exact: true }),
            ).toHaveCount(0)
          }
          if (
            [
              "overview",
              "time-logs/overview",
              "requests/overview",
              "policies/overview",
            ].includes(path)
          ) {
            const kpis = page
              .getByRole("main", { name: "Attendance workspace" })
              .locator("dl[aria-busy]")
            await expect(kpis).toHaveCount(1)
            await expect(kpis).toHaveAttribute("aria-busy", "false")
            const cards = kpis.getByRole("term")
            await expect(cards).toHaveCount(4)
            const columns = await kpis.evaluate(
              (element) =>
                getComputedStyle(element).gridTemplateColumns.split(" ").length,
            )
            expect(columns).toBe(4)
          }
          if (path === "policies/overview") {
            // PG-009-F001-A002-T001: retain the existing live page assertions and
            // verify the production client starts with the approved query tuple.
            const requestUrl = new URL(response.url())
            expect(requestUrl.searchParams.get("page")).toBe("1")
            expect(requestUrl.searchParams.get("size")).toBe("200")
            expect(requestUrl.searchParams.has("status")).toBe(false)
            expect(requestUrl.searchParams.has("search")).toBe(false)
            const payload = (await response.json()) as {
              summary: PolicyOverviewSummary
            }

            // PG-009-F001-A003-T003: compare rendered KPIs with this real
            // Next-proxy → Express → Prisma/PGlite response.
            for (const [label, value] of [
              ["Policies", payload.summary.totalPolicies],
              ["Active", payload.summary.activePolicies],
              ["Archived", payload.summary.archivedPolicies],
              ["Assignment periods", payload.summary.assignmentPeriods],
            ] as const)
              await expect(policyFigureValue(page, label)).toHaveText(
                String(value),
              )

            // PG-009-F001-A008-T001 and A011-T001: preserve native links, verify
            // their canonical destination and keyboard focus at every width.
            const manage = page.getByRole("link", {
              name: "Manage policies",
              exact: true,
            })
            const openManagement = page.getByRole("link", {
              name: "Open policy management",
              exact: true,
            })
            await expect(manage).toHaveAttribute(
              "href",
              "/attendance/policies/management",
            )
            await expect(openManagement).toHaveAttribute(
              "href",
              "/attendance/policies/management",
            )
            await focusLinkByTab(page, manage)
            await expect(manage).toBeFocused()
            await focusLinkByTab(page, openManagement)
            await expect(openManagement).toBeFocused()

            const inventory = policyOverviewSection(
              page,
              "Recent policy inventory",
            )
            const timeZoneHeader = inventory.getByRole("columnheader", {
              name: "Time zone",
              exact: true,
            })
            if (width <= 560) await expect(timeZoneHeader).toBeHidden()
            else await expect(timeZoneHeader).toBeVisible()

            if (width === 1440) {
              await manage.click()
              await expect(page).toHaveURL(
                /\/attendance\/policies\/management$/,
              )
              await expect(
                page.getByRole("heading", {
                  name: "Policy Management",
                  exact: true,
                }),
              ).toBeVisible()
              await page.goBack()
              await expect(
                page.getByRole("heading", {
                  name: "Policies Overview",
                  exact: true,
                }),
              ).toBeVisible()
            }
          }
          await assertNoPageOverflow(page)
          if (path === "my") {
            // PG-006-F001-A011-T024 adds Check-Ins control and dialog usability
            // assertions to the existing 390/820/1440 px attendance matrix.
            await expect(page.getByLabel("Attendance from date")).toBeVisible()
            await expect(
              page.getByLabel("Attendance through date"),
            ).toBeVisible()
            if (!myWorkDate)
              throw new Error("Check-Ins workday date was not set")
            const workDate = myWorkDate
            await page.getByLabel("Attendance from date").fill(workDate)
            await page.getByLabel("Attendance through date").fill(workDate)
            const history = page
              .getByRole("table", {
                name: "Attendance history",
              })
              .last()
            const dayRow = history
              .getByRole("row")
              .filter({ hasText: workDate })
            await expect(dayRow).toBeVisible()
            if (!myWorkdayId)
              throw new Error("Check-Ins workday was not seeded")
            const rowActions = page
              .locator(`[id="attendance-history-actions-${myWorkdayId}"]`)
              .last()
            await rowActions.click()
            await expect(rowActions).toHaveAttribute("aria-expanded", "true")
            const viewDetails = page.getByRole("menuitem", {
              name: "View details",
              exact: true,
            })
            await expect(viewDetails).toBeVisible()
            await viewDetails.click()
            const detailTitle = page.getByText(
              `Attendance details for ${workDate}`,
              { exact: true },
            )
            await expect(detailTitle).toBeVisible()
            await page
              .getByRole("button", { name: "Done", exact: true })
              .click()
            await expect(detailTitle).toHaveCount(0)
            const clockIn = page.getByRole("button", {
              name: "Clock in",
              exact: true,
            })
            await expect(clockIn).toBeEnabled()
            await clockIn.click()
            const clockDialog = page.getByRole("dialog", { name: "Clock in" })
            await expect(clockDialog).toBeVisible()
            await clockDialog
              .getByRole("button", { name: "Cancel", exact: true })
              .click()
            await expect(clockDialog).toHaveCount(0)
            const missingAttendance = page.getByRole("button", {
              name: "Request missing attendance",
              exact: true,
            })
            await expect(missingAttendance).toBeVisible()
            await missingAttendance.click()
            const correctionDialog = page.getByRole("dialog")
            await expect(
              correctionDialog.getByLabel("Actual clock-in", { exact: true }),
            ).toBeVisible()
            await expect(
              correctionDialog.getByLabel("Actual clock-out", { exact: true }),
            ).toBeVisible()
            await correctionDialog
              .getByRole("button", { name: "Cancel", exact: true })
              .click()
            await expect(correctionDialog).toHaveCount(0)
            await assertNoPageOverflow(page)
          }
          if (path === "requests/overtime" || path === "requests/corrections") {
            await expect(
              page.getByRole("table", { name: "Attendance requests" }),
            ).toHaveAttribute("aria-busy", "false")
            const filtered = page.waitForResponse(
              (response) =>
                new URL(response.url()).pathname === endpoint &&
                new URL(response.url()).searchParams.get("status") ===
                  "APPROVED",
            )
            await page
              .getByRole("combobox", { name: "Request status filter" })
              .click()
            await page
              .getByRole("option", { name: "Approved", exact: true })
              .click()
            const response = await filtered
            const body = (await response.json()) as {
              adjustments: { type: string; status: string }[]
            }
            expect(
              body.adjustments.every(
                (row) =>
                  row.status === "APPROVED" &&
                  row.type ===
                    (path.endsWith("overtime") ? "OVERTIME" : "CORRECTION"),
              ),
            ).toBe(true)
          }
          if (path === "audit") {
            await page
              .getByRole("button", { name: /View audit event/ })
              .first()
              .click()
            await expect(
              page.getByRole("heading", {
                name: "Audit event details",
                exact: true,
              }),
            ).toBeVisible()
            await expect(
              page.getByRole("heading", {
                name: "Change details",
                exact: true,
              }),
            ).toBeVisible()
            await page
              .getByRole("button", { name: "Done", exact: true })
              .click()
            await expect(
              page.getByRole("heading", {
                name: "Audit event details",
                exact: true,
              }),
            ).toHaveCount(0)
          }
          await page.screenshot({
            path: test
              .info()
              .outputPath(path.replaceAll("/", "-") + "-" + width + ".png"),
            fullPage: true,
          })
        }
        if (width < 768)
          await page
            .getByRole("button", { name: "Open navigation menu" })
            .click()
        const menu = page.getByRole("navigation", {
          name: "Main menu",
          exact: true,
        })
        for (const name of [
          "Attendance",
          "Time Logs",
          "Requests & Approvals",
          "Policies",
        ])
          await expect(
            menu.getByRole("button", { name, exact: true }),
          ).toBeVisible()
        if (width >= 768) {
          const expand = page.getByRole("button", {
            name: "Expand sidebar",
            exact: true,
          })
          if (await expand.isVisible()) await expand.click()
        }
        await menu
          .getByRole("button", { name: "Time Logs", exact: true })
          .click()
        await expect(
          menu.getByRole("link", { name: "Time Logs Overview", exact: true }),
        ).toBeVisible()
        await menu
          .getByRole("link", { name: "Time Logs Overview", exact: true })
          .click()
        await expect(page).toHaveURL(/attendance\/time-logs\/overview$/)
        if (width < 768)
          await expect(page.locator("#app-sidebar")).toHaveAttribute(
            "data-drawer-open",
            "false",
          )
        else {
          await page
            .getByRole("button", { name: "Collapse sidebar", exact: true })
            .click()
          await page
            .getByRole("button", { name: "Policies", exact: true })
            .click()
          await expect(
            page.getByRole("menuitem", { name: "Assignments", exact: true }),
          ).toHaveCount(0)
        }
      },
    )
  }
}
