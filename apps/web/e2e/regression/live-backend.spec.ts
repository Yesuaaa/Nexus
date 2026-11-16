import { expect, test, type Page } from "@playwright/test"
import type { Account } from "../../src/features/auth/model/types"
import {
  configureRegressionTest,
  live,
  testAccounts,
} from "../regression-support"

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
    await page.goto(
      role === "USER" || role === "DEACTIVATED" ? "/login" : "/internal/login",
    )
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
