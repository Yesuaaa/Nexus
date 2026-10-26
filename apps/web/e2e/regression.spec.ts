import { expect, test, type Page } from "@playwright/test"
import type { Account } from "../src/features/auth/model/types"
import { Permissions } from "../src/features/auth/model/permissions"
import type { Department } from "../src/features/departments/api/departments-api"

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

function accountFor(
  role: Account["role"],
  overrides?: Partial<Account>,
): Account {
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
      Permissions.ACCOUNTS_STATUS_BASIC,
      Permissions.DEPARTMENTS_MANAGE,
      Permissions.DEPARTMENTS_DELETE,
    )
  }
  if (role === "SUPERADMIN") {
    permissions.push(
      Permissions.ACCOUNTS_CREATE_PRIVILEGED,
      Permissions.ACCOUNTS_ASSIGN_PRIVILEGED,
      Permissions.ACCOUNTS_STATUS_PRIVILEGED,
    )
  }
  return {
    id: "actor",
    email: "person@example.com",
    fullName: "Test Person",
    contactNumber: null,
    role,
    isActive: true,
    permissions,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

type MockApiOptions = {
  initialUsers?: Account[]
  initialDepartments?: Department[]
}

async function mockApi(
  page: Page,
  role: Account["role"],
  options?: MockApiOptions,
) {
  const currentUser = accountFor(role)
  const defaultManagedUser: Account = {
    id: "user-target",
    email: "target@example.com",
    fullName: "Target User",
    contactNumber: "09123456789",
    role: "USER",
    isActive: true,
    permissions: [
      Permissions.DASHBOARD_READ,
      Permissions.PROFILE_READ,
      Permissions.PROFILE_CHANGE_PASSWORD,
    ],
    createdAt: "2026-01-02T00:00:00.000Z",
  }

  const users: Account[] = options?.initialUsers ?? [
    currentUser,
    defaultManagedUser,
  ]

  const departments: Department[] = options?.initialDepartments ?? [
    {
      id: "dept-1",
      name: "Engineering",
      code: "ENG",
      description: "Engineering department",
      headId: null,
      head: null,
      memberCount: 3,
      teamCount: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ]

  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    const pathname = url.pathname

    if (pathname === "/api/auth/login" && method === "POST") {
      const data = request.postDataJSON() as {
        email?: string
        password?: string
      }
      if (
        data.email === "invalid@example.com" ||
        data.password === "WrongPassword123!"
      ) {
        await route.fulfill({
          status: 401,
          json: { error: "Email or password is incorrect. Please try again." },
        })
        return
      }
      await route.fulfill({
        json: { token: "test-session", user: currentUser, expiresIn: 60 },
      })
      return
    }

    if (pathname === "/api/auth/register" && method === "POST") {
      const data = request.postDataJSON() as { email?: string }
      if (data.email === "duplicate@example.com") {
        await route.fulfill({
          status: 409,
          json: {
            error: "This email is already registered. Sign in instead.",
          },
        })
        return
      }
      await route.fulfill({
        json: { token: "test-session", user: currentUser, expiresIn: 60 },
      })
      return
    }

    expect(request.headers().authorization).toBe("Bearer test-session")

    if (pathname === "/api/auth/logout") {
      await route.fulfill({ status: 204 })
      return
    }

    if (pathname === "/api/auth/me") {
      await route.fulfill({ json: { user: currentUser } })
      return
    }

    // --- Users / Accounts endpoints ---
    if (pathname === "/api/users" && method === "GET") {
      const search = url.searchParams.get("search")?.toLowerCase() ?? ""
      const roleFilter = url.searchParams.get("role") ?? ""
      const filtered = users.filter((u) => {
        const matchesSearch =
          !search ||
          u.email.toLowerCase().includes(search) ||
          (u.fullName?.toLowerCase().includes(search) ?? false)
        const matchesRole = !roleFilter || u.role === roleFilter
        return matchesSearch && matchesRole
      })
      await route.fulfill({
        json: {
          users: filtered,
          total: filtered.length,
          page: 1,
          pageSize: 20,
        },
      })
      return
    }

    if (pathname === "/api/users" && method === "POST") {
      const data = request.postDataJSON() as Partial<Account>
      const created: Account = {
        id: `user-${Date.now()}`,
        email: data.email ?? "new@example.com",
        fullName: data.fullName ?? "New Account",
        contactNumber: data.contactNumber ?? null,
        role: data.role ?? "USER",
        isActive: true,
        permissions: [
          Permissions.DASHBOARD_READ,
          Permissions.PROFILE_READ,
          Permissions.PROFILE_CHANGE_PASSWORD,
        ],
        createdAt: new Date().toISOString(),
      }
      users.push(created)
      await route.fulfill({ json: { user: created } })
      return
    }

    const roleMatch = pathname.match(/^\/api\/users\/([^/]+)\/role$/)
    if (roleMatch && method === "PATCH") {
      const targetId = decodeURIComponent(roleMatch[1])
      const { role: newRole } = request.postDataJSON() as {
        role: Account["role"]
      }
      const target = users.find((u) => u.id === targetId)
      if (target) {
        target.role = newRole
        await route.fulfill({ json: { user: target } })
      } else {
        await route.fulfill({ status: 404, json: { error: "User not found" } })
      }
      return
    }

    const statusMatch = pathname.match(/^\/api\/users\/([^/]+)\/status$/)
    if (statusMatch && method === "PATCH") {
      const targetId = decodeURIComponent(statusMatch[1])
      const { isActive } = request.postDataJSON() as { isActive: boolean }
      const target = users.find((u) => u.id === targetId)
      if (target) {
        target.isActive = isActive
        await route.fulfill({ json: { user: target } })
      } else {
        await route.fulfill({ status: 404, json: { error: "User not found" } })
      }
      return
    }

    // --- Departments endpoints ---
    if (pathname === "/api/departments/eligible-heads" && method === "GET") {
      await route.fulfill({
        json: {
          users: users.map((u) => ({
            id: u.id,
            email: u.email,
            fullName: u.fullName,
            role: u.role,
            headOf: null,
          })),
        },
      })
      return
    }

    const deptIdMatch = pathname.match(/^\/api\/departments\/([^/]+)$/)
    if (deptIdMatch && method === "GET") {
      const id = decodeURIComponent(deptIdMatch[1])
      const dept = departments.find((d) => d.id === id)
      if (dept) {
        await route.fulfill({
          json: { department: { ...dept, members: [], teams: [] } },
        })
      } else {
        await route.fulfill({
          status: 404,
          json: { error: "Department not found" },
        })
      }
      return
    }

    if (pathname === "/api/departments" && method === "GET") {
      await route.fulfill({ json: { departments } })
      return
    }

    if (pathname === "/api/departments" && method === "POST") {
      const body = request.postDataJSON() as {
        name: string
        code?: string
        description?: string
        headId?: string | null
      }
      const created: Department = {
        id: `dept-${Date.now()}`,
        name: body.name,
        code: body.code ?? null,
        description: body.description ?? null,
        headId: body.headId ?? null,
        head: null,
        memberCount: 0,
        teamCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      departments.push(created)
      await route.fulfill({ json: { department: created } })
      return
    }

    if (deptIdMatch && method === "PUT") {
      const id = decodeURIComponent(deptIdMatch[1])
      const body = request.postDataJSON() as Partial<Department>
      const target = departments.find((d) => d.id === id)
      if (target) {
        Object.assign(target, body, { updatedAt: new Date().toISOString() })
        await route.fulfill({ json: { department: target } })
      } else {
        await route.fulfill({
          status: 404,
          json: { error: "Department not found" },
        })
      }
      return
    }

    if (deptIdMatch && method === "DELETE") {
      const id = decodeURIComponent(deptIdMatch[1])
      const index = departments.findIndex((d) => d.id === id)
      if (index >= 0) {
        departments.splice(index, 1)
        await route.fulfill({ status: 204 })
      } else {
        await route.fulfill({
          status: 404,
          json: { error: "Department not found" },
        })
      }
      return
    }

    await route.fulfill({
      status: 404,
      json: { error: "Unknown test endpoint" },
    })
  })
}

async function restoreSession(
  page: Page,
  role: Account["role"],
  options?: MockApiOptions,
) {
  await mockApi(page, role, options)
  await page.addInitScript(() => {
    sessionStorage.setItem("nexus.auth.token", "test-session")
  })
}

// -----------------------------------------------------------------------------
// 1. Core SSR & Route Security
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// 2. Authentication Flow & Edge Cases
// -----------------------------------------------------------------------------

test("login preserves the loader, session, success toast, and sign-out", async ({
  page,
}) => {
  await mockApi(page, "ADMIN")
  await page.goto("/login")
  await page
    .getByLabel("Email address", { exact: true })
    .fill("person@example.com")
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
  await expect(page.getByText("Welcome back", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Sign Out", exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
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
    .fill("person@example.com")
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
    email: "person@example.com",
    password: "CorrectHorse123!",
  })
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator('[data-role="USER"]')).toBeVisible()
  await expect(
    page.getByRole("status", { name: "Opening your account" }),
  ).toHaveCount(0)
})

