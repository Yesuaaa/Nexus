import type { AuthContext } from "../auth/auth.middleware.js"
import { readTransaction } from "../../lib/database-read.js"
import { HttpError } from "../../shared/http-error.js"
import { isRecordId } from "../../shared/validation.js"

/** Current-session check shared by diagnostic services, never cached. */
export async function authorizeDiagnosticRead(
  auth: AuthContext,
  unavailableMessage: string,
) {
  if (!auth?.user || !isRecordId(auth.user.id) || !isRecordId(auth.sessionId))
    throw new HttpError(401, "Authentication required")
  let session
  try {
    session = await readTransaction((tx) =>
      tx.session.findFirst({
        where: {
          id: auth.sessionId,
          userId: auth.user.id,
          expiresAt: { gt: new Date() },
        },
        select: {
          user: {
            select: { role: true, isActive: true, accountDeletedAt: true },
          },
        },
      }),
    )
  } catch {
    throw new HttpError(503, unavailableMessage)
  }
  if (
    !session ||
    !session.user.isActive ||
    session.user.accountDeletedAt !== null
  )
    throw new HttpError(401, "Invalid or expired session")
  if (session.user.role !== "SUPERADMIN")
    throw new HttpError(403, "Insufficient permissions")
}
