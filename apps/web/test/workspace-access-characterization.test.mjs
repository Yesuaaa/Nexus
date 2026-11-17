import assert from "node:assert/strict"
import { test } from "node:test"
import {
  canAccessAccountManagement,
  canAccessBookedServices,
  canAccessCalendar,
  canAccessClientManagement,
  canAccessDepartmentManagement,
  canAccessEmployeeManagement,
  canAccessMessages,
  canAccessProjects,
  canAccessProjectWorkspace,
  canAccessRequestInbox,
  canAccessServiceCatalog,
  canAccessServiceManagement,
  canCreateProjectWorkspace,
  Permissions,
} from "../src/features/auth/model/permissions.ts"

const permissionsByRole = {
  USER: [
    Permissions.DASHBOARD_READ,
    Permissions.PROFILE_READ,
    Permissions.PROFILE_CHANGE_PASSWORD,
  ],
  STAFF: [
    Permissions.DASHBOARD_READ,
    Permissions.PROFILE_READ,
    Permissions.PROFILE_CHANGE_PASSWORD,
    Permissions.DEPARTMENTS_READ,
  ],
  ADMIN: [
    Permissions.DASHBOARD_READ,
    Permissions.PROFILE_READ,
    Permissions.PROFILE_CHANGE_PASSWORD,
    Permissions.DEPARTMENTS_READ,
    Permissions.DEPARTMENTS_MANAGE,
    Permissions.DEPARTMENTS_DELETE,
    Permissions.EMPLOYEES_READ,
    Permissions.EMPLOYEES_MANAGE,
    Permissions.SERVICES_READ,
    Permissions.SERVICES_MANAGE,
    Permissions.CLIENTS_READ,
  ],
  SUPERADMIN: [
    Permissions.DASHBOARD_READ,
    Permissions.PROFILE_READ,
    Permissions.PROFILE_CHANGE_PASSWORD,
    Permissions.DEPARTMENTS_READ,
    Permissions.DEPARTMENTS_MANAGE,
    Permissions.DEPARTMENTS_DELETE,
    Permissions.ACCOUNTS_READ,
    Permissions.ACCOUNTS_RESET_PASSWORD,
    Permissions.ACCOUNTS_CREATE_BASIC,
    Permissions.ACCOUNTS_CREATE_PRIVILEGED,
    Permissions.ACCOUNTS_ASSIGN_BASIC,
    Permissions.ACCOUNTS_ASSIGN_PRIVILEGED,
    Permissions.ACCOUNTS_STATUS_BASIC,
    Permissions.ACCOUNTS_STATUS_PRIVILEGED,
  ],
}

function account(role, { departmentHead = false } = {}) {
  return {
    id: `${role.toLowerCase()}-1`,
    email: `${role.toLowerCase()}@example.com`,
    fullName: role,
    contactNumber: null,
    role,
    isActive: true,
    permissions: permissionsByRole[role],
    headOf: departmentHead ? { id: "department-1", name: "Design" } : null,
    createdAt: "2026-01-01T00:00:00.000Z",
  }
}

const accessChecks = {
  accounts: canAccessAccountManagement,
  bookedServices: canAccessBookedServices,
  calendar: canAccessCalendar,
  clients: canAccessClientManagement,
  departments: canAccessDepartmentManagement,
  employees: canAccessEmployeeManagement,
  messages: canAccessMessages,
  projects: canAccessProjects,
  projectWorkspace: canAccessProjectWorkspace,
  requestInbox: canAccessRequestInbox,
  serviceCatalog: canAccessServiceCatalog,
  serviceManagement: canAccessServiceManagement,
  workspaceCreation: canCreateProjectWorkspace,
}

const expectedAccess = {
  USER: {
    accounts: false,
    bookedServices: true,
    calendar: true,
    clients: false,
    departments: false,
    employees: false,
    messages: true,
    projects: true,
    projectWorkspace: false,
    requestInbox: false,
    serviceCatalog: true,
    serviceManagement: false,
    workspaceCreation: false,
  },
  STAFF: {
    accounts: false,
    bookedServices: false,
    calendar: true,
    clients: false,
    departments: false,
    employees: false,
    messages: true,
    projects: true,
    projectWorkspace: true,
    requestInbox: false,
    serviceCatalog: false,
    serviceManagement: false,
    workspaceCreation: false,
  },
  STAFF_HEAD: {
    accounts: false,
    bookedServices: false,
    calendar: true,
    clients: false,
    departments: false,
    employees: false,
    messages: true,
    projects: true,
    projectWorkspace: true,
    requestInbox: true,
    serviceCatalog: false,
    serviceManagement: false,
    workspaceCreation: true,
  },
  ADMIN: {
    accounts: false,
    bookedServices: false,
    calendar: true,
    clients: true,
    departments: true,
    employees: true,
    messages: true,
    projects: false,
    projectWorkspace: false,
    requestInbox: false,
    serviceCatalog: false,
    serviceManagement: true,
    workspaceCreation: false,
  },
  SUPERADMIN: {
    accounts: true,
    bookedServices: false,
    calendar: true,
    clients: false,
    departments: false,
    employees: false,
    messages: true,
    projects: false,
    projectWorkspace: false,
    requestInbox: false,
    serviceCatalog: false,
    serviceManagement: false,
    workspaceCreation: false,
  },
}

for (const [actor, expected] of Object.entries(expectedAccess)) {
  test(`${actor} keeps the characterized portal access matrix`, () => {
    const role = actor === "STAFF_HEAD" ? "STAFF" : actor
    const currentAccount = account(role, {
      departmentHead: actor === "STAFF_HEAD",
    })
    const actual = Object.fromEntries(
      Object.entries(accessChecks).map(([feature, check]) => [
        feature,
        check(currentAccount),
      ]),
    )

    assert.deepEqual(actual, expected)
  })
}