// -----------------------------------------------------------------------------
// 3. RBAC Layout, Navigation & Access Restrictions
// -----------------------------------------------------------------------------

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
      menu.getByRole("link", { name: "Department Management", exact: true }),
    ).toHaveCount(role === "ADMIN" ? 1 : 0)

    await page.goto("/accounts")
    if (managesAccounts) {
      await expect(
        page.getByRole("heading", { name: "Account Management" }),
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

// -----------------------------------------------------------------------------
// 4. Internationalization & Session Expiry
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// 5. Account Management Features (Search, Role Change, Status Toggle)
// -----------------------------------------------------------------------------

test("superadmin can search accounts, modify user roles, and deactivate/reactivate users", async ({
  page,
}) => {
  await restoreSession(page, "SUPERADMIN")
  await page.goto("/accounts")

  await expect(
    page.getByRole("heading", { name: "Account Management" }),
  ).toBeVisible()
  await expect(page.getByText("Target User")).toBeVisible()

  // 1. Search accounts
  const searchInput = page.getByPlaceholder("Search name or email")
  await searchInput.fill("Target")
  await expect(page.getByText("Target User")).toBeVisible()

  // 2. Modify Role
  const roleDropdown = page.getByRole("button", {
    name: "Role for target@example.com: User",
  })
  await roleDropdown.click()
  await page.getByRole("menuitemradio", { name: "Staff" }).click()

  const saveButton = page.getByRole("button", { name: "Save changes" })
  await expect(saveButton).toBeEnabled()
  await saveButton.click()
  await expect(
    page.getByRole("button", { name: "Role for target@example.com: Staff" }),
  ).toBeVisible()

  // 3. Deactivate User via Row Actions
  const actionsButton = page.getByRole("button", {
    name: "More actions for target@example.com",
  })
  await actionsButton.click()
  await page.getByRole("menuitem", { name: "Deactivate account" }).click()

  // Confirmation dialog opens
  await expect(page.getByText("Deactivate account?")).toBeVisible()
  await page
    .getByRole("button", { name: "Deactivate account", exact: true })
    .click()

  // Status pill reflects Inactive
  await expect(page.getByText("Inactive")).toBeVisible()

  // 4. Reactivate User
  await actionsButton.click()
  await page.getByRole("menuitem", { name: "Reactivate account" }).click()
  await expect(page.getByText("Reactivate account?")).toBeVisible()
  await page
    .getByRole("button", { name: "Reactivate account", exact: true })
    .click()

  // Status pill reflects Active again
  await expect(page.getByText("Active").first()).toBeVisible()
})

// -----------------------------------------------------------------------------
// 6. Department Management Features (Create, Edit, Delete, Members)
// -----------------------------------------------------------------------------

test("admin can create, edit, delete departments and open member management", async ({
  page,
}) => {
  await restoreSession(page, "ADMIN")
  await page.goto("/departments")

  await expect(
    page.getByRole("heading", { name: "Department Management" }),
  ).toBeVisible()
  await expect(page.getByText("Engineering")).toBeVisible()

  // 1. Create a Department
  await page
    .getByRole("button", { name: "Create Department", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Create Department" }),
  ).toBeVisible()

  await page.getByLabel("Department Name").fill("Customer Support")
  await page.getByLabel("Department Code").fill("CS")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create Department" })
    .click()

  await expect(page.getByText("Customer Support")).toBeVisible()

  // 2. Edit the Department
  await page.getByRole("button", { name: "Edit Customer Support" }).click()
  await expect(
    page.getByRole("heading", { name: "Edit Department" }),
  ).toBeVisible()
  await page.getByLabel("Department Name").fill("Client Success")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Update Department" })
    .click()

  await expect(page.getByText("Client Success")).toBeVisible()

  // 3. Open Member Management Sheet
  await page
    .getByRole("button", { name: "More actions for Client Success" })
    .click()
  await page.getByRole("menuitem", { name: "Members & teams" }).click()

  // Member Management Drawer / Sheet opens
  await expect(page.getByText("Members & teams").first()).toBeVisible()
  await page.getByRole("button", { name: "Close drawer" }).click()
  await expect(
    page.getByRole("heading", { name: "Members & teams" }),
  ).toHaveCount(0)

  // 4. Delete the Department
  await page
    .getByRole("button", { name: "More actions for Client Success" })
    .click()
  await page.getByRole("menuitem", { name: "Delete department" }).click()

  await expect(page.getByText("Delete department?")).toBeVisible()
  await page
    .getByRole("button", { name: "Delete department", exact: true })
    .click()

  await expect(page.getByText("Client Success")).toHaveCount(0)
})
