import assert from "node:assert/strict"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import express from "express"
import { Role, type User } from "../../generated/prisma/client.js"
import {
  hasPermission,
  Permission,
  permissionsFor,
} from "../auth/permissions.js"
import { requirePermission, requireRole } from "../auth/session.js"
import {
  canAssignRole,
  canChangeAccountStatus,
  canCreateRole,
} from "./role-policy.js"
import { publicUser } from "./public-user.js"

test("fixed roles have the expected permissions", () => {
  const common = [
    Permission.DASHBOARD_READ,
    Permission.PROFILE_READ,
    Permission.PROFILE_CHANGE_PASSWORD,
  ]
  const staff = [...common, Permission.DEPARTMENTS_READ]
  const admin = [
    ...staff,
    Permission.DEPARTMENTS_MANAGE,
    Permission.DEPARTMENTS_DELETE,
    Permission.SERVICES_READ,
    Permission.SERVICES_MANAGE,
  ]
  assert.deepEqual(permissionsFor(Role.USER), common)
  assert.deepEqual(permissionsFor(Role.STAFF), staff)
  assert.deepEqual(permissionsFor(Role.ADMIN), [
    ...admin,
    Permission.EMPLOYEES_READ,
    Permission.EMPLOYEES_MANAGE,
  ])
  assert.deepEqual(permissionsFor(Role.SUPERADMIN), [
    ...admin.filter(
      (permission) =>
        permission !== Permission.SERVICES_READ &&
        permission !== Permission.SERVICES_MANAGE,
    ),
    Permission.ACCOUNTS_READ,
    Permission.ACCOUNTS_CREATE_BASIC,
    Permission.ACCOUNTS_CREATE_PRIVILEGED,
    Permission.ACCOUNTS_ASSIGN_BASIC,
    Permission.ACCOUNTS_ASSIGN_PRIVILEGED,
    Permission.ACCOUNTS_STATUS_BASIC,
    Permission.ACCOUNTS_STATUS_PRIVILEGED,
  ])
  assert.equal(hasPermission(Role.USER, Permission.ACCOUNTS_READ), false)
  assert.equal(hasPermission(Role.ADMIN, Permission.ACCOUNTS_READ), false)
  assert.equal(hasPermission(Role.SUPERADMIN, Permission.ACCOUNTS_READ), true)
  assert.deepEqual(
    publicUser({ role: Role.ADMIN } as User).permissions,
    permissionsFor(Role.ADMIN),
  )
})

test("permission middleware denies missing permissions", async () => {
  const app = express()
  app.use((request, _response, next) => {
    const role = request.header("x-test-role")
    if (role && Object.values(Role).includes(role as Role)) {
      request.auth = { user: { role } as User, sessionId: "test" }
    }
    next()
  })
  app.get(
    "/accounts",
    requirePermission(Permission.ACCOUNTS_READ),
    (_request, response) => {
      response.json({ allowed: true })
    },
  )
  app.post(
    "/services",
    requirePermission(Permission.SERVICES_MANAGE),
    (_request, response) => {
      response.json({ allowed: true })
    },
  )
  app.get(
    "/services",
    requirePermission(Permission.SERVICES_READ),
    (_request, response) => {
      response.json({ allowed: true })
    },
  )
  const server = app.listen(0)
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve))
    const address = server.address() as AddressInfo
    const url = `http://127.0.0.1:${address.port}/accounts`
    for (const [role, expectedStatus] of [
      [undefined, 401],
      [Role.USER, 403],
      [Role.STAFF, 403],
      [Role.ADMIN, 403],
      [Role.SUPERADMIN, 200],
    ] as const) {
      const response = await fetch(url, {
        headers: role ? { "x-test-role": role } : {},
      })
      assert.equal(response.status, expectedStatus)
    }

    const servicesUrl = `http://127.0.0.1:${address.port}/services`
    for (const [role, expectedStatus] of [
      [undefined, 401],
      [Role.USER, 403],
      [Role.STAFF, 403],
      [Role.ADMIN, 200],
      [Role.SUPERADMIN, 403],
    ] as const) {
      const readResponse = await fetch(servicesUrl, {
        headers: role ? { "x-test-role": role } : {},
      })
      assert.equal(readResponse.status, expectedStatus)

      const response = await fetch(servicesUrl, {
        method: "POST",
        headers: role ? { "x-test-role": role } : {},
      })
      assert.equal(response.status, expectedStatus)
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
})

test("role middleware limits account routes to Superadmin", async () => {
  const app = express()
  app.use((request, _response, next) => {
    const role = request.header("x-test-role")
    if (role && Object.values(Role).includes(role as Role)) {
      request.auth = { user: { role } as User, sessionId: "test" }
    }
    next()
  })
  app.get("/accounts", requireRole(Role.SUPERADMIN), (_request, response) => {
    response.json({ allowed: true })
  })

  const server = app.listen(0)
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve))
    const address = server.address() as AddressInfo
    const url = `http://127.0.0.1:${address.port}/accounts`
    for (const [role, expectedStatus] of [
      [undefined, 401],
      [Role.USER, 403],
      [Role.STAFF, 403],
      [Role.ADMIN, 403],
      [Role.SUPERADMIN, 200],
    ] as const) {
      const response = await fetch(url, {
        headers: role ? { "x-test-role": role } : {},
      })
      assert.equal(response.status, expectedStatus)
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
})

test("role changes follow the account hierarchy", () => {
  for (const target of Object.values(Role)) {
    for (const next of Object.values(Role)) {
      assert.equal(canAssignRole(Role.SUPERADMIN, target, next), true)
      assert.equal(canAssignRole(Role.ADMIN, target, next), false)
      assert.equal(canAssignRole(Role.STAFF, target, next), false)
      assert.equal(canAssignRole(Role.USER, target, next), false)
    }
  }
})

test("account creation respects the same role hierarchy", () => {
  for (const role of Object.values(Role)) {
    assert.equal(canCreateRole(Role.SUPERADMIN, role), true)
    assert.equal(canCreateRole(Role.ADMIN, role), false)
    assert.equal(canCreateRole(Role.STAFF, role), false)
    assert.equal(canCreateRole(Role.USER, role), false)
  }
})

test("account status changes respect the role hierarchy", () => {
  for (const role of Object.values(Role)) {
    assert.equal(canChangeAccountStatus(Role.SUPERADMIN, role), true)
    assert.equal(canChangeAccountStatus(Role.ADMIN, role), false)
    assert.equal(canChangeAccountStatus(Role.STAFF, role), false)
    assert.equal(canChangeAccountStatus(Role.USER, role), false)
  }
})
