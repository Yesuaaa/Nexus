import {
  AccountManagementAction as Action,
  AccountManagementOrigin as Origin,
  Role,
  type Prisma,
} from "../../generated/prisma/client.js"
import {
  assertHistoryObject,
  assertManagementOperation,
  historyBoolean,
  historyTimestamp,
  historyTransition,
  validateHistoryPayload,
  type HistoryTransition as Transition,
  type HistoryValueCheck,
  type ManagementOperation,
} from "../../shared/management-history.js"

type Payloads = {
  CREATED: {
    role: { before: null; after: Role }
    isActive: { before: null; after: boolean }
  }
  PROFILE_UPDATED: { isActive?: Transition<boolean>; sessionsRevoked?: boolean }
  ROLE_CHANGED: { role: Transition<Role> }
  STATUS_CHANGED: { isActive?: Transition<boolean>; sessionsRevoked: boolean }
  PASSWORD_RESET: { sessionsRevoked: true }
  ARCHIVED: {
    accountDeletedAt: Transition<string | null>
    isActive?: Transition<boolean>
    sessionsRevoked: boolean
  }
  RESTORED: {
    accountDeletedAt: Transition<string | null>
    sessionsRevoked: boolean
  }
  DELETED: Record<string, never>
}

export type AccountManagementChangeInput = {
  [A in Action]: {
    action: A
    origin: Origin
    subjectAccountId: string
    changedFields: readonly (
      | "role"
      | "isActive"
      | "accountDeletedAt"
      | "fullName"
      | "email"
      | "contactNumber"
    )[]
    changes: Payloads[A]
  }
}[Action]

const role: HistoryValueCheck = (value) =>
  Object.values(Role).some((r) => r === value)
const active = historyTransition(historyBoolean)
const lifecycle = historyTransition(historyTimestamp)
const created =
  (check: HistoryValueCheck): HistoryValueCheck =>
  (value) => {
    assertHistoryObject(value, ["before", "after"], ["before", "after"])
    return value.before === null && check(value.after)
  }
const archived: HistoryValueCheck = (value) => {
  if (!lifecycle(value)) return false
  return (
    (value as Transition<string | null>).before === null &&
    (value as Transition<string | null>).after !== null
  )
}
const restored: HistoryValueCheck = (value) => {
  if (!lifecycle(value)) return false
  return (
    (value as Transition<string | null>).before !== null &&
    (value as Transition<string | null>).after === null
  )
}
const policies = {
  CREATED: {
    fields: ["role", "isActive", "fullName", "email", "contactNumber"],
    checks: {
      role: created(role),
      isActive: created(historyBoolean),
    },
    required: ["role", "isActive"],
    origins: [
      Origin.ACCOUNT_MANAGEMENT,
      Origin.CLIENT_MANAGEMENT,
      Origin.EMPLOYEE_MANAGEMENT,
    ],
  },
  PROFILE_UPDATED: {
    fields: ["fullName", "email", "contactNumber", "isActive"],
    checks: { isActive: active, sessionsRevoked: historyBoolean },
    required: [],
    origins: [Origin.CLIENT_MANAGEMENT, Origin.ACCOUNT_MANAGEMENT],
  },
  ROLE_CHANGED: {
    fields: ["role"],
    checks: { role: historyTransition(role) },
    required: ["role"],
    origins: [Origin.ACCOUNT_MANAGEMENT],
  },
  STATUS_CHANGED: {
    fields: ["isActive"],
    checks: { isActive: active, sessionsRevoked: historyBoolean },
    required: ["sessionsRevoked"],
    origins: [Origin.ACCOUNT_MANAGEMENT, Origin.EMPLOYEE_MANAGEMENT],
  },
  PASSWORD_RESET: {
    fields: [],
    checks: { sessionsRevoked: (v: unknown) => v === true },
    required: ["sessionsRevoked"],
    origins: [Origin.ACCOUNT_MANAGEMENT],
  },
  ARCHIVED: {
    fields: ["accountDeletedAt", "isActive"],
    checks: {
      accountDeletedAt: archived,
      isActive: active,
      sessionsRevoked: historyBoolean,
    },
    required: ["accountDeletedAt", "sessionsRevoked"],
    origins: [
      Origin.ACCOUNT_MANAGEMENT,
      Origin.CLIENT_MANAGEMENT,
      Origin.EMPLOYEE_MANAGEMENT,
    ],
  },
  RESTORED: {
    fields: ["accountDeletedAt"],
    checks: { accountDeletedAt: restored, sessionsRevoked: historyBoolean },
    required: ["accountDeletedAt", "sessionsRevoked"],
    origins: [Origin.ACCOUNT_MANAGEMENT],
  },
  DELETED: {
    fields: [],
    checks: {},
    required: [],
    origins: [Origin.ACCOUNT_MANAGEMENT, Origin.EMPLOYEE_MANAGEMENT],
  },
} satisfies Record<
  Action,
  {
    fields: readonly string[]
    checks: Record<string, HistoryValueCheck>
    required: readonly string[]
    origins: readonly Origin[]
  }
>

/** Append only; caller must use its management transaction, never the root client. */
export async function writeAccountManagementChange(
  tx: Prisma.TransactionClient,
  operation: ManagementOperation,
  input: AccountManagementChangeInput,
) {
  assertManagementOperation(operation)
  assertHistoryObject(input, [
    "action",
    "origin",
    "subjectAccountId",
    "changedFields",
    "changes",
  ])
  if (!Object.values(Action).includes(input.action))
    throw new Error("Invalid account history action")
  const policy = policies[input.action]
  if (!(policy.origins as readonly Origin[]).includes(input.origin)) {
    throw new Error("Invalid account history origin")
  }
  const payload = validateHistoryPayload(
    input,
    "subjectAccountId",
    policy.fields,
    policy.checks,
    policy.required,
  )
  if (
    input.action === Action.STATUS_CHANGED &&
    !Object.hasOwn(payload.changes, "isActive") &&
    payload.changes.sessionsRevoked !== true
  ) {
    throw new Error(
      "Status history requires a transition or completed revocation",
    )
  }
  return tx.accountManagementChange.create({
    data: {
      actorAccountId: operation.actorAccountId,
      actorRoleAtTime: operation.actorRoleAtTime,
      operationId: operation.operationId,
      subjectAccountId: input.subjectAccountId,
      action: input.action,
      origin: input.origin,
      ...payload,
    },
  })
}
