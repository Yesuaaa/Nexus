import assert from "node:assert/strict"
import { test } from "node:test"
import { Permissions } from "../src/features/auth/model/permissions.ts"
import { getWorkspaceModules } from "../src/features/dashboard/model/workspace-modules.ts"

const permissionsByRole = {
  USER: [],
  STAFF: [Permissions.DEPARTMENTS_READ],
  ADMIN: [
    Permissions.DEPARTMENTS_READ,
    Permissions.EMPLOYEES_READ,
    Permissions.SERVICES_READ,
    Permissions.CLIENTS_READ,
  ],
  SUPERADMIN: [Permissions.ACCOUNTS_READ],
}

function account(
  role,
  { headOf = null, permissions = permissionsByRole[role] } = {},
) {
  return {
    id: `${role.toLowerCase()}-1`,
    email: `${role.toLowerCase()}@example.com`,
    fullName: role,
    contactNumber: null,
    role,
    isActive: true,
    permissions,
    headOf,
    createdAt: "2026-01-01T00:00:00.000Z",
  }
}

function moduleEntries(currentAccount) {
  return getWorkspaceModules(currentAccount).map(({ title, href }) => [
    title,
    href,
  ])
}

test("clients do not receive workspace selector entries", () => {
  assert.deepEqual(moduleEntries(account("USER")), [])
})

test("Staff receive project and personal attendance workspaces", () => {
  assert.deepEqual(moduleEntries(account("STAFF")), [
    ["Project Management", "/project-workspace"],
    ["Attendance & Monitoring", "/attendance/check-ins"],
  ])
})

test("a current department head receives Service Operations without changing Staff project access", () => {
  assert.deepEqual(
    moduleEntries(
      account("STAFF", {
        headOf: { id: "department-1", name: "Design" },
      }),
    ),
    [
      ["Service Operations", "/request-inbox"],
      ["Project Management", "/project-workspace"],
      ["Attendance & Monitoring", "/attendance/overview"],
    ],
  )
})

test("the selector returns only the Admin operational workspaces", () => {
  assert.deepEqual(moduleEntries(account("ADMIN")), [
    ["Service Operations", "/services"],
    ["People & HR", "/employees"],
    ["Attendance & Monitoring", "/attendance/overview"],
  ])
})

test("the selector returns only Administration for an authorized Superadmin", () => {
  assert.deepEqual(moduleEntries(account("SUPERADMIN")), [
    ["Administration", "/accounts"],
  ])
})

test("permission-limited accounts never receive a denied module entry route", () => {
  assert.deepEqual(
    moduleEntries(
      account("ADMIN", { permissions: [Permissions.CLIENTS_READ] }),
    ),
    [
      ["Service Operations", "/clients"],
      ["Attendance & Monitoring", "/attendance/check-ins"],
    ],
  )
  assert.deepEqual(
    moduleEntries(
      account("ADMIN", { permissions: [Permissions.DEPARTMENTS_READ] }),
    ),
    [
      ["People & HR", "/departments"],
      ["Attendance & Monitoring", "/attendance/check-ins"],
    ],
  )
  assert.deepEqual(
    moduleEntries(account("SUPERADMIN", { permissions: [] })),
    [],
  )
})
