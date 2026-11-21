import assert from "node:assert/strict"
import { test } from "node:test"
import { Role } from "../../../src/generated/prisma/client.js"
import {
  AdministrativeCapability,
  OperationalCapability,
  hasAdministrativeCapability,
  hasOperationalCapability,
  type AuthorizationActor,
  type OperationalAccess,
} from "../../../src/features/auth/auth.capabilities.js"
import {
  hasPermission,
  Permission,
  permissionsFor,
} from "../../../src/features/auth/auth.permissions.js"

const payrollAuthorization =
  (await import("../../../src/features/auth/auth.capabilities.js")) as unknown as {
    PayrollCapability?: { READ: string; MANAGE: string }
    hasPayrollCapability?: (
      actor: AuthorizationActor,
      capability: string,
    ) => boolean
  }

function actor(role: Role): AuthorizationActor {
  return { id: "actor", role, isActive: true, accountDeletedAt: null }
}

const operationalCases: {
  access: OperationalAccess
  allowedRoles: readonly Role[]
}[] = [
  {
    access: {
      capability: OperationalCapability.ASSIGNED_STAFF,
      assignedUserId: "actor",
    },
    allowedRoles: [Role.STAFF],
  },
  {
    access: {
      capability: OperationalCapability.DEPARTMENT_HEAD,
      headUserId: "actor",
    },
    allowedRoles: [Role.STAFF],
  },
  {
    access: {
      capability: OperationalCapability.EMPLOYEE_SELF_SERVICE,
      employeeUserId: "actor",
    },
    allowedRoles: [Role.STAFF, Role.ADMIN],
  },
  {
    access: {
      capability: OperationalCapability.CLIENT_DECISION,
      clientUserId: "actor",
    },
    allowedRoles: [Role.USER],
  },
  {
    access: {
      capability: OperationalCapability.CONVERSATION_PARTICIPATION,
      participantUserIds: ["actor"],
    },
    allowedRoles: Object.values(Role),
  },
]

test("Superadmin has explicit global authority without operational identity or assignments", () => {
  const superadmin = actor(Role.SUPERADMIN)
  for (const capability of Object.values(AdministrativeCapability)) {
    assert.equal(hasAdministrativeCapability(superadmin, capability), true)
    assert.equal(hasPermission(superadmin.role, capability), true)
    assert.ok(permissionsFor(superadmin.role).includes(capability))
  }
  for (const { access } of operationalCases.slice(0, 4))
    assert.equal(hasOperationalCapability(superadmin, access), false)
})

test("Admin, Staff, and Client receive no new global administrative grants", () => {
  for (const role of [Role.ADMIN, Role.STAFF, Role.USER])
    for (const capability of Object.values(AdministrativeCapability)) {
      assert.equal(hasAdministrativeCapability(actor(role), capability), false)
      assert.equal(hasPermission(role, capability), false)
      assert.equal(permissionsFor(role).includes(capability), false)
    }
})

test("Payroll capabilities give Admin operational access and Superadmin read-only access", () => {
  const { PayrollCapability: payroll, hasPayrollCapability: hasPayroll } =
    payrollAuthorization
  assert.equal(typeof hasPayroll, "function")
  if (!payroll || !hasPayroll) return

  for (const role of Object.values(Role)) {
    const canRead = role === Role.ADMIN || role === Role.SUPERADMIN
    assert.equal(hasPayroll(actor(role), payroll.READ), canRead, `${role} read`)
    assert.equal(
      hasPayroll(actor(role), payroll.MANAGE),
      role === Role.ADMIN,
      `${role} manage`,
    )
  }

  assert.equal(
    hasPayroll({ ...actor(Role.ADMIN), isActive: false }, payroll.READ),
    false,
  )
  assert.equal(
    hasPayroll(
      { ...actor(Role.SUPERADMIN), accountDeletedAt: new Date() },
      payroll.READ,
    ),
    false,
  )
})

test("operational capabilities retain role eligibility even with matching record identities", () => {
  for (const { access, allowedRoles } of operationalCases)
    for (const role of Object.values(Role))
      assert.equal(
        hasOperationalCapability(actor(role), access),
        allowedRoles.includes(role),
        `${role}: ${access.capability}`,
      )
})

test("roles alone cannot grant assignment, head authority, employee access, or client ownership", () => {
  for (const userId of [null, "another-user"]) {
    const unscoped: OperationalAccess[] = [
      {
        capability: OperationalCapability.ASSIGNED_STAFF,
        assignedUserId: userId,
      },
      {
        capability: OperationalCapability.DEPARTMENT_HEAD,
        headUserId: userId,
      },
      {
        capability: OperationalCapability.EMPLOYEE_SELF_SERVICE,
        employeeUserId: userId,
      },
      {
        capability: OperationalCapability.CLIENT_DECISION,
        clientUserId: userId,
      },
    ]
    for (const role of Object.values(Role))
      for (const access of unscoped)
        assert.equal(hasOperationalCapability(actor(role), access), false)
  }
})

test("business-conversation inspection does not confer participation", () => {
  const superadmin = actor(Role.SUPERADMIN)
  assert.equal(
    hasAdministrativeCapability(
      superadmin,
      AdministrativeCapability.BUSINESS_CONVERSATION_INSPECTION,
    ),
    true,
  )
  for (const role of Object.values(Role))
    for (const participantUserIds of [[], ["another-user"]])
      assert.equal(
        hasOperationalCapability(actor(role), {
          capability: OperationalCapability.CONVERSATION_PARTICIPATION,
          participantUserIds,
        }),
        false,
      )
  // Superadmin can still participate in a conversation it actually belongs to.
  assert.equal(
    hasOperationalCapability(superadmin, {
      capability: OperationalCapability.CONVERSATION_PARTICIPATION,
      participantUserIds: [superadmin.id],
    }),
    true,
  )
})

test("inactive and retired accounts cannot use administrative or operational capabilities", () => {
  for (const role of Object.values(Role))
    for (const unavailable of [
      { ...actor(role), isActive: false },
      { ...actor(role), accountDeletedAt: new Date() },
    ]) {
      for (const capability of Object.values(AdministrativeCapability))
        assert.equal(
          hasAdministrativeCapability(unavailable, capability),
          false,
        )
      for (const { access } of operationalCases)
        assert.equal(hasOperationalCapability(unavailable, access), false)
    }
})

test("capability helpers reject unsupported capabilities instead of bypassing permissions", () => {
  const superadmin = actor(Role.SUPERADMIN)
  for (const capability of [Permission.PROFILE_READ, "future:unknown"])
    assert.equal(
      hasAdministrativeCapability(
        superadmin,
        capability as AdministrativeCapability,
      ),
      false,
    )
  assert.equal(
    hasPermission(Role.SUPERADMIN, "future:unknown" as Permission),
    false,
  )
  assert.equal(
    hasOperationalCapability(superadmin, {
      capability: "future:unknown",
    } as unknown as OperationalAccess),
    false,
  )
})
