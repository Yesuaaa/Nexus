import { expect, test, type Page } from "@playwright/test"
import type { Account } from "../src/features/auth/model/types"
import { Permissions } from "../src/features/auth/model/permissions"
import type { Department } from "../src/features/departments/api/departments-api"
import type { Employee } from "../src/features/employees/api/employees-api"
import type {
  PricingTemplate,
  Service,
  ServiceInput,
} from "../src/features/services/api/services-api"

const pageErrors = new WeakMap<Page, string[]>()
const live = process.env.NEXUS_E2E_LIVE === "1"

const testAccounts = {
  SUPERADMIN: {
    email: "testsuperadmin@nexus.com",
    passwordKey: "NEXUS_E2E_SUPERADMIN_PASSWORD",
  },
  ADMIN: {
    email: "testadmin@nexus.com",
    passwordKey: "NEXUS_E2E_ADMIN_PASSWORD",
  },
  STAFF: {
    email: "teststaff@nexus.com",
    passwordKey: "NEXUS_E2E_STAFF_PASSWORD",
  },
  USER: {
    email: "testuser@nexus.com",
    passwordKey: "NEXUS_E2E_USER_PASSWORD",
  },
  DEACTIVATED: {
    email: "deactivated@nexus.com",
    passwordKey: "NEXUS_E2E_DEACTIVATED_PASSWORD",
  },
} as const

