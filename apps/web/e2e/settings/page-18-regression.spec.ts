import { expect, test, type Page } from "@playwright/test"
import type {
  Preferences,
  Session,
  Settings,
} from "../../src/features/settings/api/settings-api"

type SettingsMock = {
  settings: Settings
  readAvailable: boolean
  settingsReads: number
  preferenceWriteFailures: number
  preferenceWrites: number
  lastPreferences: Preferences | null
  sessionDeleteFailures: number
  sessionDeletes: number
  passwordFailures: number
  passwordChanges: number
  passwordPayload: Record<string, unknown> | null
  revokeAllCalls: number
}

const currentSession: Session = {
  id: "current-session",
  device: "Windows Edge",
  location: "Quezon City",
  createdAt: "2026-11-01T12:00:00.000Z",
  lastActiveAt: "2026-11-02T08:15:00.000Z",
  current: true,
}

function createState(): SettingsMock {
  return {
    settings: {
      preferences: {
        timeZone: "Asia/Manila",
        dateFormat: "MM/DD/YYYY",
        timeFormat: "12h",
        workflowNotifications: true,
      },
      sessions: [
        currentSession,
        {
          id: "other-session",
          device: "iPhone Safari",
          location: null,
          createdAt: "2026-10-30T12:00:00.000Z",
          lastActiveAt: null,
          current: false,
        },
      ],
    },
    readAvailable: true,
    settingsReads: 0,
    preferenceWriteFailures: 0,
    preferenceWrites: 0,
    lastPreferences: null,
    sessionDeleteFailures: 0,
    sessionDeletes: 0,
    passwordFailures: 0,
    passwordChanges: 0,
    passwordPayload: null,
    revokeAllCalls: 0,
  }
}

async function openSettings(page: Page, state: SettingsMock) {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.addInitScript(() =>
    sessionStorage.setItem("nexus.auth.token", "page18-settings-test"),
  )
  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname

    if (path === "/api/auth/me")
      return route.fulfill({
        json: {
          user: {
            id: "settings-user",
            email: "settings@example.test",
            fullName: "Settings Test",
            role: "USER",
            isActive: true,
            permissions: [
              "dashboard:read",
              "profile:read",
              "profile:change-password",
            ],
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        },
      })

    if (path === "/api/auth/settings") {
      if (request.method() === "PATCH") {
        state.preferenceWrites += 1
        const preferences = request.postDataJSON() as Preferences
        state.lastPreferences = preferences
        if (state.preferenceWriteFailures > 0) {
          state.preferenceWriteFailures -= 1
          return route.fulfill({
            status: 503,
            json: { error: "Preferences are temporarily unavailable." },
          })
        }
        state.settings.preferences = preferences
        return route.fulfill({ json: state.settings.preferences })
      }

      state.settingsReads += 1
      if (!state.readAvailable)
        return route.fulfill({
          status: 503,
          json: { error: "Settings are temporarily unavailable." },
        })
      return route.fulfill({ json: state.settings })
    }

    if (
      path === "/api/auth/sessions/other-session" &&
      request.method() === "DELETE"
    ) {
      state.sessionDeletes += 1
      if (state.sessionDeleteFailures > 0) {
        state.sessionDeleteFailures -= 1
        return route.fulfill({
          status: 503,
          json: { error: "Session service is temporarily unavailable." },
        })
      }
      state.settings.sessions = state.settings.sessions.filter(
        (session) => session.id !== "other-session",
      )
      return route.fulfill({ status: 204 })
    }

    if (path === "/api/auth/sessions/revoke-others") {
      state.settings.sessions = state.settings.sessions.filter(
        (session) => session.current,
      )
      return route.fulfill({ status: 204 })
    }

    if (path === "/api/auth/sessions/revoke-all") {
      state.revokeAllCalls += 1
      state.settings.sessions = []
      return route.fulfill({ status: 204 })
    }

    if (path === "/api/auth/change-password") {
      state.passwordChanges += 1
      state.passwordPayload = request.postDataJSON() as Record<string, unknown>
      if (state.passwordFailures > 0) {
        state.passwordFailures -= 1
        return route.fulfill({
          status: 400,
          json: { error: "Current password is incorrect." },
        })
      }
      return route.fulfill({ status: 204 })
    }

    return route.fulfill({ json: { notifications: [], unreadCount: 0 } })
  })
  await page.goto("/settings")
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible()
}

test("Settings recovers from a failed initial read", async ({ page }) => {
  const state = createState()
  state.readAvailable = false
  await openSettings(page, state)

  const main = page.getByRole("main")
  const alert = main.getByRole("alert")
  await expect(alert).toContainText("Settings are temporarily unavailable")
  state.readAvailable = true
  await alert.getByRole("button", { name: "Try again", exact: true }).click()

  await expect(main.getByRole("alert")).toHaveCount(0)
  await expect(page.getByText("Current session", { exact: true })).toBeVisible()
  expect(state.settingsReads).toBeGreaterThanOrEqual(3)
})

