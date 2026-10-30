import { expect, test, type Page } from "@playwright/test"
import type { Account } from "../src/features/auth/model/types"
import type { ServiceInput } from "../src/features/services/api/services-api"
import {
  configureRegressionTest,
  expiredAccess,
  live,
  mockApi,
  renewedTokens,
  restoreSession,
  storedTokens,
  testAccounts,
} from "./regression-support"

configureRegressionTest()

test.describe("live test accounts", () => {
  test.skip(!live, "Set NEXUS_E2E_LIVE=1 to validate the real backend")
  test.describe.configure({ retries: 0, timeout: 90_000 })

  const features = [
    {
      path: "/accounts",
      endpoint: "/api/users",
      title: "Account Management",
      roles: ["SUPERADMIN"],
    },
    {
      path: "/departments",
      endpoint: "/api/departments",
      title: "Department Management",
      roles: ["ADMIN"],
    },
    {
      path: "/employees",
      endpoint: "/api/employees",
      title: "Employee Management",
      roles: ["ADMIN"],
    },
    {
      path: "/services",
      endpoint: "/api/services",
      title: "Service Management",
      roles: ["ADMIN"],
    },
    {
      path: "/clients",
      endpoint: "/api/clients",
      title: "Client Management",
      roles: ["ADMIN"],
    },
  ]

  async function login(page: Page, role: keyof typeof testAccounts) {
    const account = testAccounts[role]
    const password = process.env[account.passwordKey]
    if (!password)
      throw new Error(
        `Set ${account.passwordKey} in apps/web/.env.regression.local or the environment`,
      )
    await page.goto("/login")
    await page.getByLabel("Email address", { exact: true }).fill(account.email)
    await page.getByLabel("Password", { exact: true }).fill(password)
    const response = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/auth/login" &&
        response.request().method() === "POST",
    )
    await page.getByRole("button", { name: "Sign In", exact: true }).click()
    return response
  }

  for (const role of ["SUPERADMIN", "ADMIN", "STAFF", "USER"] as const) {
    test(`${role} logs in and validates real feature access`, async ({
      page,
    }) => {
      const response = await login(page, role)
      const payload = (await response.json()) as {
        user?: Account
        token?: string
        refreshToken?: string
        expiresIn?: number
      }
      try {
        expect(response.status(), `${role} login must succeed`).toBe(200)
        expect(payload.user?.email).toBe(testAccounts[role].email)
        expect(payload.user?.role).toBe(role)
        expect(payload.user?.isActive).toBe(true)
        expect(
          typeof payload.token === "string" &&
            payload.token.split(".").length === 3,
        ).toBe(true)
        expect(
          typeof payload.refreshToken === "string" &&
            /^[A-Za-z0-9_-]{43}$/.test(payload.refreshToken),
        ).toBe(true)
        expect(payload.expiresIn).toBeGreaterThan(0)
        expect(payload.expiresIn).toBeLessThanOrEqual(900)
        expect(response.headers()["cache-control"]).toBe("no-store")
        await expect(page).toHaveURL(/\/dashboard$/)
        expect(
          await page.evaluate(() =>
            Boolean(sessionStorage.getItem("nexus.auth.token")),
          ),
        ).toBe(true)
        expect(
          await page.evaluate(() => localStorage.getItem("nexus.auth.token")),
        ).toBeNull()
        expect(
          await page.evaluate(() =>
            Boolean(sessionStorage.getItem("nexus.auth.refreshToken")),
          ),
        ).toBe(true)
        expect(
          await page.evaluate(() =>
            localStorage.getItem("nexus.auth.refreshToken"),
          ),
        ).toBeNull()
        for (const feature of features) {
          const clientCatalog = role === "USER" && feature.path === "/services"
          const pageEndpoint = clientCatalog
            ? "/api/client/services"
            : feature.endpoint
          if (feature.roles.includes(role) || clientCatalog) {
            const loaded = page.waitForResponse(
              (response) =>
                new URL(response.url()).pathname === pageEndpoint &&
                response.request().method() === "GET",
            )
            await page.goto(feature.path)
            expect((await loaded).status(), `${role} ${feature.endpoint}`).toBe(
              200,
            )
            await expect(
              page.getByRole("heading", {
                name: clientCatalog
                  ? "Build Your Brand with EXP"
                  : feature.title,
                exact: true,
              }),
            ).toBeVisible()
            await expect(page.getByRole("main").getByRole("alert")).toHaveCount(
              0,
            )
          } else {
            const requests: string[] = []
            const record = (request: import("@playwright/test").Request) => {
              if (new URL(request.url()).pathname === feature.endpoint)
                requests.push(request.url())
            }
            page.on("request", record)
            await page.goto(feature.path)
            await expect(page).toHaveURL(/\/dashboard$/)
            page.off("request", record)
            expect(
              requests,
              `Forbidden page must not load ${feature.endpoint}`,
            ).toEqual([])
          }
          // Check actual API authorization independently of the UI guards.
          // Staff and Superadmin may read departments through the API even
          // though the department management page belongs to Admin.
          const allowed =
            feature.roles.includes(role) ||
            (feature.path === "/departments" && role !== "USER")
          const status = await page.evaluate(async (endpoint) => {
            const response = await fetch(endpoint, {
              headers: {
                Authorization: `Bearer ${sessionStorage.getItem("nexus.auth.token")}`,
              },
            })
            return response.status
          }, feature.endpoint)
          expect(status, `${role} direct read of ${feature.endpoint}`).toBe(
            allowed ? 200 : 403,
          )
        }
        const catalog = await page.evaluate(async () => {
          const response = await fetch("/api/services/available", {
            headers: {
              Authorization: `Bearer ${sessionStorage.getItem("nexus.auth.token")}`,
            },
          })
          const body = (await response.json()) as {
            services?: { isActive: boolean }[]
          }
          return {
            status: response.status,
            activeOnly:
              Array.isArray(body.services) &&
              body.services.every((service) => service.isActive),
          }
        })
        expect(catalog).toEqual({ status: 200, activeOnly: true })
      } finally {
        // Revoke the real session even if an assertion fails halfway through.
        if (payload.token) {
          const logoutToken = await page.evaluate(() =>
            sessionStorage.getItem("nexus.auth.token"),
          )
          const logout = await page.request.post("/api/auth/logout", {
            headers: {
              Authorization: `Bearer ${logoutToken ?? payload.token}`,
            },
          })
          await page.evaluate(() => {
            sessionStorage.removeItem("nexus.auth.token")
            sessionStorage.removeItem("nexus.auth.refreshToken")
          })
          expect([204, 401]).toContain(logout.status())
        }
      }
      await page.goto("/dashboard")
      await expect(page).toHaveURL(/\/login$/)
    })
  }

  test("deactivated account cannot establish a session", async ({ page }) => {
    const response = await login(page, "DEACTIVATED")
    const payload = (await response.json()) as Record<string, unknown>
    // Clean up an unexpectedly successful login before reporting the failure.
    if (typeof payload.token === "string") {
      const logout = await page.request.post("/api/auth/logout", {
        headers: { Authorization: `Bearer ${payload.token}` },
      })
      expect([204, 401]).toContain(logout.status())
      await page.evaluate(() => {
        sessionStorage.removeItem("nexus.auth.token")
        sessionStorage.removeItem("nexus.auth.refreshToken")
      })
    }
    expect(response.status()).toBe(401)
    expect(payload).not.toHaveProperty("token")
    expect(payload).not.toHaveProperty("refreshToken")
    await expect(page).toHaveURL(/\/login$/)
    await expect(
      page.getByText("Sign-in failed", { exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBeNull()
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe("Authentication and session regression", () => {
  test.skip(live, "Live mode uses the supplied accounts against the real API")

  for (const role of ["SUPERADMIN", "ADMIN", "STAFF", "USER"] as const) {
    test(`${role} renews an expired access token and signs out both tokens`, async ({
      page,
    }) => {
      let token = "test-session"
      let refreshes = 0
      await restoreSession(page, role, { accessToken: () => token })
      await page.route("**/api/auth/me", async (route) => {
        if (route.request().headers().authorization === "Bearer test-session") {
          await route.fulfill({ status: 401, json: expiredAccess })
        } else {
          await route.fallback()
        }
      })
      await page.route("**/api/auth/refresh", async (route) => {
        refreshes++
        expect(route.request().method()).toBe("POST")
        expect(route.request().headers().authorization).toBeUndefined()
        expect(route.request().postDataJSON()).toEqual({
          refreshToken: "test-refresh",
        })
        token = renewedTokens.token
        await route.fulfill({ json: renewedTokens })
      })
      await page.goto("/dashboard")
      await expect(
        page.getByRole("button", { name: "Sign Out", exact: true }),
      ).toBeVisible()
      expect(refreshes).toBe(1)
      expect(await storedTokens(page)).toEqual([
        renewedTokens.token,
        renewedTokens.refreshToken,
      ])
      await page.reload()
      await expect(
        page.getByRole("button", { name: "Sign Out", exact: true }),
      ).toBeVisible()
      expect(refreshes).toBe(1)
      expect(
        await page.evaluate(() => [
          localStorage.getItem("nexus.auth.token"),
          localStorage.getItem("nexus.auth.refreshToken"),
        ]),
      ).toEqual([null, null])
      expect(
        (await page.context().cookies()).some((cookie) =>
          [renewedTokens.token, renewedTokens.refreshToken].includes(
            cookie.value,
          ),
        ),
      ).toBe(false)
      const logout = page.waitForRequest(
        (request) => new URL(request.url()).pathname === "/api/auth/logout",
      )
      await page.getByRole("button", { name: "Sign Out", exact: true }).click()
      expect((await logout).headers().authorization).toBe(
        `Bearer ${renewedTokens.token}`,
      )
      await expect(page).toHaveURL(/\/login$/)
      expect(await storedTokens(page)).toEqual([null, null])
      await page.goto("/dashboard")
      await expect(page).toHaveURL(/\/login$/)
    })
  }

  test("parallel service reads share one refresh and retry with the new bearer token", async ({
    page,
  }) => {
    let token = "test-session"
    let refreshes = 0
    const expiredPaths: string[] = []
    const retriedPaths: string[] = []
    const paths = [
      "/api/services",
      "/api/departments",
      "/api/services/pricing-templates",
    ]
    let releaseRefresh!: () => void
    const allExpired = new Promise<void>((resolve) => {
      releaseRefresh = resolve
    })
    await restoreSession(page, "ADMIN", { accessToken: () => token })
    for (const path of paths) {
      await page.route(`**${path}`, async (route) => {
        const authorization = route.request().headers().authorization
        if (authorization === "Bearer test-session") {
          expiredPaths.push(path)
          if (expiredPaths.length === paths.length) releaseRefresh()
          await route.fulfill({ status: 401, json: expiredAccess })
        } else {
          expect(authorization).toBe(`Bearer ${renewedTokens.token}`)
          retriedPaths.push(path)
          await route.fallback()
        }
      })
    }
    await page.route("**/api/auth/refresh", async (route) => {
      refreshes++
      expect(route.request().postDataJSON()).toEqual({
        refreshToken: "test-refresh",
      })
      await allExpired
      token = renewedTokens.token
      await route.fulfill({ json: renewedTokens })
    })
    await page.goto("/services")
    await expect(
      page.getByRole("rowheader", { name: "Test Service", exact: true }),
    ).toBeVisible()
    expect(refreshes).toBe(1)
    expect(expiredPaths.sort()).toEqual([...paths].sort())
    expect(retriedPaths.sort()).toEqual([...paths].sort())
    expect(await storedTokens(page)).toEqual([
      renewedTokens.token,
      renewedTokens.refreshToken,
    ])
  })

  for (const status of [401, 429, 503]) {
    test(`refresh HTTP ${status} ${status === 401 ? "clears both tokens" : "preserves the session for retry"}`, async ({
      page,
    }) => {
      let token = "test-session"
      let refreshes = 0
      await restoreSession(page, "USER", { accessToken: () => token })
      await page.route("**/api/auth/me", async (route) => {
        if (route.request().headers().authorization === "Bearer test-session")
          await route.fulfill({ status: 401, json: expiredAccess })
        else await route.fallback()
      })
      await page.route("**/api/auth/refresh", async (route) => {
        refreshes++
        expect(route.request().postDataJSON()).toEqual({
          refreshToken: "test-refresh",
        })
        if (refreshes === 1)
          await route.fulfill({
            status,
            json: { error: "Unable to refresh session" },
          })
        else {
          token = renewedTokens.token
          await route.fulfill({ json: renewedTokens })
        }
      })
      await page.goto("/login")
      if (status === 401) {
        await expect(
          page.getByRole("button", { name: "Sign In", exact: true }),
        ).toBeVisible()
        expect(await storedTokens(page)).toEqual([null, null])
        expect(refreshes).toBe(1)
      } else {
        await expect(page.getByRole("main").getByRole("alert")).toContainText(
          "couldn't check your session",
        )
        expect(await storedTokens(page)).toEqual([
          "test-session",
          "test-refresh",
        ])
        await page
          .getByRole("button", { name: "Try again", exact: true })
          .click()
        await expect(page).toHaveURL(/\/dashboard$/)
        expect(refreshes).toBe(2)
        expect(await storedTokens(page)).toEqual([
          renewedTokens.token,
          renewedTokens.refreshToken,
        ])
      }
    })
  }

  test("invalid access tokens clear the session without attempting refresh", async ({
    page,
  }) => {
    await restoreSession(page, "USER")
    const refreshes: string[] = []
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/auth/refresh")
        refreshes.push(request.url())
    })
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 401,
        json: { error: "Invalid access token", code: "INVALID_ACCESS_TOKEN" },
      }),
    )
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login$/)
    await expect(
      page.getByRole("button", { name: "Sign In", exact: true }),
    ).toBeVisible()
    expect(await storedTokens(page)).toEqual([null, null])
    expect(refreshes).toEqual([])
  })

  test("a rejected renewed access token stops after one refresh", async ({
    page,
  }) => {
    await restoreSession(page, "USER")
    let refreshes = 0
    let lookups = 0
    await page.route("**/api/auth/me", async (route) => {
      lookups++
      await route.fulfill({ status: 401, json: expiredAccess })
    })
    await page.route("**/api/auth/refresh", async (route) => {
      refreshes++
      await route.fulfill({ json: renewedTokens })
    })
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login$/)
    await expect(
      page.getByRole("button", { name: "Sign In", exact: true }),
    ).toBeVisible()
    expect(refreshes).toBe(1)
    expect(lookups).toBe(2)
    expect(await storedTokens(page)).toEqual([null, null])
  })

  test("an expired service update retries the same payload once after refresh", async ({
    page,
  }) => {
    let token = "test-session"
    let refreshes = 0
    const updates: ServiceInput[] = []
    await restoreSession(page, "ADMIN", { accessToken: () => token })
    await page.route("**/api/services/service-1", async (route) => {
      expect(route.request().method()).toBe("PUT")
      updates.push(route.request().postDataJSON() as ServiceInput)
      if (updates.length === 1)
        await route.fulfill({ status: 401, json: expiredAccess })
      else {
        expect(route.request().headers().authorization).toBe(
          `Bearer ${renewedTokens.token}`,
        )
        await route.fallback()
      }
    })
    await page.route("**/api/auth/refresh", async (route) => {
      refreshes++
      token = renewedTokens.token
      await route.fulfill({ json: renewedTokens })
    })
    await page.goto("/services")
    await page
      .getByRole("button", { name: "Edit Test Service", exact: true })
      .click()
    await page
      .getByRole("dialog")
      .getByLabel("Service Name")
      .fill("Renewed Service")
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save Changes", exact: true })
      .click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(
      page.getByRole("rowheader", { name: "Renewed Service", exact: true }),
    ).toBeVisible()
    expect(refreshes).toBe(1)
    expect(updates).toHaveLength(2)
    expect(updates[1]).toEqual(updates[0])
    expect(updates[1].name).toBe("Renewed Service")
  })

  test("persistent storage cannot restore an authenticated session", async ({
    page,
  }) => {
    const requests: string[] = []
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/"))
        requests.push(request.url())
    })
    await page.addInitScript(() => {
      localStorage.setItem("nexus.auth.token", "test-session")
      localStorage.setItem("nexus.auth.refreshToken", "test-refresh")
    })
    await page.goto("/accounts")
    await expect(page).toHaveURL(/\/login$/)
    expect(requests).toEqual([])
  })

  for (const path of ["/login", "/register"]) {
    test(`${path} offers email authentication without removed social providers`, async ({
      page,
    }) => {
      await mockApi(page, "USER")
      await page.goto(path)
      await expect(
        page.getByLabel("Email address", { exact: true }),
      ).toBeVisible()
      await expect(
        page.getByRole("button", { name: /google|facebook|apple/i }),
      ).toHaveCount(0)
      await expect(
        page.getByRole("link", { name: /google|facebook|apple/i }),
      ).toHaveCount(0)
    })
  }

  test("auth pages render server HTML and unknown routes return 404", async ({
    request,
  }) => {
    for (const [path, title] of [
      ["/login", "Welcome Back"],
      ["/register", "Create Account"],
    ]) {
      const response = await request.get(path)
      expect(response.status()).toBe(200)
      expect(await response.text()).toContain(title)
    }
    const missing = await request.get("/missing-page")
    expect(missing.status()).toBe(404)
    expect(await missing.text()).toContain("Page not found")
  })

  test("anonymous home and protected deep links redirect to login", async ({
    page,
  }) => {
    for (const path of [
      "/",
      "/dashboard",
      "/accounts",
      "/departments",
      "/employees",
      "/services",
      "/clients",
    ]) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login$/)
      await expect(
        page.getByRole("heading", { name: "Welcome Back" }),
      ).toBeVisible()
    }
  })

  test("login preserves the loader, session, success toast, and sign-out", async ({
    page,
  }) => {
    await mockApi(page, "ADMIN")
    await page.goto("/login")
    await page
      .getByLabel("Email address", { exact: true })
      .fill(testAccounts.ADMIN.email)
    await page.getByLabel("Password", { exact: true }).fill("CorrectHorse123!")
    await page.getByRole("button", { name: "Sign In", exact: true }).click()
    await expect(
      page.getByRole("status", { name: "Opening your account" }),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(
      page.getByRole("status", { name: "Opening your account" }),
    ).toHaveCount(0)
    expect(
      await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBe("test-session")
    expect(
      await page.evaluate(() => localStorage.getItem("nexus.auth.token")),
    ).toBeNull()
    expect(
      (await page.context().cookies()).some(
        (cookie) => cookie.value === "test-session",
      ),
    ).toBe(false)
    await expect(page.getByText("Welcome back", { exact: true })).toBeVisible()
    expect(await storedTokens(page)).toEqual(["test-session", "test-refresh"])
    expect(
      await page.evaluate(() =>
        localStorage.getItem("nexus.auth.refreshToken"),
      ),
    ).toBeNull()
    await page.getByRole("button", { name: "Sign Out", exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)
    expect(await storedTokens(page)).toEqual([null, null])
    expect(
      await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBeNull()
  })

  test("invalid login credentials show toast error and retain entered email", async ({
    page,
  }) => {
    await mockApi(page, "USER")
    await page.goto("/login")
    await page
      .getByLabel("Email address", { exact: true })
      .fill("invalid@example.com")
    await page.getByLabel("Password", { exact: true }).fill("WrongPassword123!")
    await page.getByRole("button", { name: "Sign In", exact: true }).click()

    // Sileo toast appears with error message
    await expect(page.getByText("Sign-in failed")).toBeVisible()
    await expect(
      page.getByText("Email or password is incorrect. Please try again."),
    ).toBeVisible()
    // Remains on login page and preserves email
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(
      "invalid@example.com",
    )
    expect(
      await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBeNull()
  })

  test("registration input validation prevents submission on invalid fields", async ({
    page,
  }) => {
    await page.goto("/register")

    // Fill partial / invalid fields
    await page.getByLabel("Full name", { exact: true }).fill("A")
    await page.getByLabel("Contact number", { exact: true }).fill("12345")
    await page.getByLabel("Email address", { exact: true }).fill("not-an-email")
    await page.getByLabel("Password", { exact: true }).fill("short")
    await page.getByLabel("Confirm Password", { exact: true }).fill("mismatch")

    await page
      .getByRole("button", { name: "Create Account", exact: true })
      .click()

    // Validation errors should be visible for invalid input
    await expect(
      page.getByText("Name must be 2 to 100 characters."),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/register$/)
  })

  test("duplicate email registration displays inline server error alert", async ({
    page,
  }) => {
    await mockApi(page, "USER")
    await page.goto("/register")

    await page.getByLabel("Full name", { exact: true }).fill("Duplicate Person")
    await page.getByLabel("Contact number", { exact: true }).fill("09123456789")
    await page
      .getByLabel("Email address", { exact: true })
      .fill("duplicate@example.com")
    await page.getByLabel("Password", { exact: true }).fill("CorrectHorse123!")
    await page
      .getByLabel("Confirm Password", { exact: true })
      .fill("CorrectHorse123!")

    await page
      .getByRole("button", { name: "Create Account", exact: true })
      .click()

    // 409 Conflict triggers inline form alert
    await expect(
      page.getByRole("alert").filter({
        hasText: "This email is already registered. Sign in instead.",
      }),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/register$/)
  })

  test("registration keeps the existing API contract and opens the Client dashboard", async ({
    page,
  }) => {
    await mockApi(page, "USER")
    await page.goto("/register")
    await page.getByLabel("Full name", { exact: true }).fill("Test Person")
    await page.getByLabel("Contact number", { exact: true }).fill("09123456789")
    await page
      .getByLabel("Email address", { exact: true })
      .fill(testAccounts.USER.email)
    await page.getByLabel("Password", { exact: true }).fill("CorrectHorse123!")
    await page
      .getByLabel("Confirm Password", { exact: true })
      .fill("CorrectHorse123!")
    const submitted = page.waitForRequest("**/api/auth/register")
    await page
      .getByRole("button", { name: "Create Account", exact: true })
      .click()
    expect((await submitted).postDataJSON()).toEqual({
      fullName: "Test Person",
      contactNumber: "09123456789",
      email: testAccounts.USER.email,
      password: "CorrectHorse123!",
    })
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.locator('[data-role="USER"]')).toBeVisible()
    expect(await storedTokens(page)).toEqual(["test-session", "test-refresh"])
    await expect(
      page.getByRole("status", { name: "Opening your account" }),
    ).toHaveCount(0)
  })

  test("stored Filipino language hydrates and survives auth navigation", async ({
    page,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem("exp-auth-language", "fil"),
    )
    await page.goto("/login")
    await expect(page.locator('main[lang="fil"]')).toBeVisible()
    await page.locator('a[href="/register"]').click()
    await expect(page).toHaveURL(/\/register$/)
    await expect(page.locator('main[lang="fil"]')).toBeVisible()
  })

  for (const role of ["ADMIN", "SUPERADMIN", "STAFF", "USER"] as const) {
    test(`${role} keeps their session when opening login or registration directly`, async ({
      page,
    }) => {
      await restoreSession(page, role)
      const authWrites: string[] = []
      page.on("request", (request) => {
        if (
          ["/api/auth/logout", "/api/auth/login"].includes(
            new URL(request.url()).pathname,
          )
        )
          authWrites.push(request.url())
      })
      await page.goto("/dashboard")
      for (const path of ["/login", "/register"]) {
        await page.goto(path)
        await expect(page).toHaveURL(/\/dashboard$/)
        expect(
          await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
        ).toBe("test-session")
        await expect(
          page.getByRole("button", { name: "Sign In", exact: true }),
        ).toHaveCount(0)
      }
      expect(authWrites).toEqual([])
    })
  }

  test("opening login with an expired token allows sign-in", async ({
    page,
  }) => {
    await page.addInitScript(() =>
      sessionStorage.setItem("nexus.auth.token", "expired"),
    )
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({ status: 401, json: { error: "Unauthorized" } }),
    )
    await page.goto("/login")
    await expect(
      page.getByRole("button", { name: "Sign In", exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBeNull()
  })

  test("login session checks preserve the token during a server error and can retry", async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN")
    let unavailable = true
    await page.route("**/api/auth/me", (route) =>
      unavailable
        ? route.fulfill({ status: 503, json: { error: "Unavailable" } })
        : route.fallback(),
    )
    await page.goto("/login")
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "couldn't check your session",
    )
    expect(
      await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBe("test-session")
    await expect(
      page.getByRole("button", { name: "Sign In", exact: true }),
    ).toHaveCount(0)
    unavailable = false
    await page.getByRole("button", { name: "Try again", exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    expect(
      await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBe("test-session")
  })

  test("expired sessions clear the token and return to login", async ({
    page,
  }) => {
    await page.addInitScript(() =>
      sessionStorage.setItem("nexus.auth.token", "expired"),
    )
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 401,
        json: { error: "Unauthorized" },
      }),
    )
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login$/)
    expect(
      await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
    ).toBeNull()
  })
})
