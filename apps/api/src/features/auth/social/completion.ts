import type {
  Prisma,
  SocialCompletion,
} from "../../../generated/prisma/client.js"
import { issueSession } from "../session.js"
import { normalizedEmail, validRegistrationProfile } from "../validation.js"
import { completionEmail } from "./policy.js"

export class SocialError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export type Onboarding = { fullName?: unknown; contactNumber?: unknown }

export async function finishSocial(
  tx: Prisma.TransactionClient,
  pending: SocialCompletion,
  profile: Onboarding,
  sessionId?: string,
) {
  const identity = await tx.socialIdentity.findUnique({
    where: {
      provider_subject: {
        provider: pending.provider,
        subject: pending.subject,
      },
    },
    include: { user: true },
  })
  if (pending.purpose !== "signin") {
    if (!sessionId || pending.sessionId !== sessionId || !pending.userId)
      throw new SocialError(401, "Sign in again to connect an account")
    const session = await tx.session.findUnique({ where: { id: sessionId } })
    if (
      !session ||
      session.expiresAt <= new Date() ||
      session.userId !== pending.userId
    )
      throw new SocialError(401, "Sign in again to connect an account")
    if (pending.purpose === "reauth") {
      if (identity?.userId !== pending.userId)
        throw new SocialError(
          403,
          "Use a provider already connected to your account",
        )
      await tx.socialCompletion.delete({ where: { id: pending.id } })
      await tx.session.update({
        where: { id: sessionId },
        data: { reauthenticatedAt: new Date() },
      })
      return { reauthenticated: true as const }
    }
    if (identity && identity.userId !== pending.userId)
      throw new SocialError(
        409,
        "This provider is already connected to another account",
      )
    await tx.socialCompletion.delete({ where: { id: pending.id } })
    if (!identity)
      await tx.socialIdentity.create({
        data: {
          userId: pending.userId,
          provider: pending.provider,
          subject: pending.subject,
          email: pending.email,
        },
      })
    return { linked: true as const }
  }
  if (identity) {
    await tx.socialCompletion.delete({ where: { id: pending.id } })
    return issueSession(identity.user, tx)
  }
  const email = completionEmail(pending)
  if (email && (await tx.user.findUnique({ where: { email } })))
    throw new SocialError(
      409,
      "Sign in to your existing account and connect this provider in account settings",
    )
  if (
    !email ||
    !validRegistrationProfile(profile.fullName, profile.contactNumber)
  ) {
    return {
      onboarding: true as const,
      emailRequired: !email,
      email: email ?? undefined,
      fullName: pending.fullName ?? undefined,
    }
  }
  // Deleting inside the transaction serializes competing exchanges; rollback restores it on failure.
  await tx.socialCompletion.delete({ where: { id: pending.id } })
  const user = await tx.user.create({
    data: {
      email,
      fullName: (profile.fullName as string).trim(),
      contactNumber: (profile.contactNumber as string).trim(),
      passwordHash: null,
      role: "USER",
    },
  })
  await tx.socialIdentity.create({
    data: {
      userId: user.id,
      provider: pending.provider,
      subject: pending.subject,
      email: normalizedEmail(pending.email),
    },
  })
  return issueSession(user, tx)
}
