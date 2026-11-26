import { test, expect } from "@playwright/test"
import { randomUUID } from "node:crypto"

import {
  api,
  clock,
  fixture,
  leaveFixtureCall,
  overtimeAdjustments,
  overtimeFixtureCall,
  overtimePage,
  seedLeaveReview,
  signIn,
} from "./support"

/** Stale leave refresh and automatic overtime. */
export function staleReviewTests() {
  test("stale leave refresh clears details when Head access is revoked", async ({
    page,
  }) => {
    const path = await seedLeaveReview("2026-12-16", false)
    const authorized = await leaveFixtureCall("head", path)
    expect(authorized.status).toBe(200)
    const { request } = (await authorized.json()) as {
      request: { employee: { departmentId: string }; reason: string }
    }
    await signIn(page, "head")
    await page.goto("/attendance/requests/leave")
    const rowMenu = page.locator(
      `[id="leave-actions-${path.split("/").at(-1)}"]`,
    )
    await rowMenu.click()
    await page.getByRole("menuitem", { name: "Verify request" }).click()
    const panel = page.getByRole("dialog", { name: "Verify request" })
    await expect(panel.getByText(request.reason)).toBeVisible()
    await panel
      .getByLabel("Decision note")
      .fill("Verification prepared earlier")

    const rejected = await leaveFixtureCall("superadmin", `${path}/reject`, {
      actionId: randomUUID(),
      expectedVersion: 1,
      note: "Superadmin rejected before verification",
    })
    expect(rejected.status).toBe(200)
    await page.route(
      `**/api${path}`,
      async (route) => {
        const response = await fetch(
          `${api}/api/departments/${request.employee.departmentId}`,
          {
            method: "PUT",
            headers: {
              authorization: `Bearer ${fixture.actors.admin.token}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({ headId: null }),
          },
        )
        expect(response.status).toBe(200)
        await route.fallback()
      },
      { times: 1 },
    )
    const detail = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname === `/api${path}`,
    )
    await panel.getByRole("button", { name: "Verify request" }).click()
    const refreshed = await detail
    expect(refreshed.status()).toBe(404)
    expect(await refreshed.json()).toEqual({ error: "Leave request not found" })
    await expect(
      page.getByText("Leave request changed; refresh and try again", {
        exact: true,
      }),
    ).toBeVisible()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(page.getByText(request.reason)).toHaveCount(0)
    await expect(rowMenu).toHaveCount(0)
  })

  test("[PG-012-F001-A019-T002] automatic overtime persists in the normal typed queue", async ({
    page,
  }) => {
    const requester = "overtime-staff"
    await clock("2026-11-22T09:00:00+08:00")
    const opened = await overtimeFixtureCall(
      requester,
      "/attendance/me/clock-in",
      "POST",
      {},
    )
    expect(opened.status, await opened.clone().text()).toBe(201)
    const { workday } = (await opened.json()) as {
      workday: { activeSessionId: string }
    }

    await clock("2026-11-22T20:00:00+08:00")
    const closed = await overtimeFixtureCall(
      requester,
      "/attendance/me/clock-out",
      "POST",
      { sessionId: workday.activeSessionId },
    )
    expect(closed.status, await closed.clone().text()).toBe(200)

    const createdList = await overtimeFixtureCall(
      requester,
      `${overtimeAdjustments}?scope=mine&type=OVERTIME&status=PENDING`,
    )
    expect(createdList.status, await createdList.clone().text()).toBe(200)
    const createdBody = (await createdList.json()) as {
      adjustments: {
        id: string
        sessionId: string
        overtimeMinutes: number
        status: string
      }[]
    }
    const created = createdBody.adjustments.find(
      ({ sessionId }) => sessionId === workday.activeSessionId,
    )
    expect(created).toMatchObject({
      sessionId: workday.activeSessionId,
      overtimeMinutes: 180,
      status: "PENDING",
    })
    if (!created) throw new Error("Expected automatic Overtime for this shift")

    await signIn(page, requester)
    const initialList = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return (
        response.request().method() === "GET" &&
        url.pathname === "/api/attendance/adjustments" &&
        url.searchParams.get("type") === "OVERTIME"
      )
    })
    await page.goto(overtimePage)
    const initialResponse = await initialList
    expect(initialResponse.status()).toBe(200)
    const initialBody = (await initialResponse.json()) as {
      adjustments: {
        id: string
        overtimeMinutes: number
        status: string
        employee: { fullName: string }
      }[]
    }
    expect(initialBody.adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.id,
          overtimeMinutes: 180,
          status: "PENDING",
          employee: expect.objectContaining({
            fullName: "Attendance overtime-staff",
          }),
        }),
      ]),
    )
    const row = page.getByRole("row").filter({
      has: page.locator(`[id="attendance-adjustment-actions-${created.id}"]`),
    })
    await expect(row).toContainText("Attendance overtime-staff")
    await expect(row).toContainText("180 minutes requested")
    await expect(row).toContainText("Pending")

    const reloadedList = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return (
        response.request().method() === "GET" &&
        url.pathname === "/api/attendance/adjustments" &&
        url.searchParams.get("type") === "OVERTIME"
      )
    })
    await page.reload()
    const reloadedResponse = await reloadedList
    expect(reloadedResponse.status()).toBe(200)
    const persistedBody = (await reloadedResponse.json()) as {
      adjustments: {
        id: string
        overtimeMinutes: number
        status: string
      }[]
    }
    expect(persistedBody.adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.id,
          overtimeMinutes: 180,
          status: "PENDING",
        }),
      ]),
    )
    await expect(row).toContainText("180 minutes requested")
  })
}
