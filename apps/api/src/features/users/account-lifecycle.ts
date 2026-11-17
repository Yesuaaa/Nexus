/**
 * Account lifecycle shared by Account Management (`/api/users`), the
 * employee directory (`/api/employees/:id/account`) and client management
 * (`/api/clients`): the self/lookup/permission preamble and the status,
 * Trash, restore and permanent-delete writes.
 *
 * Each endpoint keeps its own rules about *when* a step is allowed (users and
 * employees must be deactivated before Trash, clients are deactivated and
 * trashed in one step); this module only makes every step behave the same.
 * Writes are conditional (`guard`) so a concurrent change makes them a no-op
 * the caller reports as a conflict, and every write that ends access revokes
 * the account's sessions in the same transaction.
 */
import type { Prisma, Role, User } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { isForeignKeyViolation } from "../../lib/errors.js"
import { HttpError } from "../../shared/http-error.js"
import { canChangeAccountStatus } from "./users.policy.js"

type Db = Prisma.TransactionClient

/** No one may change their own role, status or Trash state (403). */
export function assertNotSelf(
  actorId: string,
  targetId: string,
  message: string,
) {
  if (actorId === targetId) throw new HttpError(403, message)
}

/**
 * Loads an account for management: 404 when missing or (unless
 * `includeTrashed`) in Trash, 403 with `denied` when `permitted` refuses it.
 * By default the actor needs status permission for the target's role.
 */
export type ManageOptions = {
  /** 403 message when `permitted` refuses the target. */
  denied?: string
  includeTrashed?: boolean
  permitted?: (target: User) => boolean
}

export async function findManageableAccount(
  actorRole: Role,
  targetId: string,
  {
    denied,
    includeTrashed = false,
    permitted = (target) => canChangeAccountStatus(actorRole, target.role),
  }: ManageOptions = {},
): Promise<User> {
  const target = await getPrisma()!.user.findUnique({
    where: { id: targetId },
  })
  if (!target || (!includeTrashed && target.accountDeletedAt))
    throw new HttpError(404, "User not found")
  if (!permitted(target))
    throw new HttpError(403, denied ?? "Insufficient permissions")
  return target
}

/** The full preamble: refuse the actor's own account, then load and authorize the target. */
export async function accountForManagement(
  actor: Pick<User, "id" | "role">,
  targetId: string,
  { self, ...options }: ManageOptions & { self: string },
) {
  assertNotSelf(actor.id, targetId, self)
  return findManageableAccount(actor.role, targetId, options)
}

export function revokeSessions(db: Db, userId: string) {
  return db.session.deleteMany({ where: { userId } })
}

/**
 * Enables or disables the login while it still matches `guard`; disabling
 * revokes its sessions. Returns false when the account no longer matched.
 */
export async function setAccountActive(
  db: Db,
  userId: string,
  isActive: boolean,
  guard: Prisma.UserWhereInput = {},
) {
  const { count } = await db.user.updateMany({
    where: { ...guard, id: userId },
    data: { isActive },
  })
  if (count && !isActive) await revokeSessions(db, userId)
  return count > 0
}

/**
 * Moves the account to Trash (optionally disabling it in the same write)
 * while it still matches `guard` and is not already trashed; revokes its
 * sessions. Returns false when the account no longer matched.
 */
export async function moveAccountToTrash(
  db: Db,
  userId: string,
  {
    guard = {},
    deactivate = false,
  }: { guard?: Prisma.UserWhereInput; deactivate?: boolean } = {},
) {
  const { count } = await db.user.updateMany({
    where: { ...guard, id: userId, accountDeletedAt: null },
    data: {
      accountDeletedAt: new Date(),
      ...(deactivate ? { isActive: false } : {}),
    },
  })
  if (count) await revokeSessions(db, userId)
  return count > 0
}

/** Takes the account out of Trash while it still matches `guard`. */
export async function restoreAccountFromTrash(
  db: Db,
  userId: string,
  guard: Prisma.UserWhereInput = {},
) {
  const { count } = await db.user.updateMany({
    where: { accountDeletedAt: { not: null }, ...guard, id: userId },
    data: { accountDeletedAt: null },
  })
  if (count) await revokeSessions(db, userId)
  return count > 0
}

/**
 * Deletes the account row while it still matches `guard`. An account other
 * records still reference is a 409 with `linkedMessage` (where to keep it).
 */
export async function deleteAccountPermanently(
  db: Db,
  userId: string,
  {
    guard = {},
    linkedMessage,
  }: { guard?: Prisma.UserWhereInput; linkedMessage: string },
) {
  try {
    const { count } = await db.user.deleteMany({
      where: { ...guard, id: userId },
    })
    return count > 0
  } catch (error) {
    if (isForeignKeyViolation(error)) throw new HttpError(409, linkedMessage)
    throw error
  }
}
