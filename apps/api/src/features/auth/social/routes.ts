import { randomBytes, randomInt } from "node:crypto"
import { Router, urlencoded, type Request } from "express"
import type { SocialCompletion } from "../../../generated/prisma/client.js"
import { getPrisma } from "../../../lib/db.js"
import { verifyPassword } from "../password.js"
import { loginAllowed, recordFailure } from "../login-limiter.js"
import { normalizedEmail } from "../validation.js"
import { authorizationUrl, verifyCallback } from "./providers.js"
import {
  digest,
  isProvider,
  proofMatches,
  providers,
  socialConfig,
  completionEmail,
} from "./policy.js"
import { finishSocial, SocialError } from "./completion.js"
import { sendEmailCode } from "./email.js"

export const socialRouter = Router()
const lifetime = 10 * 60 * 1000
const secret = () => randomBytes(32).toString("base64url")
const expiry = () => new Date(Date.now() + lifetime)

function database() {
  const prisma = getPrisma()
  if (!prisma) throw new SocialError(503, "Database unavailable")
  return prisma
}

async function currentSession(request: Request) {
  const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(
    request.header("authorization") ?? "",
  )?.[1]
  if (!token) throw new SocialError(401, "Sign in again to connect an account")
  const session = await database().session.findUnique({
    where: { tokenHash: digest(token) },
    include: { user: true },
  })
  if (!session || session.expiresAt <= new Date())
    throw new SocialError(401, "Sign in again to connect an account")
  return session
}

function throttle(request: Request, operation: string) {
  const key = `social:${operation}:${request.ip ?? "unknown"}`
  const limit = operation === "email" ? 10 : operation === "start" ? 60 : 120
  if (!loginAllowed(key, limit))
    throw new SocialError(429, "Too many attempts. Try again later")
  recordFailure(key, 60 * 1000)
}

async function pendingCompletion(request: Request): Promise<SocialCompletion> {
  const code = request.body?.code
  if (typeof code !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(code))
    throw new SocialError(400, "Invalid sign-in attempt")
  const pending = await database().socialCompletion.findUnique({
    where: { id: digest(code) },
  })
  if (
    !pending ||
    pending.expiresAt <= new Date() ||
    !proofMatches(request.body?.verifier, pending.verifierHash)
  )
    throw new SocialError(
      400,
      "Sign-in attempt expired or invalid. Please try again",
    )
  return pending
}

socialRouter.get("/providers", (_request, response) => {
  response.json({
    providers: Object.fromEntries(
      providers.map((provider) => [provider, Boolean(socialConfig(provider))]),
    ),
  })
})

socialRouter.get("/connections", async (request, response) => {
  const session = await currentSession(request)
  const identities = await database().socialIdentity.findMany({
    where: { userId: session.userId },
    select: { provider: true },
  })
  response.json({
    providers: identities.map((identity) => identity.provider),
    hasPassword: Boolean(session.user.passwordHash),
  })
})

socialRouter.post("/:provider/start", async (request, response) => {
  const provider = request.params.provider
  if (!isProvider(provider))
    throw new SocialError(400, "Unknown sign-in provider")
  const config = socialConfig(provider)
  if (!config)
    throw new SocialError(503, "This sign-in provider is unavailable")
  throttle(request, "start")
  const verifierHash = request.body?.verifierHash
  if (typeof verifierHash !== "string" || !/^[a-f0-9]{64}$/.test(verifierHash))
    throw new SocialError(400, "Invalid browser proof")
  const purpose = request.body?.purpose ?? "signin"
  if (!["signin", "link", "reauth"].includes(purpose))
    throw new SocialError(400, "Invalid sign-in purpose")
  let userId: string | undefined
  let sessionId: string | undefined
  if (purpose !== "signin") {
    const session = await currentSession(request)
    userId = session.userId
    sessionId = session.id
    if (purpose === "link") {
      const passwordKey = `social:link-password:${session.id}`
      if (!loginAllowed(passwordKey))
        throw new SocialError(
          429,
          "Too many password attempts. Try again later",
        )
      const password = request.body?.currentPassword
      const recent =
        session.reauthenticatedAt &&
        session.reauthenticatedAt.getTime() > Date.now() - 5 * 60 * 1000
      if (
        !recent &&
        !(
          typeof password === "string" &&
          Buffer.byteLength(password) <= 1024 &&
          (await verifyPassword(password, session.user.passwordHash))
        )
      ) {
        recordFailure(passwordKey)
        throw new SocialError(
          401,
          "Confirm your current password or sign in again with a connected provider",
        )
      }
    }
  }
  const state = secret(),
    nonce = secret(),
    codeVerifier = secret()
  const url = await authorizationUrl(config, state, nonce, codeVerifier)
  await database().oAuthAttempt.create({
    data: {
      id: digest(state),
      provider,
      purpose,
      verifierHash,
      nonce,
      codeVerifier,
      userId,
      sessionId,
      expiresAt: expiry(),
    },
  })
  response.json({ url })
})

