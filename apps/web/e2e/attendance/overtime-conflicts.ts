import { test, expect, type Browser } from "@playwright/test"
import { randomUUID } from "node:crypto"

import {
  fixture,
  overtimeAdjustments,
  overtimeFixtureCall,
  overtimePage,
  overtimeResponse,
  overtimeRowMenu,
  requestGate,
  routeAttendanceApi,
  seedOvertimeReview,
  signIn,
} from "./support"

async function recordWinningOvertimeDecision(
  browser: Browser,
  origin: string,
  id: string,
  decision: "Approve" | "Reject",
  note: string,
) {
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    await routeAttendanceApi(page)
    await signIn(page, "superadmin")
    await page.goto(origin + overtimePage)
    await overtimeRowMenu(page, id).click()
    await page.getByRole("menuitem", { name: `${decision} request` }).click()
    const panel = page.getByRole("dialog", { name: `${decision} overtime` })
    await panel.getByRole("textbox", { name: "Review note" }).fill(note)
    const saved = overtimeResponse(
      page,
      "POST",
      `${overtimeAdjustments}/${id}/review`,
    )
    await panel.getByRole("button", { name: "Confirm decision" }).click()
    const response = await saved
    expect(response.status(), await response.text()).toBe(200)
    expect(await response.json()).toMatchObject({
      adjustment: {
        status: decision === "Approve" ? "APPROVED" : "REJECTED",
        reviewedById: fixture.actors.superadmin.userId,
        reviewNote: note,
      },
    })
  } finally {
    await context.close()
  }
}

