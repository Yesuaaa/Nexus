import { expect, test } from "@playwright/test"
import { configureRegressionTest, restoreSession } from "./regression-support"

configureRegressionTest()

for (const role of ["USER", "STAFF", "ADMIN", "SUPERADMIN"] as const) {
  test(`${role} sees unread chat totals in the topbar`, async ({ page }) => {
    await page.clock.install()
    await restoreSession(page, role)
    let requests = 2
    let internal = 3
    let unavailable = false
    let internalReads = 0
    let requestReads = 0
    await page.route("**/api/request-conversations", (route) => {
      requestReads++
      return route.fulfill(
        unavailable
          ? { status: 503, json: { error: "Temporarily unavailable" } }
          : {
              json: {
                conversations: [],
                nextCursor: null,
                unreadCount: requests,
              },
            },
      )
    })
    await page.route("**/api/internal-conversations", (route) => {
      internalReads++
      return route.fulfill({
        json: { conversations: [], nextCursor: null, unreadCount: internal },
      })
    })
    await page.goto("/messages")
    const topbar = page.getByRole("banner")
    const initialCount = role === "USER" ? 2 : 5
    await expect(
      topbar.getByRole("link", {
        name: `Messages, ${initialCount} unread`,
        exact: true,
      }),
    ).toHaveText(String(initialCount))
    if (role === "USER") expect(internalReads).toBe(0)
    expect(requestReads).toBe(1)

    requests = 101
    await page.clock.fastForward(30_000)
    const largeCount = role === "USER" ? 101 : 104
    await expect(
      topbar.getByRole("link", {
        name: `Messages, ${largeCount} unread`,
        exact: true,
      }),
    ).toHaveText("99+")

    // A failed refresh keeps the last known total instead of clearing the badge.
    unavailable = true
    await page.clock.fastForward(30_000)
    await expect(
      topbar.getByRole("link", {
        name: `Messages, ${largeCount} unread`,
        exact: true,
      }),
    ).toHaveText("99+")

    unavailable = false
    requests = 0
    internal = 0
    await page.clock.fastForward(30_000)
    const link = topbar.getByRole("link", { name: "Messages", exact: true })
    await expect(link).toBeVisible()
    await expect(link.locator("span")).toHaveCount(0)
    await link.click()
    await expect(page).toHaveURL(/\/messages$/)
  })
}