socialRouter.all(
  "/:provider/callback",
  urlencoded({ extended: false, limit: "16kb" }),
  async (request, response) => {
    const provider = request.params.provider
    if (!isProvider(provider))
      return response.status(400).send("Unknown sign-in provider")
    const config = socialConfig(provider)
    if (!config)
      return response.status(503).send("This sign-in provider is unavailable")
    const destination = new URL(
      "/auth/social/complete",
      process.env.WEB_ORIGIN!,
    )
    response.setHeader("Referrer-Policy", "no-referrer")
    try {
      if (
        (provider === "apple" && request.method !== "POST") ||
        (provider !== "apple" && request.method !== "GET")
      )
        throw new SocialError(400, "Invalid callback method")
      throttle(request, "callback")
      const input = request.method === "POST" ? request.body : request.query
      if (
        typeof input?.state !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/.test(input.state)
      )
        throw new SocialError(400, "Invalid state")
      const prisma = database()
      const attempt = await prisma.oAuthAttempt.findUnique({
        where: { id: digest(input.state) },
      })
      if (
        !attempt ||
        attempt.provider !== provider ||
        attempt.expiresAt <= new Date()
      )
        throw new SocialError(400, "Invalid state")
      const consumed = await prisma.oAuthAttempt.deleteMany({
        where: { id: attempt.id },
      })
      if (consumed.count !== 1) throw new SocialError(400, "Reused state")
      if (input.error) {
        destination.hash = "error=cancelled"
        return response.redirect(303, destination.toString())
      }
      if (
        typeof input.code !== "string" ||
        !input.code ||
        input.code.length > 8192
      )
        throw new SocialError(400, "Invalid authorization response")
      const identity = await verifyCallback(config, {
        code: input.code,
        nonce: attempt.nonce,
        codeVerifier: attempt.codeVerifier,
        user: input.user,
      })
      const code = secret()
      await prisma.socialCompletion.create({
        data: {
          id: digest(code),
          provider,
          subject: identity.subject,
          email: normalizedEmail(identity.email),
          emailVerified: identity.emailVerified,
          fullName: identity.fullName?.slice(0, 100),
          verifierHash: attempt.verifierHash,
          purpose: attempt.purpose,
          userId: attempt.userId,
          sessionId: attempt.sessionId,
          expiresAt: expiry(),
        },
      })
      destination.hash = `code=${code}`
    } catch {
      // Provider errors can include credentials or tokens. Never log the raw response.
      destination.hash = "error=failed"
    }
    response.redirect(303, destination.toString())
  },
)

socialRouter.post("/email", async (request, response) => {
  throttle(request, "email")
  const pending = await pendingCompletion(request)
  if (pending.purpose !== "signin" || completionEmail(pending))
    throw new SocialError(400, "Email verification is not required")
  const email = normalizedEmail(request.body?.email)
  if (!email) throw new SocialError(400, "Provide a valid email")
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    throw new SocialError(503, "Email verification is unavailable")
  const now = new Date()
  const code = String(randomInt(10000000, 100000000))
  const updated = await database().socialCompletion.updateMany({
    where: {
      id: pending.id,
      expiresAt: { gt: now },
      OR: [
        { emailSentAt: null },
        { emailSentAt: { lt: new Date(Date.now() - 60000) } },
      ],
    },
    data: {
      email,
      emailVerified: false,
      emailCodeHash: digest(`${request.body.verifier}:${email}:${code}`),
      emailCodeExpiresAt: expiry(),
      emailCodeAttempts: 0,
      emailSentAt: now,
    },
  })
  if (updated.count !== 1)
    throw new SocialError(429, "Wait a minute before requesting another code")
  try {
    await sendEmailCode(email, code)
  } catch {
    throw new SocialError(
      503,
      "Email verification is unavailable. Try again in a minute",
    )
  }
  response.json({ sent: true })
})

socialRouter.post("/complete", async (request, response) => {
  const code = request.body?.code
  if (
    typeof code !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(code) ||
    typeof request.body?.verifier !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(request.body.verifier)
  )
    throw new SocialError(400, "Invalid sign-in attempt")
  throttle(request, "complete")
  const pending = await pendingCompletion(request)
  const sessionId =
    pending.purpose === "signin"
      ? undefined
      : (await currentSession(request)).id
  const emailCode = request.body?.emailCode
  if (!completionEmail(pending) && typeof emailCode === "string") {
    const tries = await database().socialCompletion.updateMany({
      where: {
        id: pending.id,
        emailCodeAttempts: { lt: 5 },
        emailCodeExpiresAt: { gt: new Date() },
        emailVerified: false,
      },
      data: { emailCodeAttempts: { increment: 1 } },
    })
    if (
      tries.count !== 1 ||
      !pending.email ||
      digest(`${request.body.verifier}:${pending.email}:${emailCode}`) !==
        pending.emailCodeHash
    )
      throw new SocialError(400, "Invalid or expired email code")
    const verified = await database().socialCompletion.updateMany({
      where: {
        id: pending.id,
        email: pending.email,
        emailCodeHash: pending.emailCodeHash,
      },
      data: { emailVerified: true, emailCodeHash: null },
    })
    if (verified.count !== 1)
      throw new SocialError(400, "Email code changed. Try again")
  }
  try {
    const result = await database().$transaction(async (tx) => {
      const current = await tx.socialCompletion.findUnique({
        where: { id: pending.id },
      })
      if (
        !current ||
        current.expiresAt <= new Date() ||
        !proofMatches(request.body.verifier, current.verifierHash)
      )
        throw new SocialError(400, "Sign-in attempt expired or already used")
      return finishSocial(
        tx,
        current,
        {
          fullName: request.body.fullName,
          contactNumber: request.body.contactNumber,
        },
        sessionId,
      )
    })
    response.json(result)
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "P2002" ||
        error.code === "P2025" ||
        error.code === "P2034")
    )
      throw new SocialError(
        409,
        "Account connection changed. Sign in to your existing account and try again",
      )
    throw error
  }
})

socialRouter.use(((error, _request, response, next) => {
  if (error instanceof SocialError)
    response.status(error.status).json({ error: error.message })
  else next(error)
}) as import("express").ErrorRequestHandler)
