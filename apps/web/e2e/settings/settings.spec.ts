import { expect, test } from "@playwright/test"
import type { Settings } from "../../src/features/settings/api/settings-api"
for (const role of ["USER", "STAFF", "ADMIN", "SUPERADMIN"] as const) {
  test(
    role + " settings persist and sessions can be revoked",
    async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 1440, height: 1000 })
      const state: Settings = {
        preferences: {
          timeZone: "Asia/Manila",
          dateFormat: "MM/DD/YYYY",
          timeFormat: "12h",
          workflowNotifications: true,
        },
        sessions: [
          {
            id: "current",
            device: "Windows · Edge",
            location: "Quezon City, Philippines",
            createdAt: "2026-11-01T12:00:00Z",
            lastActiveAt: "2026-11-02T08:15:00Z",
            current: true,
          },
          {
            id: "other",
            device: "iPhone · Safari",
            location: null,
            createdAt: "2026-10-30T12:00:00Z",
            lastActiveAt: "2026-11-01T08:00:00Z",
            current: false,
          },
        ],
      }
      await page.addInitScript(() =>
        sessionStorage.setItem("nexus.auth.token", "settings-test"),
      )
      let changedPassword = false
      let finishPassword: (() => void) | undefined
      await page.route("**/api/**", async (route) => {
        const request = route.request(),
          path = new URL(request.url()).pathname
        if (path === "/api/auth/me")
          return route.fulfill({
            json: {
              user: {
                id: "settings-user",
                email: "alex@example.com",
                fullName: "Alex Rivera",
                role,
                isActive: true,
                permissions: [
                  "dashboard:read",
                  "profile:read",
                  "profile:change-password",
                ],
                createdAt: "2026-01-01T00:00:00Z",
              },
            },
          })
        if (path === "/api/auth/settings") {
          if (request.method() === "PATCH") {
            state.preferences = request.postDataJSON()
            return route.fulfill({ json: state.preferences })
          }
          return route.fulfill({ json: state })
        }
        if (path === "/api/auth/sessions/other") {
          state.sessions = state.sessions.filter((session) => session.current)
          return route.fulfill({ status: 204 })
        }
        if (path === "/api/auth/sessions/revoke-others") {
          state.sessions = state.sessions.filter((session) => session.current)
          return route.fulfill({ status: 204 })
        }
        if (path === "/api/auth/change-password") {
          changedPassword = true
          await new Promise<void>((resolve) => {
            finishPassword = resolve
          })
          return route.fulfill({ status: 204 })
        }
        return route.fulfill({ json: { notifications: [], unreadCount: 0 } })
      })
      await page.goto("/settings")
      await expect(
        page.getByRole("heading", { name: "Settings", exact: true }),
      ).toBeVisible()
      await expect(
        page.getByText("Windows · Edge", { exact: true }).first(),
      ).toBeVisible()
      await expect(
        page.getByText("Quezon City, Philippines · Approximate location", {
          exact: true,
        }),
      ).toBeVisible()
      await expect(
        page.getByText("Location unavailable", { exact: true }),
      ).toBeVisible()
      const topbar = await page.getByRole("banner").boundingBox()
      const settingsMain = await page.getByRole("main").boundingBox()
      expect(topbar).not.toBeNull()
      expect(settingsMain).not.toBeNull()
      expect(
        settingsMain!.y - (topbar!.y + topbar!.height),
      ).toBeGreaterThanOrEqual(12)
      await page.screenshot({
        path: testInfo.outputPath("settings-sessions-location.png"),
        fullPage: true,
      })
      await expect(
        page.getByRole("tab", { name: "General", exact: true }),
      ).toHaveCount(0)
      await page
        .getByRole("button", {
          name: "Shortcut: notification settings",
          exact: true,
        })
        .click()
      await expect(
        page.getByRole("tab", { name: "Notifications", exact: true }),
      ).toHaveAttribute("aria-selected", "true")
      await page
        .getByRole("button", { name: "Shortcut: active sessions", exact: true })
        .click()
      await expect(
        page.getByRole("tab", { name: "Security", exact: true }),
      ).toHaveAttribute("aria-selected", "true")
      await page
        .getByRole("button", { name: "Shortcut: change password", exact: true })
        .click()
      await expect(
        page.getByRole("dialog", { name: "Change password", exact: true }),
      ).toBeVisible()
      await page.keyboard.press("Escape")
      await page.getByRole("button", { name: "Open account menu" }).click()
      const items = await page.getByRole("menuitem").allTextContents()
      expect(items).toEqual(["Profile", "Settings", "Log out"])
      await page.keyboard.press("Escape")
      await page.getByRole("button", { name: "Sign out", exact: true }).click()
      await expect(page.getByRole("dialog")).toBeVisible()
      await expect(
        page.getByText("iPhone · Safari", { exact: true }),
      ).toHaveCount(2)
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Sign out", exact: true })
        .click()
      await expect(
        page.getByText("iPhone · Safari", { exact: true }),
      ).toHaveCount(0)
      await expect(
        page.getByText("Current session", { exact: true }),
      ).toBeVisible()
      await page
        .getByRole("tab", { name: "Notifications", exact: true })
        .click()
      await page.getByRole("switch", { name: "Workflow updates" }).uncheck()
      await page.getByRole("button", { name: "Save notifications" }).click()
      await expect
        .poll(() => state.preferences.workflowNotifications)
        .toBe(false)
      await page.screenshot({
        path: testInfo.outputPath("settings-notifications-desktop.png"),
        fullPage: true,
      })
      await page.getByRole("tab", { name: "Preferences", exact: true }).click()
      await page
        .getByRole("combobox", { name: "Time zone", exact: true })
        .selectOption("UTC")
      await page
        .getByRole("combobox", { name: "Date format", exact: true })
        .selectOption("YYYY-MM-DD")
      await page
        .getByRole("combobox", { name: "Time format", exact: true })
        .selectOption("24h")
      await page
        .getByRole("button", { name: "Save preferences", exact: true })
        .click()
      await expect.poll(() => state.preferences.timeZone).toBe("UTC")
      await expect(
        page.getByRole("heading", { name: "Time preview", exact: true }),
      ).toBeVisible()
      await page.screenshot({
        path: testInfo.outputPath("settings-preferences-desktop.png"),
        fullPage: true,
      })
      await page.reload()
      await page.getByRole("tab", { name: "Preferences", exact: true }).click()
      await expect(
        page.getByRole("combobox", { name: "Time zone", exact: true }),
      ).toHaveValue("UTC")
      await page.getByRole("tab", { name: "Security", exact: true }).click()
      await expect(
        page.getByText("Last active 2026-11-02, 08:15", { exact: true }),
      ).toBeVisible()
      await page.screenshot({
        path: testInfo.outputPath("settings-desktop.png"),
        fullPage: true,
      })
      await page.setViewportSize({ width: 390, height: 844 })
      await expect
        .poll(
          async () =>
            (
              await page
                .getByRole("heading", { name: "Settings", exact: true })
                .boundingBox()
            )?.x ?? 999,
        )
        .toBeLessThan(50)
      await page.screenshot({
        path: testInfo.outputPath("settings-mobile.png"),
        fullPage: true,
      })
      const mobileMain = await page.getByRole("main").boundingBox()
      expect(mobileMain?.x).toBeLessThan(20)
      expect(mobileMain?.width).toBeGreaterThanOrEqual(350)
      const mobileTopbar = await page.getByRole("banner").boundingBox()
      expect(
        mobileMain!.y - (mobileTopbar!.y + mobileTopbar!.height),
      ).toBeGreaterThanOrEqual(12)
      await page
        .getByRole("tab", { name: "Notifications", exact: true })
        .click()
      await expect(
        page.getByRole("heading", {
          name: "In-app notifications",
          exact: true,
        }),
      ).toBeVisible()
      await page.screenshot({
        path: testInfo.outputPath("settings-mobile-notifications.png"),
        fullPage: true,
      })
      await page.getByRole("tab", { name: "Preferences", exact: true }).click()
      await expect(
        page.getByRole("heading", { name: "Date and time", exact: true }),
      ).toBeVisible()
      await page.screenshot({
        path: testInfo.outputPath("settings-mobile-preferences.png"),
        fullPage: true,
      })
      await page.getByRole("tab", { name: "Security", exact: true }).click()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
      await page
        .getByRole("button", { name: "Change password", exact: true })
        .click()
      await page
        .getByLabel("Current password", { exact: true })
        .fill("old-password-value")
      await page
        .getByLabel("New password", { exact: true })
        .fill("new-password-value")
      await page
        .getByLabel("Confirm new password", { exact: true })
        .fill("different-password")
      await page
        .getByRole("button", { name: "Update password", exact: true })
        .click()
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "The new passwords do not match." }),
      ).toBeVisible()
      expect(changedPassword).toBe(false)
      await page
        .getByLabel("Confirm new password", { exact: true })
        .fill("new-password-value")
      await page
        .getByRole("button", { name: "Update password", exact: true })
        .click()
      await expect.poll(() => changedPassword).toBe(true)
      await page.keyboard.press("Escape")
      await expect(
        page.getByRole("dialog", { name: "Change password", exact: true }),
      ).toBeVisible()
      finishPassword?.()
      await expect(
        page.getByRole("dialog", { name: "Password changed", exact: true }),
      ).toContainText("Do you want to log out of all devices?")
      await page.getByRole("button", { name: "No", exact: true }).click()
      await expect(page.getByRole("dialog")).toHaveCount(0)
      await expect(page).toHaveURL(/\/settings/)
      expect(changedPassword).toBe(true)
      expect(
        await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
      ).toBe("settings-test")
    },
  )
}
