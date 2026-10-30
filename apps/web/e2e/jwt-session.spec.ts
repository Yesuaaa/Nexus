import { expect, test } from "@playwright/test"

test.use({ reducedMotion: "reduce" })

const account = {
  id: "jwt-user",
  email: "jwt@example.com",
  fullName: "JWT Tester",
  contactNumber: null,
  role: "USER",
  isActive: true,
  permissions: ["dashboard:read", "profile:read", "profile:change-password"],
  createdAt: "2026-01-01T00:00:00.000Z",
}

test("expired access refreshes on login navigation and logout clears both tokens", async ({
  page,
}) => {
  let refreshes = 0
  let loggedOut = false
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("jwt-test-initialized")) {
      sessionStorage.setItem("jwt-test-initialized", "true")
      sessionStorage.setItem("nexus.auth.token", "expired")
      sessionStorage.setItem("nexus.auth.refreshToken", "original-refresh")
    }
  })
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === "/api/auth/refresh") {
      refreshes++
      expect(route.request().postDataJSON()).toEqual({
        refreshToken: "original-refresh",
      })
      return route.fulfill({
        json: {
          token: "fresh",
          refreshToken: "rotated-refresh",
          expiresIn: 900,
        },
      })
    }
    if (path === "/api/auth/me") {
      if (route.request().headers().authorization === "Bearer fresh")
        return route.fulfill({ json: { user: account } })
      return route.fulfill({
        status: 401,
        json: { error: "Expired", code: "ACCESS_TOKEN_EXPIRED" },
      })
    }
    if (path === "/api/auth/logout") {
      loggedOut = true
      return route.fulfill({ status: 204, body: "" })
    }
    return route.fulfill({ json: {} })
  })
  const response = await page.goto("/login")
  const csp = response!.headers()["content-security-policy"]
  expect(csp).toMatch(/script-src[^;]*'nonce-[^']+'/)
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/)
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(refreshes).toBe(1)
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("nexus.auth.refreshToken"),
    ),
  ).toBe("rotated-refresh")
  await page.getByRole("button", { name: /sign out/i }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(loggedOut).toBe(true)
  expect(
    await page.evaluate(() => [
      sessionStorage.getItem("nexus.auth.token"),
      sessionStorage.getItem("nexus.auth.refreshToken"),
    ]),
  ).toEqual([null, null])
  expect(errors).toEqual([])
})

test("the page script policy permits a nonce and blocks untrusted inline scripts", async ({
  page,
  request,
}) => {
  const response = await request.get("/login")
  const csp = response.headers()["content-security-policy"]
  const nonce = /'nonce-([^']+)'/.exec(csp)![1]
  await page.route("**/csp-probe", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      headers: { "Content-Security-Policy": csp },
      body: `<html><body><script nonce="${nonce}">window.trustedScriptExecuted = true</script><script>window.untrustedScriptExecuted = true</script></body></html>`,
    }),
  )
  await page.goto("/csp-probe")
  expect(await page.evaluate(() => "trustedScriptExecuted" in window)).toBe(
    true,
  )
  expect(await page.evaluate(() => "untrustedScriptExecuted" in window)).toBe(
    false,
  )
})
