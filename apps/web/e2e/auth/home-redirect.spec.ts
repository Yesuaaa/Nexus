import { expect, test } from "@playwright/test"
import { configureRegressionTest, mockApi } from "../regression-support"

configureRegressionTest()

test("[PG-001-F001-A001-T002] an empty session token follows the anonymous branch", async ({
  page,
}) => {
  await page.addInitScript(() => sessionStorage.setItem("nexus.auth.token", ""))
  await page.goto("/")

  await expect(page).toHaveURL(/\/login$/)
  await expect(
    page.getByRole("heading", { name: "Welcome Back" }),
  ).toBeVisible()
})

test("[PG-001-F001-A001-T003] localStorage-only credentials do not open the portal from root", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("nexus.auth.token", "test-session")
    localStorage.setItem("nexus.auth.refreshToken", "test-refresh")
  })
  await page.goto("/")

  await expect(page).toHaveURL(/\/login$/)
  await expect(
    page.getByRole("heading", { name: "Welcome Back" }),
  ).toBeVisible()
  expect(
    await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
  ).toBeNull()
})

test("[PG-001-F001-A002-T004] a USER session follows the root redirect to dashboard", async ({
  page,
}) => {
  await mockApi(page, "USER")
  await page.addInitScript(() =>
    sessionStorage.setItem("nexus.auth.token", "test-session"),
  )
  await page.goto("/")

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("nexus.auth.token")))
    .toBe("test-session")
})

for (const role of ["STAFF", "ADMIN", "SUPERADMIN"] as const) {
  test(`[PG-001-F001-A002-T005] ${role} reaches the workspace selector after root handoff`, async ({
    page,
  }) => {
    await mockApi(page, role)
    await page.addInitScript(() =>
      sessionStorage.setItem("nexus.auth.token", "test-session"),
    )
    await page.goto("/")

    await expect(page).toHaveURL(/\/module$/)
    await expect(
      page.getByRole("main", { name: "Workspace selector" }),
    ).toBeVisible()
  })
}

test("[PG-001-F001-A002-T006] a rejected token is cleared after root hands off to the portal", async ({
  page,
}) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: { error: "Unauthorized" } }),
  )
  await page.addInitScript(() =>
    sessionStorage.setItem("nexus.auth.token", "invalid-session"),
  )
  await page.goto("/")

  await expect(page).toHaveURL(/\/login$/)
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("nexus.auth.token")))
    .toBeNull()
})

test("[PG-001-F001-A002-T007] account service failure is shown after root handoff without clearing the token", async ({
  page,
}) => {
  await mockApi(page, "USER")
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } }),
  )
  await page.addInitScript(() =>
    sessionStorage.setItem("nexus.auth.token", "test-session"),
  )
  await page.goto("/")

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator('main[role="alert"]')).toContainText(
    /couldn.t load your account/i,
  )
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("nexus.auth.token")))
    .toBe("test-session")
})

test("[PG-001-F001-A003-T008] root redirect replaces its browser history entry", async ({
  page,
}) => {
  await page.goto("/register")
  await page.goto("/")
  await expect(page).toHaveURL(/\/login$/)

  await page.goBack()
  await expect(page).toHaveURL(/\/register$/)
  await expect(
    page.getByRole("heading", { name: "Create Account" }),
  ).toBeVisible()
})

test("[PG-001-F001-A002-T009] expired access refreshes after root hands off to dashboard", async ({
  page,
}) => {
  let refreshes = 0
  let token = "expired"
  await mockApi(page, "USER", { accessToken: () => token })
  await page.route("**/api/auth/me", async (route) => {
    if (route.request().headers().authorization === "Bearer expired") {
      await route.fulfill({
        status: 401,
        json: { error: "Expired", code: "ACCESS_TOKEN_EXPIRED" },
      })
      return
    }
    await route.fallback()
  })
  await page.route("**/api/auth/refresh", async (route) => {
    refreshes++
    expect(route.request().method()).toBe("POST")
    expect(route.request().headers().authorization).toBeUndefined()
    expect(route.request().postDataJSON()).toEqual({
      refreshToken: "original-refresh",
    })
    token = "fresh"
    await route.fulfill({
      json: {
        token: "fresh",
        refreshToken: "rotated-refresh",
        expiresIn: 900,
      },
    })
  })
  await page.addInitScript(() => {
    sessionStorage.setItem("nexus.auth.token", "expired")
    sessionStorage.setItem("nexus.auth.refreshToken", "original-refresh")
  })
  await page.goto("/")

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect.poll(() => refreshes).toBe(1)
  await expect
    .poll(() =>
      page.evaluate(() => [
        sessionStorage.getItem("nexus.auth.token"),
        sessionStorage.getItem("nexus.auth.refreshToken"),
      ]),
    )
    .toEqual(["fresh", "rotated-refresh"])
})

test("[PG-001-F001-A001-T011] repeated anonymous root visits continue to resolve to login", async ({
  page,
}) => {
  for (let visit = 0; visit < 2; visit++) {
    await page.goto("/")
    await expect(page).toHaveURL(/\/login$/)
    await expect(
      page.getByRole("heading", { name: "Welcome Back" }),
    ).toBeVisible()
  }
})
