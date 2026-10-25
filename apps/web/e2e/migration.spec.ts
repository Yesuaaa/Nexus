import { expect, test, type Page } from "@playwright/test"
import type { Account } from "../src/features/auth/model/types"
import { Permissions } from "../src/features/auth/model/permissions"

const pageErrors = new WeakMap<Page, string[]>()

test.use({ reducedMotion: "reduce" })

test.beforeEach(({ page }) => {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydration|hydrated/i.test(message.text())
    ) {
      errors.push(message.text())
    }
  })
})

test.afterEach(({ page }) => {
  expect(pageErrors.get(page)).toEqual([])
})

function accountFor(role: Account["role"]): Account {
  const permissions: Account["permissions"] = [
    Permissions.DASHBOARD_READ,
    Permissions.PROFILE_READ,
    Permissions.PROFILE_CHANGE_PASSWORD,
  ]
  if (role !== "USER") permissions.push(Permissions.DEPARTMENTS_READ)
  if (role === "ADMIN" || role === "SUPERADMIN") {
    permissions.push(
      Permissions.ACCOUNTS_READ,
      Permissions.ACCOUNTS_CREATE_BASIC,
      Permissions.ACCOUNTS_ASSIGN_BASIC,
      Permissions.DEPARTMENTS_MANAGE,
      Permissions.DEPARTMENTS_DELETE,
    )
  }
  if (role === "SUPERADMIN") {
    permissions.push(
      Permissions.ACCOUNTS_CREATE_PRIVILEGED,
      Permissions.ACCOUNTS_ASSIGN_PRIVILEGED,
    )
  }
  return {
    id: "actor",
    email: "person@example.com",
    fullName: "Test Person",
    contactNumber: null,
    role,
    permissions,
    createdAt: "2026-01-01T00:00:00.000Z",
  }
}

async function mockApi(page: Page, role: Account["role"]) {
  const user = accountFor(role)
  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname === "/api/auth/login" || pathname === "/api/auth/register") {
      await route.fulfill({
        json: { token: "test-session", user, expiresIn: 60 },
      })
      return
    }
    expect(request.headers().authorization).toBe("Bearer test-session")
    if (pathname === "/api/auth/logout") {
      await route.fulfill({ status: 204 })
    } else if (pathname === "/api/auth/me") {
      await route.fulfill({ json: { user } })
    } else if (pathname === "/api/users") {
      await route.fulfill({
        json: { users: [user], total: 1, page: 1, pageSize: 20 },
      })
    } else if (pathname === "/api/departments") {
      await route.fulfill({ json: { departments: [] } })
    } else {
      await route.fulfill({
        status: 404,
        json: { error: "Unknown test endpoint" },
      })
    }
  })
}

async function restoreSession(page: Page, role: Account["role"]) {
  await mockApi(page, role)
  await page.addInitScript(() => {
    sessionStorage.setItem("nexus.auth.token", "test-session")
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
  for (const path of ["/", "/dashboard", "/accounts", "/departments"]) {
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
    .fill("person@example.com")
  await page
    .getByLabel("Password", { exact: true })
    .fill("correct horse battery staple")
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
  await expect(page.getByText("Welcome back", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Sign Out", exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(
    await page.evaluate(() => sessionStorage.getItem("nexus.auth.token")),
  ).toBeNull()
})

test("registration keeps the existing API contract and opens the Client dashboard", async ({
  page,
}) => {
  await mockApi(page, "USER")
  await page.goto("/register")
  await page.getByLabel("Full name", { exact: true }).fill("Test Person")
  await page
    .getByLabel("Contact number", { exact: true })
    .fill("+63 912 345 6789")
  await page
    .getByLabel("Email address", { exact: true })
    .fill("person@example.com")
  await page
    .getByLabel("Password", { exact: true })
    .fill("correct horse battery staple")
  await page
    .getByLabel("Confirm Password", { exact: true })
    .fill("correct horse battery staple")
  const submitted = page.waitForRequest("**/api/auth/register")
  await page
    .getByRole("button", { name: "Create Account", exact: true })
    .click()
  expect((await submitted).postDataJSON()).toEqual({
    fullName: "Test Person",
    contactNumber: "+63 912 345 6789",
    email: "person@example.com",
    password: "correct horse battery staple",
  })
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator('[data-role="USER"]')).toBeVisible()
  await expect(
    page.getByRole("status", { name: "Opening your account" }),
  ).toHaveCount(0)
})

for (const role of ["SUPERADMIN", "ADMIN", "STAFF", "USER"] as const) {
  test(`${role} restores its layout, navigation, and deep-link permissions`, async ({
    page,
  }) => {
    await restoreSession(page, role)
    await page.goto("/")
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.locator(`[data-role="${role}"]`)).toBeVisible()
    const menu = page.getByRole("navigation", { name: "Main menu" })
    const managesAccounts = role === "SUPERADMIN" || role === "ADMIN"
    await expect(
      menu.getByRole("link", { name: "Account Management", exact: true }),
    ).toHaveCount(managesAccounts ? 1 : 0)
    await expect(
      menu.getByRole("link", { name: "Departments", exact: true }),
    ).toHaveCount(role === "ADMIN" ? 1 : 0)

    await page.goto("/accounts")
    if (managesAccounts) {
      await expect(
        page.getByRole("heading", { name: "Account management" }),
      ).toBeVisible()
      await expect(page.getByText("Test Person", { exact: true })).toBeVisible()
      await expect(
        menu.getByRole("link", { name: "Account Management", exact: true }),
      ).toHaveAttribute("aria-current", "page")
    } else {
      await expect(page).toHaveURL(/\/dashboard$/)
    }

    const departmentRequests: string[] = []
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/departments")) {
        departmentRequests.push(request.url())
      }
    })
    await page.goto("/departments")
    if (role !== "ADMIN") {
      await expect(page).toHaveURL(/\/dashboard$/)
      await expect(
        page.getByRole("heading", { name: "Department Management" }),
      ).toHaveCount(0)
      expect(departmentRequests).toEqual([])
    } else {
      await expect(
        page.getByRole("heading", { name: "Department Management" }),
      ).toBeVisible()
      await expect(
        page.getByRole("button", { name: "Create Department", exact: true }),
      ).toHaveCount(1)
      await page.reload()
      await expect(
        page.getByRole("heading", { name: "Department Management" }),
      ).toBeVisible()
    }
  })
}

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
