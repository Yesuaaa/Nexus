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
export const live = process.env.NEXUS_E2E_LIVE === "1"

export const testAccounts = {
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

export function configureRegressionTest() {
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
}

export function accountFor(
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
      Permissions.ACCOUNTS_RESET_PASSWORD,
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

export type MockApiOptions = {
  accessToken?: () => string
  pricingTemplates?: PricingTemplate[]
  account?: Partial<Account>
  initialServices?: Service[]
  initialUsers?: Account[]
  initialDepartments?: Department[]
  initialEmployees?: Employee[]
}

export async function mockApi(
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
      : (pricingTemplates.find((item) => item.id === body.pricingTemplateId) ??
        null)
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
      iconKey: "sparkles",
      imageUrl: null,
      imageAltText: null,
      clientRequirements: [],
      requiresConsultation: false,
      consultationNotes: null,
      keyBenefits: [],
      isActive: true,
      pricingTemplateId: null,
      pricingTemplate: null,
      packages: [],
      departments: [
        { id: "dept-1", name: "Engineering", code: "ENG", color: "teal" },
      ],
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
    department: {
      id: "dept-1",
      name: "Engineering",
      code: "ENG",
      color: "teal",
    },
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
      color: "teal",
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
      department: {
        id: "dept-1",
        name: "Engineering",
        code: "ENG",
        color: "teal",
      },
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
        json: {
          token: "test-session",
          refreshToken: "test-refresh",
          user: currentUser,
          expiresIn: 900,
        },
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
        status: 201,
        json: {
          token: "test-session",
          refreshToken: "test-refresh",
          user: currentUser,
          expiresIn: 900,
        },
      })
      return
    }

    expect(request.headers().authorization).toBe(
      `Bearer ${options?.accessToken?.() ?? "test-session"}`,
    )

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
      const deleted = url.searchParams.get("deleted") === "true"
      const filtered = users.filter((u) => {
        const matchesSearch =
          !search ||
          u.email.toLowerCase().includes(search) ||
          (u.fullName?.toLowerCase().includes(search) ?? false)
        const matchesRole = !roleFilter || u.role === roleFilter
        const matchesDeletionState = Boolean(u.accountDeletedAt) === deleted
        return matchesSearch && matchesRole && matchesDeletionState
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

    const restoreAccountMatch = pathname.match(
      /^\/api\/users\/([^/]+)\/restore$/,
    )
    if (restoreAccountMatch && method === "POST") {
      const target = users.find(
        (user) => user.id === decodeURIComponent(restoreAccountMatch[1]),
      )
      if (target?.accountDeletedAt && !target.isActive) {
        target.accountDeletedAt = null
        await route.fulfill({ json: { user: target } })
      } else {
        await route.fulfill({
          status: 409,
          json: { error: "Only accounts in Trash can be restored" },
        })
      }
      return
    }

    const permanentAccountMatch = pathname.match(
      /^\/api\/users\/([^/]+)\/permanent$/,
    )
    if (permanentAccountMatch && method === "DELETE") {
      const targetId = decodeURIComponent(permanentAccountMatch[1])
      const targetIndex = users.findIndex((u) => u.id === targetId)
      if (targetIndex >= 0 && users[targetIndex]?.accountDeletedAt) {
        users.splice(targetIndex, 1)
        await route.fulfill({
          json: { message: "Account permanently deleted" },
        })
      } else {
        await route.fulfill({
          status: 409,
          json: { error: "Move the account to trash first" },
        })
      }
      return
    }

    const accountMatch = pathname.match(/^\/api\/users\/([^/]+)$/)
    if (accountMatch && method === "DELETE") {
      const targetId = decodeURIComponent(accountMatch[1])
      const target = users.find((u) => u.id === targetId)
      if (target && !target.isActive && !target.accountDeletedAt) {
        target.accountDeletedAt = new Date().toISOString()
        await route.fulfill({ json: { message: "Account moved to trash" } })
      } else {
        await route.fulfill({
          status: 409,
          json: { error: "Deactivate the account before moving it to trash" },
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
    if (pathname === "/api/client/services" && method === "GET") {
      await route.fulfill({
        json: { services: services.filter((service) => service.isActive) },
      })
      return
    }
    const clientServiceMatch = pathname.match(
      /^\/api\/client\/services\/([^/]+)$/,
    )
    if (clientServiceMatch && method === "GET") {
      const service = services.find(
        (item) => item.id === clientServiceMatch[1] && item.isActive,
      )
      await route.fulfill(
        service
          ? { json: { service } }
          : { status: 404, json: { error: "Service not found" } },
      )
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
        iconKey: body.iconKey,
        imageUrl: body.imageDataUrl,
        imageAltText: body.imageAltText,
        clientRequirements: body.clientRequirements,
        requiresConsultation: body.requiresConsultation,
        consultationNotes: body.consultationNotes,
        keyBenefits: body.keyBenefits.map((benefit, index) => ({
          ...benefit,
          id: `benefit-${index + 1}`,
          displayOrder: index,
        })),
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
    const serviceMatch = pathname.match(/^\/api\/services\/([^/]+)(\/status)?$/)
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
          method === "PUT" && body.keyBenefits
            ? {
                keyBenefits: body.keyBenefits.map((benefit, index) => ({
                  ...benefit,
                  id: `benefit-${index + 1}`,
                  displayOrder: index,
                })),
              }
            : {},
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
        color: Department["color"]
        code?: string
        description?: string
        headId?: string | null
      }
      const created: Department = {
        id: `dept-${Date.now()}`,
        name: body.name,
        color: body.color,
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

export async function restoreSession(
  page: Page,
  role: Account["role"],
  options?: MockApiOptions,
) {
  await mockApi(page, role, options)
  await page.addInitScript(() => {
    // Seed once so navigation cannot resurrect a signed-out session or
    // overwrite tokens that rotated during the test.
    if (sessionStorage.getItem("regression-session-initialized")) return
    sessionStorage.setItem("regression-session-initialized", "true")
    sessionStorage.setItem("nexus.auth.token", "test-session")
    sessionStorage.setItem("nexus.auth.refreshToken", "test-refresh")
  })
}

export async function storedTokens(page: Page) {
  return page.evaluate(() => [
    sessionStorage.getItem("nexus.auth.token"),
    sessionStorage.getItem("nexus.auth.refreshToken"),
  ])
}

export const expiredAccess = {
  error: "Access token expired",
  code: "ACCESS_TOKEN_EXPIRED",
}

export const renewedTokens = {
  token: "renewed-session",
  refreshToken: "renewed-refresh",
  expiresIn: 900,
}

export const managementRoutes = [
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