test.use({ reducedMotion: "reduce" })
// Keep real credentials and bearer tokens out of browser artifacts.
if (live) test.use({ trace: "off", screenshot: "off", video: "off" })

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
      }
      try {
        expect(response.status(), `${role} login must succeed`).toBe(200)
        expect(payload.user?.email).toBe(testAccounts[role].email)
        expect(payload.user?.role).toBe(role)
        expect(payload.user?.isActive).toBe(true)
        await expect(page).toHaveURL(/\/dashboard$/)
        expect(
          await page.evaluate(() =>
            Boolean(sessionStorage.getItem("nexus.auth.token")),
          ),
        ).toBe(true)
        expect(
          await page.evaluate(() => localStorage.getItem("nexus.auth.token")),
        ).toBeNull()
        for (const feature of features) {
          if (feature.roles.includes(role)) {
            const loaded = page.waitForResponse(
              (response) =>
                new URL(response.url()).pathname === feature.endpoint &&
                response.request().method() === "GET",
            )
            await page.goto(feature.path)
            expect((await loaded).status(), `${role} ${feature.endpoint}`).toBe(
              200,
            )
            await expect(
              page.getByRole("heading", { name: feature.title, exact: true }),
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
          const logout = await page.request.post("/api/auth/logout", {
            headers: { Authorization: `Bearer ${payload.token}` },
          })
          await page.evaluate(() =>
            sessionStorage.removeItem("nexus.auth.token"),
          )
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
      await page.evaluate(() => sessionStorage.removeItem("nexus.auth.token"))
    }
    expect(response.status()).toBe(401)
    expect(payload).not.toHaveProperty("token")
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

test.describe("mocked regression", () => {
  test.skip(live, "Live mode uses the supplied accounts against the real API")

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
        Permissions.DEPARTMENTS_MANAGE,
        Permissions.DEPARTMENTS_DELETE,
      )
    }
    if (role === "ADMIN") {
      permissions.push(
        Permissions.CLIENTS_READ,
        Permissions.EMPLOYEES_READ,
        Permissions.EMPLOYEES_MANAGE,
        Permissions.SERVICES_READ,
        Permissions.SERVICES_MANAGE,
      )
    }
    if (role === "SUPERADMIN") {
      permissions.push(
        Permissions.ACCOUNTS_READ,
        Permissions.ACCOUNTS_CREATE_BASIC,
        Permissions.ACCOUNTS_CREATE_PRIVILEGED,
        Permissions.ACCOUNTS_ASSIGN_BASIC,
        Permissions.ACCOUNTS_ASSIGN_PRIVILEGED,
        Permissions.ACCOUNTS_STATUS_BASIC,
        Permissions.ACCOUNTS_STATUS_PRIVILEGED,
      )
    }
    return {
      id: "actor",
      email: testAccounts[role].email,
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
    pricingTemplates?: PricingTemplate[]
    account?: Partial<Account>
    initialServices?: Service[]
    initialUsers?: Account[]
    initialDepartments?: Department[]
    initialEmployees?: Employee[]
  }

  async function mockApi(
    page: Page,
    role: Account["role"],
    options?: MockApiOptions,
  ) {
    const currentUser = accountFor(role, options?.account)
    const pricingTemplates = [...(options?.pricingTemplates ?? [])]
    function pricingFields(body: ServiceInput) {
      const timestamp = "2026-01-02T00:00:00.000Z"
      const template = body.pricingTemplate
        ? {
            ...body.pricingTemplate,
            id: `pricing-${pricingTemplates.length + 1}`,
            amount: body.pricingTemplate.amount?.toFixed(2) ?? null,
            createdAt: timestamp,
            updatedAt: timestamp,
          }
        : (pricingTemplates.find(
            (item) => item.id === body.pricingTemplateId,
          ) ?? null)
      if (body.pricingTemplate && template) pricingTemplates.push(template)
      return {
        pricingTemplateId: template?.id ?? null,
        pricingTemplate: template,
        packages: body.packages.map((item, index) => ({
          ...item,
          id: item.id ?? `package-${index + 1}`,
          amount: item.amount?.toFixed(2) ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
        })),
      }
    }
    const services: Service[] = options?.initialServices ?? [
      {
        id: "service-1",
        name: "Test Service",
        description: "A service used by the regression suite.",
        imageUrl: null,
        imageAltText: null,
        clientRequirements: [],
        requiresConsultation: false,
        consultationNotes: null,
        isActive: true,
        pricingTemplateId: null,
        pricingTemplate: null,
        packages: [],
        departments: [{ id: "dept-1", name: "Engineering", code: "ENG" }],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]
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
      departmentId: "dept-1",
      department: { id: "dept-1", name: "Engineering", code: "ENG" },
      teamId: null,
      team: null,
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

    const employees: Employee[] = options?.initialEmployees ?? [
      {
        id: "employee-1",
        employeeId: "EMP-001",
        fullName: "Alex Employee",
        email: "alex.employee@example.com",
        contactNumber: "09123456789",
        position: "Support Specialist",
        employmentType: "FULL_TIME",
        status: "ACTIVE",
        startDate: "2026-01-15",
        departmentId: "dept-1",
        teamId: null,
        department: { id: "dept-1", name: "Engineering", code: "ENG" },
        team: null,
        hasAccount: true,
        accountIsActive: true,
        createdAt: "2026-01-15T00:00:00.000Z",
        updatedAt: "2026-01-15T00:00:00.000Z",
      },
    ]

    await page.route("**/api/**", async (route) => {
      const request = route.request()
      const method = request.method()
      const url = new URL(request.url())
      const pathname = url.pathname
      expect(url.origin).toBe(new URL(page.url()).origin)

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
            json: {
              error: "Email or password is incorrect. Please try again.",
            },
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

      if (pathname === "/api/clients" && method === "GET") {
        const search = url.searchParams.get("search")?.toLowerCase() ?? ""
        const clients = users.filter(
          (user) =>
            user.role === "USER" &&
            `${user.fullName} ${user.email}`.toLowerCase().includes(search),
        )
        await route.fulfill({
          json: { clients, total: clients.length, page: 1, pageSize: 10 },
        })
        return
      }
      const clientMatch = pathname.match(
        /^\/api\/clients\/([^/]+)(?:\/(projects|service-requests))?$/,
      )
      if (clientMatch && method === "GET") {
        const client = users.find(
          (user) => user.id === clientMatch[1] && user.role === "USER",
        )
        if (!client)
          await route.fulfill({
            status: 404,
            json: { error: "Client not found" },
          })
        else if (clientMatch[2])
          await route.fulfill({
            json: {
              [clientMatch[2] === "projects" ? "projects" : "serviceRequests"]:
                [],
              total: 0,
              page: 1,
              pageSize: 10,
            },
          })
        else
          await route.fulfill({
            json: { client, serviceRequestCount: 0, projectCount: 0 },
          })
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

      if (pathname === "/api/employees" && method === "GET") {
        const search = url.searchParams.get("search")?.toLowerCase() ?? ""
        const filtered = employees.filter(
          (employee) =>
            !search ||
            employee.fullName.toLowerCase().includes(search) ||
            employee.employeeId.toLowerCase().includes(search) ||
            (employee.email?.toLowerCase().includes(search) ?? false),
        )
        await route.fulfill({
          json: {
            employees: filtered,
            total: filtered.length,
            page: 1,
            pageSize: 20,
          },
        })
        return
      }

      const employeeMatch = pathname.match(/^\/api\/employees\/([^/]+)$/)
      if (employeeMatch && method === "GET") {
        const employee = employees.find((item) => item.id === employeeMatch[1])
        await route.fulfill(
          employee
            ? { json: { employee } }
            : { status: 404, json: { error: "Employee not found" } },
        )
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
          await route.fulfill({
            status: 404,
            json: { error: "User not found" },
          })
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
          await route.fulfill({
            status: 404,
            json: { error: "User not found" },
          })
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

      if (pathname === "/api/services" && method === "GET") {
        await route.fulfill({ json: { services } })
        return
      }
      if (pathname === "/api/services/pricing-templates" && method === "GET") {
        await route.fulfill({ json: { pricingTemplates } })
        return
      }
      if (pathname === "/api/services" && method === "POST") {
        const body = request.postDataJSON() as ServiceInput
        const service: Service = {
          id: `service-${services.length + 1}`,
          name: body.name,
          description: body.description,
          imageUrl: body.imageDataUrl,
          imageAltText: body.imageAltText,
          clientRequirements: body.clientRequirements,
          requiresConsultation: body.requiresConsultation,
          consultationNotes: body.consultationNotes,
          isActive: body.isActive,
          ...pricingFields(body),
          departments: departments.filter((department) =>
            body.departmentIds.includes(department.id),
          ),
          createdAt: "2026-01-02T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        }
        services.push(service)
        await route.fulfill({ status: 201, json: { service } })
        return
      }
      const serviceMatch = pathname.match(
        /^\/api\/services\/([^/]+)(\/status)?$/,
      )
      if (serviceMatch && ["PUT", "PATCH", "DELETE"].includes(method)) {
        const service = services.find((item) => item.id === serviceMatch[1])
        expect(
          service,
          "Service mutation must target an existing fixture",
        ).toBeDefined()
        if (method === "DELETE") {
          services.splice(services.indexOf(service!), 1)
          await route.fulfill({ json: { success: true } })
        } else {
          const body = request.postDataJSON() as Partial<ServiceInput>
          Object.assign(
            service!,
            body,
            method === "PUT" ? pricingFields(body as ServiceInput) : {},
            body.departmentIds
              ? {
                  departments: departments.filter((department) =>
                    body.departmentIds!.includes(department.id),
                  ),
                }
              : {},
          )
          await route.fulfill({ json: { service } })
        }
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

      pageErrors.get(page)?.push(`Unhandled API request: ${method} ${pathname}`)
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

  // These tests exercise the real browser guards against controlled API responses.
  // Backend authorization, transactions, and session revocation are covered by
  // the API's offline PGlite integration tests, not by these mock handlers.
  const managementRoutes = [
    {
      path: "/accounts",
      endpoint: "/api/users",
      role: "SUPERADMIN",
      permission: Permissions.ACCOUNTS_READ,
      title: "Account Management",
    },
    {
      path: "/departments",
      endpoint: "/api/departments",
      role: "ADMIN",
      permission: Permissions.DEPARTMENTS_READ,
      title: "Department Management",
    },
    {
      path: "/employees",
      endpoint: "/api/employees",
      role: "ADMIN",
      permission: Permissions.EMPLOYEES_READ,
      title: "Employee Management",
    },
    {
      path: "/services",
      endpoint: "/api/services",
      role: "ADMIN",
      permission: Permissions.SERVICES_READ,
      title: "Service Management",
    },
    {
      path: "/clients",
      endpoint: "/api/clients",
      role: "ADMIN",
      permission: Permissions.CLIENTS_READ,
      title: "Client Management",
    },
  ] as const

  for (const feature of managementRoutes) {
    test(`${feature.path} denies access when the server withholds its read permission`, async ({
      page,
    }) => {
      const requests: string[] = []
      await restoreSession(page, feature.role, {
        account: {
          permissions: accountFor(feature.role).permissions.filter(
            (permission) => permission !== feature.permission,
          ),
        },
      })
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.startsWith(feature.endpoint))
          requests.push(request.url())
      })
      await page.goto(feature.path)
      await expect(page).toHaveURL(/\/dashboard$/)
      await expect(
        page.getByRole("heading", { name: feature.title }),
      ).toHaveCount(0)
      expect(requests).toEqual([])
    })

    test(`${feature.path} does not expose protected content when session lookup fails`, async ({
      page,
    }) => {
      await restoreSession(page, feature.role)
      await page.route("**/api/auth/me", (route) =>
        route.fulfill({ status: 503, json: { error: "Unavailable" } }),
      )
      await page.goto(feature.path)
      await expect(
        page.getByText(
          "We couldn't load your account. Please refresh to try again.",
        ),
      ).toBeVisible()
      await expect(
        page.getByRole("heading", { name: feature.title }),
      ).toHaveCount(0)
    })
  }

  for (const role of ["SUPERADMIN", "ADMIN", "STAFF", "USER"] as const) {
    test(`${role} client directory access and related records respect navigation guards`, async ({
      page,
    }) => {
      await restoreSession(page, role)
      const requests: string[] = []
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.startsWith("/api/clients"))
          requests.push(request.url())
      })
      await page.goto("/clients")
      if (role !== "ADMIN") {
        await expect(page).toHaveURL(/\/dashboard$/)
        expect(requests).toEqual([])
        return
      }
      await expect(
        page.getByRole("heading", { name: "Client Management" }),
      ).toBeVisible()
      await page.getByRole("button", { name: /View.*Target User/i }).click()
      await expect(page.getByRole("dialog")).toContainText("target@example.com")
      await page
        .getByRole("tab", { name: "Service requests", exact: true })
        .click()
      await expect(
        page.getByText("No service requests are linked to this client yet."),
      ).toBeVisible()
      await page.getByRole("tab", { name: "Projects", exact: true }).click()
      await expect(
        page.getByText("No projects are linked to this client yet."),
      ).toBeVisible()
      await page.getByRole("button", { name: "Close client details" }).click()
      await page
        .getByRole("searchbox", { name: "Search clients" })
        .fill("missing-client")
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: /No results for.*missing-client.*found/ }),
      ).toBeVisible()
      await page.getByRole("button", { name: "Clear filters" }).click()
      await expect(page.getByText("Target User", { exact: true })).toBeVisible()
    })
  }

  test("superadmin cannot edit their own role or account status", async ({
    page,
  }) => {
    await restoreSession(page, "SUPERADMIN")
    await page.goto("/accounts")
    await expect(page.getByText("Your account", { exact: true })).toBeVisible()
    await expect(
      page.getByRole("button", { name: /Role for testsuperadmin@nexus.com/ }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", {
        name: "More actions for testsuperadmin@nexus.com",
      }),
    ).toHaveCount(0)
    await page
      .getByRole("button", { name: "More actions for target@example.com" })
      .click()
    await expect(
      page.getByRole("menuitem", { name: "Delete account", exact: true }),
    ).toHaveCount(0)
  })

  test("persistent storage cannot restore an authenticated session", async ({
    page,
  }) => {
    const requests: string[] = []
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/"))
        requests.push(request.url())
    })
    await page.addInitScript(() =>
      localStorage.setItem("nexus.auth.token", "test-session"),
    )
    await page.goto("/accounts")
    await expect(page).toHaveURL(/\/login$/)
    expect(requests).toEqual([])
  })

  test("read-only service permission hides every mutation action", async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN", {
      account: {
        permissions: [Permissions.SERVICES_READ, Permissions.DEPARTMENTS_READ],
      },
    })
    await page.goto("/services")
    await expect(
      page.getByRole("rowheader", { name: "Test Service" }),
    ).toBeVisible()
    for (const name of [
      "Create Service",
      "Edit Test Service",
      "More actions for Test Service",
    ]) {
      await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
        0,
      )
    }
    await page.getByRole("button", { name: "View Test Service" }).click()
    await expect(page.getByRole("dialog")).toContainText(
      "A service used by the regression suite.",
    )
  })

  test("service creation validates department selection and preserves rejected edits", async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN")
    await page.goto("/services")
    await page
      .getByRole("button", { name: "Create Service", exact: true })
      .click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Service Name").fill("Consulting")
    await dialog
      .getByLabel("Description", { exact: false })
      .fill("Business consulting")
    await dialog.getByRole("button", { name: "Continue", exact: true }).click()
    await expect(dialog.getByRole("alert")).toHaveText(
      "Please select at least one responsible department",
    )
    await page
      .getByRole("button", { name: "Select responsible departments" })
      .click()
    await page.getByRole("menuitemcheckbox", { name: "Engineering" }).click()
    await page.keyboard.press("Escape")
    for (let step = 0; step < 3; step++) {
      await dialog
        .getByRole("button", { name: "Continue", exact: true })
        .click()
    }
    const created = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/services",
    )
    await dialog
      .getByRole("button", { name: "Create Service", exact: true })
      .click()
    expect((await created).postDataJSON()).toEqual({
      name: "Consulting",
      description: "Business consulting",
      departmentIds: ["dept-1"],
      isActive: true,
      imageDataUrl: null,
      imageAltText: null,
      removeImage: false,
      clientRequirements: [],
      requiresConsultation: false,
      consultationNotes: null,
      pricingTemplateId: null,
      pricingTemplate: null,
      packages: [],
    })
    await expect(
      page.getByRole("rowheader", { name: "Consulting", exact: true }),
    ).toBeVisible()
    await page
      .getByRole("button", { name: "Edit Consulting", exact: true })
      .click()
    await dialog.getByLabel("Service Name").fill("Updated Consulting")
    await page.route("**/api/services/service-2", (route) =>
      route.fulfill({ status: 403, json: { error: "Permission revoked" } }),
    )
    for (let step = 0; step < 3; step++) {
      await dialog
        .getByRole("button", { name: "Continue", exact: true })
        .click()
    }
    await dialog.getByRole("button", { name: "Save Changes" }).click()
    await expect(dialog.getByRole("alert")).toHaveText("Permission revoked")
    for (let step = 0; step < 3; step++) {
      await dialog.getByRole("button", { name: "Back", exact: true }).click()
    }
    await expect(dialog.getByLabel("Service Name")).toHaveValue(
      "Updated Consulting",
    )
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
    await expect(
      page.getByRole("rowheader", { name: "Consulting", exact: true }),
    ).toBeVisible()
  })

  test("service wizard persists consultation, recurring pricing, and packages after reload", async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN")
    await page.goto("/services")
    await page
      .getByRole("button", { name: "Edit Test Service", exact: true })
      .click()
    const dialog = page.getByRole("dialog")
    const next = () =>
      dialog.getByRole("button", { name: "Continue", exact: true }).click()
    await next()
    await dialog
      .getByRole("textbox", { name: /Client Requirements/ })
      .fill("  Brand guide  \n\nProject brief")
    await dialog
      .getByLabel("Consultation is required before proceeding")
      .check()
    await dialog.getByLabel("Consultation Notes").fill("Discuss project scope")
    await next()
    await dialog.getByLabel("Pricing Template", { exact: true }).click()
    await page
      .getByRole("option", { name: "Create a reusable template" })
      .click()
    await dialog
      .getByLabel("Template Name", { exact: true })
      .fill("Monthly support")
    await dialog.getByLabel("Pricing Model", { exact: true }).click()
    await page.getByRole("option", { name: "Recurring", exact: true }).click()
    await dialog.getByLabel("Amount (PHP)").fill("1500.50")
    await next()
    await expect(dialog.getByRole("alert")).toHaveText(
      "Select a billing interval",
    )
    await dialog.getByLabel("Billing Interval").click()
    await page.getByRole("option", { name: "Monthly", exact: true }).click()
    await next()
    await dialog.getByRole("button", { name: "Add Package" }).click()
    await dialog.getByLabel("Package Name").fill("Starter")
    await dialog
      .getByLabel("Description", { exact: true })
      .fill("Starter support package")
    await dialog
      .getByLabel("Included Features")
      .fill(" Email support \n\nMonthly review")
    await dialog.getByLabel("Recommended", { exact: true }).check()
    const saved = page.waitForRequest(
      (request) =>
        request.method() === "PUT" &&
        new URL(request.url()).pathname === "/api/services/service-1",
    )
    await dialog.getByRole("button", { name: "Save Changes" }).click()
    expect((await saved).postDataJSON()).toMatchObject({
      clientRequirements: ["Brand guide", "Project brief"],
      requiresConsultation: true,
      consultationNotes: "Discuss project scope",
      pricingTemplateId: null,
      pricingTemplate: {
        name: "Monthly support",
        pricingModel: "RECURRING",
        amount: 1500.5,
        currency: "PHP",
        billingInterval: "MONTHLY",
        isPublic: true,
      },
      packages: [
        expect.objectContaining({
          name: "Starter",
          includedFeatures: ["Email support", "Monthly review"],
          isRecommended: true,
        }),
      ],
    })
    await expect(dialog).toHaveCount(0)
    await page.reload()
    await page
      .getByRole("button", { name: "View Test Service", exact: true })
      .click()
    for (const text of [
      "Brand guide; Project brief",
      "Discuss project scope",
      "Starter support package",
      "Email support",
      "Recommended",
    ]) {
      await expect(dialog).toContainText(text)
    }
    await dialog.getByRole("button", { name: "Close details" }).click()
    await page
      .getByRole("button", { name: "Edit Test Service", exact: true })
      .click()
    await next()
    await expect(dialog.getByLabel("Consultation Notes")).toHaveValue(
      "Discuss project scope",
    )
    await dialog
      .getByLabel("Consultation is required before proceeding")
      .uncheck()
    await next()
    await expect(
      dialog.getByLabel("Pricing Template", { exact: true }),
    ).toContainText("Monthly support")
    await next()
    await expect(dialog.getByLabel("Package Name")).toHaveValue("Starter")
    const updated = page.waitForRequest(
      (request) =>
        request.method() === "PUT" &&
        new URL(request.url()).pathname === "/api/services/service-1",
    )
    await dialog.getByRole("button", { name: "Save Changes" }).click()
    expect((await updated).postDataJSON()).toMatchObject({
      requiresConsultation: false,
      consultationNotes: null,
      pricingTemplateId: "pricing-1",
      pricingTemplate: null,
      packages: [expect.objectContaining({ id: "package-1", name: "Starter" })],
    })
    await expect(dialog).toHaveCount(0)
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

  test("service deletion requires deactivation and explicit confirmation", async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN")
    await page.goto("/services")
    const actions = page.getByRole("button", {
      name: "More actions for Test Service",
    })
    await actions.click()
    await expect(
      page.getByRole("menuitem", { name: "Delete service" }),
    ).toHaveCount(0)
    await page.getByRole("menuitem", { name: "Deactivate service" }).click()
    await page
      .getByRole("button", { name: "Deactivate service", exact: true })
      .click()
    await expect(
      page.getByRole("row").filter({ hasText: "Test Service" }),
    ).toContainText("Inactive")
    await actions.click()
    await page.getByRole("menuitem", { name: "Delete service" }).click()
    await page.getByRole("button", { name: "Cancel", exact: true }).click()
    await expect(
      page.getByRole("rowheader", { name: "Test Service" }),
    ).toBeVisible()
    await actions.click()
    await page.getByRole("menuitem", { name: "Delete service" }).click()
    await page
      .getByRole("button", { name: "Delete service", exact: true })
      .click()
    await expect(
      page.getByText("No services have been created yet."),
    ).toBeVisible()
  })

  test("service descriptions render untrusted markup as text", async ({
    page,
  }) => {
    const payload = '<img src=x onerror="window.__regressionXss=true">'
    await restoreSession(page, "ADMIN", {
      initialServices: [
        {
          id: "unsafe",
          name: "Untrusted service",
          description: payload,
          imageUrl: null,
          imageAltText: null,
          clientRequirements: [],
          requiresConsultation: false,
          consultationNotes: null,
          isActive: true,
          pricingTemplateId: null,
          pricingTemplate: null,
          packages: [],
          departments: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    })
    await page.goto("/services")
    await expect(page.getByText(payload, { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "View Untrusted service" }).click()
    await expect(page.getByRole("dialog")).toContainText(payload)
    expect(
      await page.evaluate(() => Reflect.get(window, "__regressionXss")),
    ).toBeUndefined()
    await expect(page.locator('img[src="x"]')).toHaveCount(0)
  })

  test("employee search, details, and login retirement controls preserve HR records", async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN")
    await page.goto("/employees")
    await page.getByRole("button", { name: "View Alex Employee" }).click()
    await expect(page.getByRole("dialog")).toContainText("EMP-001")
    await expect(page.getByRole("dialog")).toContainText(
      "alex.employee@example.com",
    )
    await page.getByRole("button", { name: "Close employee details" }).click()
    await page
      .getByRole("button", { name: "More actions for Alex Employee" })
      .click()
    await expect(
      page.getByRole("menuitem", { name: "Deactivate login" }),
    ).toBeVisible()
    await expect(
      page.getByRole("menuitem", { name: "Delete login account" }),
    ).toHaveCount(0)
    await page.keyboard.press("Escape")
    await page.getByPlaceholder("Search name, ID, email…").fill("EMP-001")
    await expect(page.getByText("Alex Employee", { exact: true })).toBeVisible()
  })

  test("department head status changes are blocked without an eligible replacement", async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN")
    await page.route("**/api/employees/employee-1/status-options", (route) =>
      route.fulfill({
        json: {
          isDepartmentHead: true,
          replacementCandidates: [],
          recommendedReplacementEmployeeId: null,
          willRestoreOriginalHead: false,
        },
      }),
    )
    await page.goto("/employees")
    await page
      .getByRole("button", { name: "More actions for Alex Employee" })
      .click()
    await page.getByRole("menuitem", { name: "Change status" }).click()
    await page.getByRole("combobox", { name: "Status", exact: true }).click()
    await page.getByRole("option", { name: "On leave", exact: false }).click()
    await expect(
      page.getByText(
        "No active Staff member with an EXP account is available.",
        {
          exact: false,
        },
      ),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Confirm status" }),
    ).toBeDisabled()
  })

  test("department team creation reports authorization errors without adding a team", async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN")
    await page.route("**/api/departments/dept-1/teams", (route) =>
      route.fulfill({
        status: 403,
        json: { error: "Team permission revoked" },
      }),
    )
    await page.goto("/departments")
    await page.getByRole("button", { name: "Engineering", exact: true }).click()
    await page.getByRole("tab", { name: /Teams/ }).click()
    await page.getByRole("button", { name: "Create team", exact: true }).click()
    await page.getByLabel("Team name").fill("Restricted Team")
    const request = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname.endsWith("/dept-1/teams"),
    )
    await page.getByRole("button", { name: "Save team" }).click()
    expect((await request).postDataJSON()).toMatchObject({
      name: "Restricted Team",
    })
    await expect(page.getByText("Team permission revoked")).toBeVisible()
    await expect(
      page.getByText("No teams created in this department yet."),
    ).toBeVisible()
  })

  for (const status of [403, 500]) {
    test(`service list handles HTTP ${status} and recovers on retry`, async ({
      page,
    }) => {
      await restoreSession(page, "ADMIN")
      await page.route(
        "**/api/services",
        (route) =>
          route.fulfill({
            status,
            json: { error: "Service list unavailable" },
          }),
        { times: 1 },
      )
      await page.goto("/services")
      await expect(
        page.getByRole("table", { name: "Services" }).getByRole("alert"),
      ).toContainText("Service list unavailable")
      await expect(
        page.getByRole("rowheader", { name: "Test Service" }),
      ).toHaveCount(0)
      await page.getByRole("button", { name: "Try again" }).click()
      await expect(
        page.getByRole("rowheader", { name: "Test Service" }),
      ).toBeVisible()
    })
  }

  test("services cannot be created without a responsible department", async ({
    page,
  }) => {
    await restoreSession(page, "ADMIN", {
      initialDepartments: [],
      initialServices: [],
    })
    await page.goto("/services")
    await page
      .getByRole("button", { name: "Create Service", exact: true })
      .click()
    await expect(
      page.getByText("Create a department before creating a service."),
    ).toBeVisible()
    await expect(
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Continue", exact: true }),
    ).toBeDisabled()
  })

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
      const managesAccounts = role === "SUPERADMIN"
      await expect(
        menu.getByRole("link", { name: "Account Management", exact: true }),
      ).toHaveCount(managesAccounts ? 1 : 0)
      await expect(
        menu.getByRole("link", { name: "Department Management", exact: true }),
      ).toHaveCount(role === "ADMIN" ? 1 : 0)
      await expect(
        menu.getByRole("link", { name: "Employee Management", exact: true }),
      ).toHaveCount(role === "ADMIN" ? 1 : 0)
      await expect(
        menu.getByRole("link", { name: "Service Management", exact: true }),
      ).toHaveCount(role === "ADMIN" ? 1 : 0)

      await page.goto("/accounts")
      if (managesAccounts) {
        await expect(
          page.getByRole("heading", { name: "Account Management" }),
        ).toBeVisible()
        await expect(
          page.getByText("Test Person", { exact: true }),
        ).toBeVisible()
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

      const employeeRequests: string[] = []
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.startsWith("/api/employees")) {
          employeeRequests.push(request.url())
        }
      })
      await page.goto("/employees")
      if (role !== "ADMIN") {
        await expect(page).toHaveURL(/\/dashboard$/)
        await expect(
          page.getByRole("heading", { name: "Employee Management" }),
        ).toHaveCount(0)
        expect(employeeRequests).toEqual([])
      } else {
        await expect(
          page.getByRole("heading", { name: "Employee Management" }),
        ).toBeVisible()
        await expect(
          page.getByText("Alex Employee", { exact: true }),
        ).toBeVisible()
        await expect(
          page.getByRole("button", { name: "Create Employee", exact: true }),
        ).toHaveCount(1)
        expect(employeeRequests).toHaveLength(1)
      }

      const serviceRequests: string[] = []
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.startsWith("/api/services")) {
          serviceRequests.push(request.url())
        }
      })
      await page.goto("/services")
      if (role !== "ADMIN") {
        await expect(page).toHaveURL(/\/dashboard$/)
        await expect(
          page.getByRole("heading", { name: "Service Management" }),
        ).toHaveCount(0)
        expect(serviceRequests).toEqual([])
      } else {
        await expect(
          page.getByRole("heading", { name: "Service Management" }),
        ).toBeVisible()
        await expect(
          page.getByText("Test Service", { exact: true }),
        ).toBeVisible()
        await expect(
          page.getByRole("button", { name: "Create Service", exact: true }),
        ).toHaveCount(1)
        expect(
          serviceRequests.map((url) => new URL(url).pathname).sort(),
        ).toEqual(["/api/services", "/api/services/pricing-templates"])
        await page.reload()
        await expect(
          page.getByRole("heading", { name: "Service Management" }),
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
    await expect(
      page.getByRole("button", { name: "Engineering", exact: true }),
    ).toBeVisible()

    // 1. Create a Department
    await page
      .getByRole("button", { name: "Create Department", exact: true })
      .click()
    await expect(
      page.getByRole("heading", { name: "Create Department" }),
    ).toBeVisible()

    await page.getByLabel("Department Name").fill("Customer Support")
    await page.getByLabel("Department Code").fill("CS")
    await expect(
      page.getByRole("radiogroup", { name: "Department color" }),
    ).toBeVisible()
    await page.getByRole("radio", { name: "Green", exact: true }).click()
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Create Department" })
      .click()

    await expect(page.getByText("Customer Support")).toBeVisible()
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("department-colors") ?? "{}")[
            "customer support"
          ],
      ),
    ).toBe("green")

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
      .getByRole("button", { name: "Client Success", exact: true })
      .click()

    // Member Management Drawer / Sheet opens
    await expect(
      page.getByRole("heading", { name: "Members & teams" }),
    ).toBeVisible()
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
})