/** Concurrent overtime decisions. */
export function overtimeConflictTests() {
  test("overtime conflict recovers a stale HR approval after Superadmin rejection", async ({
    page,
    browser,
  }) => {
    const { id } = await seedOvertimeReview("2026-10-31")
    const path = `${overtimeAdjustments}/${id}`
    await signIn(page, "admin")
    await page.goto(overtimePage)
    const menu = overtimeRowMenu(page, id)
    await menu.click()
    await page.getByRole("menuitem", { name: "Approve request" }).click()
    const panel = page.getByRole("dialog", { name: "Approve overtime" })
    await expect(
      panel.getByText("Verified — awaiting HR", { exact: true }),
    ).toBeVisible()
    const note = panel.getByRole("textbox", { name: "Review note" })
    const confirm = panel.getByRole("button", { name: "Confirm decision" })
    await note.fill("  abc")
    const reads: string[] = []
    page.on("request", (request) => {
      const url = new URL(request.url())
      if (
        request.method() === "GET" &&
        [`/api${path}`, `/api${overtimeAdjustments}`].includes(url.pathname)
      )
        reads.push(url.pathname)
    })
    const invalid = overtimeResponse(page, "POST", `${path}/review`)
    await confirm.click()
    expect((await invalid).status()).toBe(400)
    await expect(panel.getByRole("alert")).toHaveText(
      "Provide a valid name or reason",
    )
    await expect(note).toHaveValue("  abc")
    await expect(confirm).toBeEnabled()
    expect(reads).toEqual([])
    await note.fill("HR approval prepared before the competing rejection")

    const rejection = "Superadmin rejection from a separate browser session"
    await recordWinningOvertimeDecision(
      browser,
      new URL(page.url()).origin,
      id,
      "Reject",
      rejection,
    )
    const conflict = overtimeResponse(page, "POST", `${path}/review`)
    await confirm.click()
    expect((await conflict).status()).toBe(409)
    const detail = page.getByRole("dialog", { name: "Overtime request" })
    await expect(detail.getByRole("alert")).toHaveText(
      "This request has already been reviewed",
      { timeout: 5000 },
    )
    await expect(detail.getByText("Rejected", { exact: true })).toBeVisible()
    await expect(detail.getByText(rejection, { exact: true })).toBeVisible()
    await expect(
      detail.getByRole("button", { name: "Confirm decision" }),
    ).toHaveCount(0)
    // PG-012-F001-A015-T001: the current winning state is read-only on the
    // canonical Overtime route; the stale HR note input must not remain usable.
    await expect(
      detail.getByRole("textbox", { name: "Review note" }),
    ).toHaveCount(0)
    await expect
      .poll(() => reads)
      .toEqual(
        expect.arrayContaining([`/api${path}`, `/api${overtimeAdjustments}`]),
      )
    await detail.getByRole("button", { name: "Done" }).click()
    await expect(page.getByRole("row").filter({ has: menu })).toContainText(
      "Rejected",
    )
    await menu.click()
    await expect(
      page.getByRole("menuitem", { name: /Approve request|Reject request/ }),
    ).toHaveCount(0)
    await page.getByRole("menuitem", { name: "View details" }).click()
    await expect(detail.getByText(rejection, { exact: true })).toBeVisible()
  })

  test("[PG-004-F001-A010-T015] mixed queue reconciles a concurrent overtime decision", async ({
    page,
    browser,
  }) => {
    const { id } = await seedOvertimeReview(
      "2026-11-21",
      true,
      "correction-dst",
    )
    const path = `${overtimeAdjustments}/${id}`
    const winningNote = `Superadmin rejected mixed-route overtime ${randomUUID()}`
    await signIn(page, "admin")
    await page.goto(overtimeAdjustments)
    const menu = overtimeRowMenu(page, id)
    await expect(menu).toBeVisible()
    await menu.click()
    await page
      .getByRole("menuitem", { name: "Approve request", exact: true })
      .click()
    const review = page.getByRole("dialog", { name: "Approve overtime" })
    await review
      .getByRole("textbox", { name: "Review note", exact: true })
      .fill("HR approval prepared before the competing decision")

    await recordWinningOvertimeDecision(
      browser,
      new URL(page.url()).origin,
      id,
      "Reject",
      winningNote,
    )
    const stale = overtimeResponse(page, "POST", `${path}/review`)
    await review
      .getByRole("button", { name: "Confirm decision", exact: true })
      .click()
    const conflict = await stale
    expect(conflict.status()).toBe(409)

    const details = page.getByRole("dialog", { name: "Overtime request" })
    await expect(details.getByRole("alert")).toHaveText(
      "This request has already been reviewed",
    )
    await expect(details.getByText("Rejected", { exact: true })).toBeVisible()
    await expect(details.getByText(winningNote, { exact: true })).toBeVisible()
    await expect(
      details.getByRole("textbox", { name: "Review note", exact: true }),
    ).toHaveCount(0)
    await expect(
      details.getByRole("button", { name: "Confirm decision", exact: true }),
    ).toHaveCount(0)
    await details.getByRole("button", { name: "Done", exact: true }).click()
    await expect(page.getByRole("row").filter({ has: menu })).toContainText(
      "Rejected",
    )
    await menu.click()
    await expect(
      page.getByRole("menuitem", { name: "Approve request", exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("menuitem", { name: "Reject request", exact: true }),
    ).toHaveCount(0)

    const persisted = await overtimeFixtureCall("admin", path)
    expect(persisted.status, await persisted.clone().text()).toBe(200)
    expect(await persisted.json()).toMatchObject({
      adjustment: {
        id,
        status: "REJECTED",
        reviewNote: winningNote,
        reviewedById: fixture.actors.superadmin.userId,
      },
    })
  })

  test("overtime conflict shows the winning approval after a stale rejection leaves the filtered queue", async ({
    page,
    browser,
  }) => {
    const { id } = await seedOvertimeReview("2026-11-01")
    const path = `${overtimeAdjustments}/${id}`
    await signIn(page, "admin")
    await page.goto(overtimePage)
    await page.getByRole("combobox", { name: "Request status filter" }).click()
    await page.getByRole("option", { name: "Verified", exact: true }).click()
    const menu = overtimeRowMenu(page, id)
    await menu.click()
    await page.getByRole("menuitem", { name: "Reject request" }).click()
    const panel = page.getByRole("dialog", { name: "Reject overtime" })
    await panel
      .getByRole("textbox", { name: "Review note" })
      .fill("HR rejection prepared before the competing approval")
    const approval = "Superadmin approval from a separate browser session"
    await recordWinningOvertimeDecision(
      browser,
      new URL(page.url()).origin,
      id,
      "Approve",
      approval,
    )
    const conflict = overtimeResponse(page, "POST", `${path}/review`)
    await panel.getByRole("button", { name: "Confirm decision" }).click()
    expect((await conflict).status()).toBe(409)
    const detail = page.getByRole("dialog", { name: "Overtime request" })
    await expect(detail.getByRole("alert")).toHaveText(
      "This request has already been reviewed",
    )
    await expect(detail.getByText("Approved", { exact: true })).toBeVisible()
    await expect(detail.getByText(approval, { exact: true })).toBeVisible()
    await expect(
      detail.getByRole("textbox", { name: "Review note" }),
    ).toHaveCount(0)
    await detail.getByRole("button", { name: "Done" }).click()
    await expect(
      page.getByRole("combobox", { name: "Request status filter" }),
    ).toHaveText("Verified")
    await expect(
      page.getByRole("table", { name: "Attendance requests" }),
    ).toHaveAttribute("aria-busy", "false")
    await expect(menu).toHaveCount(0)
  })

  test("overtime conflict clears private details after the Head loses review access", async ({
    page,
  }) => {
    const { id, employee, reason } = await seedOvertimeReview(
      "2026-11-02",
      false,
    )
    const path = `${overtimeAdjustments}/${id}`
    await signIn(page, "head")
    await page.goto(overtimePage)
    const menu = overtimeRowMenu(page, id)
    await menu.click()
    await page.getByRole("menuitem", { name: "Verify overtime" }).click()
    const panel = page.getByRole("dialog", { name: "Verify overtime" })
    await expect(panel.getByText(reason, { exact: true })).toBeVisible()
    await panel
      .getByRole("textbox", { name: "Review note" })
      .fill("Verification prepared before leadership changed")
    const department = `/departments/${employee.departmentId}`
    const replacement = await overtimeFixtureCall("admin", department, "PUT", {
      headId: fixture.actors["correction-dst"].userId,
    })
    expect(replacement.status, await replacement.text()).toBe(200)
    const recovery = requestGate()
    try {
      await page.route(
        `**/api${path}`,
        async (route) => {
          recovery.start()
          await recovery.pending
          await route.fallback()
        },
        { times: 1 },
      )
      const conflict = overtimeResponse(page, "POST", `${path}/review`)
      const detail = overtimeResponse(page, "GET", path)
      const list = overtimeResponse(page, "GET", overtimeAdjustments)
      await panel.getByRole("button", { name: "Confirm decision" }).click()
      const denied = await conflict
      expect(denied.status()).toBe(403)
      const { error } = (await denied.json()) as { error: string }
      await recovery.started
      await expect(
        page.getByRole("alert").filter({ hasText: error }),
      ).toBeVisible()
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await expect(menu).toHaveCount(0)
      recovery.release()
      const [detailResult, listResult] = await Promise.all([detail, list])
      expect(detailResult.status()).toBe(404)
      expect(listResult.status()).toBe(403)
      await expect(page.getByText(error, { exact: true }).first()).toBeVisible()
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await expect(page.getByText(reason, { exact: true })).toHaveCount(0)
      await expect(menu).toHaveCount(0)
      const saved = await overtimeFixtureCall("correction-dst", path)
      expect(saved.status).toBe(200)
      expect(await saved.json()).toMatchObject({
        adjustment: {
          status: "PENDING",
          verifiedById: null,
          reviewedById: null,
        },
      })
    } finally {
      recovery.release()
      const restored = await overtimeFixtureCall("admin", department, "PUT", {
        headId: fixture.actors.head.userId,
      })
      expect(restored.status, await restored.text()).toBe(200)
    }

    await page.goto(overtimeAdjustments)
    const mixedMenu = overtimeRowMenu(page, id)
    await expect(mixedMenu).toBeVisible()
    await mixedMenu.click()
    await page
      .getByRole("menuitem", { name: "Verify overtime", exact: true })
      .click()
    const mixedPanel = page.getByRole("dialog", { name: "Verify overtime" })
    await expect(mixedPanel.getByText(reason, { exact: true })).toBeVisible()
    await mixedPanel
      .getByRole("textbox", { name: "Review note", exact: true })
      .fill("Mixed queue verification prepared before leadership changed")

    const mixedReplacement = await overtimeFixtureCall(
      "admin",
      department,
      "PUT",
      { headId: fixture.actors["correction-dst"].userId },
    )
    expect(mixedReplacement.status, await mixedReplacement.text()).toBe(200)
    const mixedRecovery = requestGate()
    try {
      await page.route(
        `**/api${path}`,
        async (route) => {
          mixedRecovery.start()
          await mixedRecovery.pending
          await route.fallback()
        },
        { times: 1 },
      )
      const mixedConflict = overtimeResponse(page, "POST", `${path}/review`)
      const mixedDetail = overtimeResponse(page, "GET", path)
      const mixedList = overtimeResponse(page, "GET", overtimeAdjustments)
      await mixedPanel
        .getByRole("button", { name: "Confirm decision", exact: true })
        .click()
      const denied = await mixedConflict
      expect(denied.status()).toBe(403)
      const { error } = (await denied.json()) as { error: string }
      await mixedRecovery.started
      await expect(
        page.getByRole("alert").filter({ hasText: error }),
      ).toBeVisible()
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await expect(mixedMenu).toHaveCount(0)
      mixedRecovery.release()
      const [detailResult, listResult] = await Promise.all([
        mixedDetail,
        mixedList,
      ])
      expect(detailResult.status()).toBe(404)
      expect(listResult.status()).toBe(403)
      await expect(page.getByText(error, { exact: true }).first()).toBeVisible()
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await expect(page.getByText(reason, { exact: true })).toHaveCount(0)
      await expect(mixedMenu).toHaveCount(0)
      const unchanged = await overtimeFixtureCall("correction-dst", path)
      expect(unchanged.status).toBe(200)
      expect(await unchanged.json()).toMatchObject({
        adjustment: {
          status: "PENDING",
          verifiedById: null,
          reviewedById: null,
        },
      })
    } finally {
      mixedRecovery.release()
      const restored = await overtimeFixtureCall("admin", department, "PUT", {
        headId: fixture.actors.head.userId,
      })
      expect(restored.status, await restored.text()).toBe(200)
    }
  })
}
