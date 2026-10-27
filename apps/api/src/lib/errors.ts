/**
 * Shared helpers for detecting Prisma error codes.
 * Import from here instead of duplicating inline checks across feature routes.
 */

export function isPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === code
  )
}

/** Unique constraint violation (P2002) — e.g. duplicate email or employee ID. */
export function isUniqueConflict(error: unknown): boolean {
  return isPrismaCode(error, "P2002")
}

/** Foreign key / relation not found (P2003). */
export function isForeignKeyViolation(error: unknown): boolean {
  return isPrismaCode(error, "P2003")
}

/** Record to update/delete does not exist (P2025). */
export function isRecordNotFound(error: unknown): boolean {
  return isPrismaCode(error, "P2025")
}

/** Write conflict — serialisation failure (P2034). */
export function isWriteConflict(error: unknown): boolean {
  return isPrismaCode(error, "P2034")
}