test("failed preference saves retain the draft and can be retried", async ({
  page,
}) => {
  const state = createState()
  state.preferenceWriteFailures = 1
  await openSettings(page, state)
  await page.getByRole("tab", { name: "Notifications", exact: true }).click()

  const workflowUpdates = page.getByRole("switch", {
    name: "Workflow updates",
  })
  await workflowUpdates.uncheck()
  const save = page.getByRole("button", {
    name: "Save notifications",
    exact: true,
  })
  await save.click()

  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Preferences are temporarily unavailable",
  )
  await expect(workflowUpdates).not.toBeChecked()
  expect(state.settings.preferences.workflowNotifications).toBe(true)
  await expect(page.getByText("Settings saved", { exact: true })).toHaveCount(0)

  await save.click()
  await expect
    .poll(() => state.settings.preferences.workflowNotifications)
    .toBe(false)
  await expect(workflowUpdates).not.toBeChecked()
  await expect(save).toBeDisabled()
  expect(state.preferenceWrites).toBe(2)
  expect(state.lastPreferences?.workflowNotifications).toBe(false)
})

test("failed session revocation does not remove the session and can be retried", async ({
  page,
}) => {
  const state = createState()
  state.sessionDeleteFailures = 1
  await openSettings(page, state)

  await page.getByRole("button", { name: "Sign out", exact: true }).click()
  const dialog = page.getByRole("dialog", {
    name: "Sign out this session?",
    exact: true,
  })
  await dialog.getByRole("button", { name: "Sign out", exact: true }).click()

  await expect(dialog.getByRole("alert")).toContainText(
    "Session service is temporarily unavailable",
  )
  const otherSession = page
    .locator("main")
    .getByText("iPhone Safari", { exact: true })
  await expect(otherSession).toBeVisible()
  expect(state.settings.sessions).toHaveLength(2)

  await dialog.getByRole("button", { name: "Sign out", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(otherSession).toHaveCount(0)
  expect(state.sessionDeletes).toBe(2)
  expect(state.settings.sessions).toHaveLength(1)
})

test("password change errors preserve inputs and success keeps logout optional", async ({
  page,
}) => {
  const state = createState()
  state.passwordFailures = 1
  await openSettings(page, state)
  await page
    .getByRole("button", { name: "Change password", exact: true })
    .click()

  const dialog = page.getByRole("dialog", {
    name: "Change password",
    exact: true,
  })
  const current = page.getByLabel("Current password", { exact: true })
  const next = page.getByLabel("New password", { exact: true })
  const confirmation = page.getByLabel("Confirm new password", {
    exact: true,
  })
  await current.fill("current-password-value")
  await next.fill("New-password-value1")
  await confirmation.fill("New-password-value1")
  await dialog
    .getByRole("button", { name: "Update password", exact: true })
    .click()

  await expect(dialog.getByRole("alert")).toContainText(
    "Current password is incorrect",
  )
  await expect(current).toHaveValue("current-password-value")
  await expect(next).toHaveValue("New-password-value1")
  await expect(confirmation).toHaveValue("New-password-value1")
  await expect(
    page.getByRole("dialog", { name: "Password changed", exact: true }),
  ).toHaveCount(0)

  await dialog.getByRole("button", { name: "Show new password" }).click()
  await expect(next).toHaveAttribute("type", "text")
  await dialog.getByRole("button", { name: "Hide new password" }).click()
  await expect(next).toHaveAttribute("type", "password")
  await dialog
    .getByRole("button", { name: "Update password", exact: true })
    .click()

  expect(Object.keys(state.passwordPayload ?? {}).sort()).toEqual([
    "currentPassword",
    "newPassword",
  ])
  await expect(
    page.getByRole("dialog", { name: "Password changed", exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "No", exact: true }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(state.revokeAllCalls).toBe(0)
  expect(
    await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
  ).toBe("page18-settings-test")
})

test("Settings stays usable without horizontal overflow at supported widths", async ({
  page,
}, testInfo) => {
  const state = createState()
  await openSettings(page, state)

  for (const [width, height] of [
    [1440, 900],
    [1280, 850],
    [768, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height })
    await expect(
      page.getByRole("tab", { name: "Security", exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `Settings overflows horizontally at ${width}px`,
    ).toBe(true)
    if (width === 390) {
      await page.screenshot({
        path: testInfo.outputPath("page-18-settings-mobile.png"),
        fullPage: true,
      })
      await page
        .getByRole("button", { name: "Change password", exact: true })
        .click()
      await expect(
        page.getByRole("dialog", { name: "Change password", exact: true }),
      ).toBeVisible()
      await page.keyboard.press("Escape")
      await expect(page.getByRole("dialog")).toHaveCount(0)
    }
  }
})
