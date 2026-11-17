/**
 * Shared Prisma where-fragments for "who is a current account" checks.
 * Use them only where the rule is exactly this; variants that intentionally
 * differ (e.g. also requiring an ACTIVE employee record, or allowing users
 * without an employee record) should stay explicit at the call site.
 */
import type { Prisma } from "../../generated/prisma/client.js"

/** A login that is enabled and not in Trash. */
export const activeAccount = {
  isActive: true,
  accountDeletedAt: null,
} as const satisfies Prisma.UserWhereInput

/** An active STAFF login. */
export const activeStaff = {
  ...activeAccount,
  role: "STAFF",
} as const satisfies Prisma.UserWhereInput

/** The department headed by `userId`, while that head is active STAFF. */
export function activeDepartmentHead(userId: string) {
  return {
    headId: userId,
    head: activeStaff,
  } as const satisfies Prisma.DepartmentWhereInput
}
