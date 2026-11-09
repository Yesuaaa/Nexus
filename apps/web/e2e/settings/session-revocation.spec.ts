import { expect, test, type Browser, type Page } from "@playwright/test"
async function openBrowsers(browser: Browser, baseURL: string) {
  const state = {
    active: new Set(["a", "b"]),
    passwordChanges: 0,
    revokeAllCalls: 0,
    failMeB: 0,
    meCallsB: 0,
  }
  const contexts = await Promise.all([
    browser.newContext({ baseURL }),
    browser.newContext({ baseURL }),
  ])
  const pages: Page[] = []
  for (const [index, context] of contexts.entries()) {
    const id = index === 0 ? "a" : "b"
    await context.addInitScript(
      (token) => sessionStorage.setItem("nexus.auth.token", token),
      id,
    )
    await context.route("**/api/**", async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname,
        token = request.headers().authorization?.replace("Bearer ", "") || ""
      if (path === "/api/auth/me" && token === "b") {
        state.meCallsB++
        if (state.failMeB)
          return route.fulfill({
            status: state.failMeB,
            json: { error: "Temporary account check failure" },
          })
      }
      if (!state.active.has(token))
        return route.fulfill({
          status: 401,
          json: { error: "Invalid session" },
        })
      if (path === "/api/auth/me")
        return route.fulfill({
          json: {
            user: {
              id: "session-owner",
              fullName: "Alex Rivera",
              email: "alex@example.com",
              role: "USER",
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
      if (path === "/api/auth/settings")
        return route.fulfill({
          json: {
            preferences: {
              timeZone: "Asia/Manila",
              dateFormat: "MM/DD/YYYY",
              timeFormat: "12h",
              workflowNotifications: true,
            },
            sessions: [...state.active].map((session) => ({
              id: session,
              device: session === "a" ? "Windows · Edge" : "iPhone · Safari",
              location: null,
              createdAt: "2026-11-01T12:00:00Z",
              lastActiveAt: null,
              current: session === token,
            })),
          },
        })
      if (path === "/api/auth/change-password") {
        state.passwordChanges++
        return route.fulfill({ status: 204 })
      }
      if (path === "/api/auth/sessions/revoke-all") {
        state.revokeAllCalls++
        state.active.clear()
        return route.fulfill({ status: 204 })
      }
      if (path === "/api/auth/sessions/b") {
        state.active.delete("b")
        return route.fulfill({ status: 204 })
      }
      return route.fulfill({ json: { notifications: [], unreadCount: 0 } })
    })
    const page = await context.newPage()
    pages.push(page)
    await page.goto("/settings")
    await expect(
      page.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible()
  }
  return { state, contexts, pageA: pages[0]!, pageB: pages[1]! }
}
async function changePassword(page: Page) {
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
    .fill("new-password-value")
  await page
    .getByRole("button", { name: "Update password", exact: true })
    .click()
  await expect(
    page.getByRole("dialog", { name: "Password changed", exact: true }),
  ).toBeVisible()
}
test("password logout choice preserves both browsers until confirmed", async ({
  browser,
  baseURL,
}) => {
  const { state, contexts, pageA, pageB } = await openBrowsers(
    browser,
    baseURL!,
  )
  try {
    await pageA.bringToFront()
    await changePassword(pageA)
    await pageA.getByRole("button", { name: "No", exact: true }).click()
    expect(state.active.size).toBe(2)
    expect(state.revokeAllCalls).toBe(0)
    await expect(pageA).toHaveURL(/\/settings/)
    await pageB.bringToFront()
    await pageB.evaluate(() => window.dispatchEvent(new Event("focus")))
    await expect(
      pageB.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible()
    expect(
      await pageB.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBe("b")
    await pageA.bringToFront()
    await changePassword(pageA)
    await pageA.getByRole("button", { name: "Yes", exact: true }).click()
    const confirm = pageA.getByRole("dialog", {
      name: "Log out of all devices?",
      exact: true,
    })
    await expect(confirm).toContainText("including this one")
    await confirm.getByRole("button", { name: "Cancel", exact: true }).click()
    expect(state.revokeAllCalls).toBe(0)
    expect(state.active.size).toBe(2)
    await pageA.getByRole("button", { name: "Yes", exact: true }).click()
    await pageA
      .getByRole("button", { name: "Log out all devices", exact: true })
      .click()
    await expect(pageA).toHaveURL(/\/login/)
    expect(state.revokeAllCalls).toBe(1)
    expect(
      await pageA.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBeNull()
    await pageB.bringToFront()
    await pageB.evaluate(() => window.dispatchEvent(new Event("focus")))
    await expect(pageB).toHaveURL(/\/login/, { timeout: 10000 })
    expect(
      await pageB.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBeNull()
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})
test("individual session revocation redirects the other browser and transient checks do not", async ({
  browser,
  baseURL,
}) => {
  const { state, contexts, pageA, pageB } = await openBrowsers(
    browser,
    baseURL!,
  )
  try {
    await pageB.bringToFront()
    for (const status of [503, 403]) {
      state.failMeB = status
      const before = state.meCallsB
      await pageB.evaluate(() => window.dispatchEvent(new Event("focus")))
      await expect.poll(() => state.meCallsB).toBeGreaterThan(before)
      await expect(pageB).toHaveURL(/\/settings/)
      expect(
        await pageB.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
      ).toBe("b")
    }
    state.failMeB = 0
    await pageA.bringToFront()
    await pageA.getByRole("button", { name: "Sign out", exact: true }).click()
    await pageA
      .getByRole("dialog")
      .getByRole("button", { name: "Sign out", exact: true })
      .click()
    await expect.poll(() => state.active.has("b")).toBe(false)
    await pageB.bringToFront()
    await pageB.evaluate(() => window.dispatchEvent(new Event("focus")))
    await expect(pageB).toHaveURL(/\/login/, { timeout: 10000 })
    expect(
      await pageB.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBeNull()
    await expect(pageA).toHaveURL(/\/settings/)
    expect(state.active.has("a")).toBe(true)
  } finally {
    await Promise.all(contexts.map((context) => context.close()))
  }
})
