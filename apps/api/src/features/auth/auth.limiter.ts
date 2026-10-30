import type { RequestHandler } from "express"

// This limits repeated guesses in a single API process. Use a shared limiter for multiple replicas.
const loginAttempts = new Map<string, { count: number; until: number }>()

export function loginAllowed(key: string): boolean {
  const attempt = loginAttempts.get(key)
  if (!attempt || attempt.until < Date.now()) {
    loginAttempts.delete(key)
    return true
  }
  return attempt.count < 10
}

export function recordFailure(key: string) {
  const now = Date.now()
  const attempt = loginAttempts.get(key)
  if (loginAttempts.size >= 10000) {
    for (const [key, value] of loginAttempts) {
      if (value.until < now) loginAttempts.delete(key)
    }
    if (loginAttempts.size >= 10000) {
      const oldest = loginAttempts.keys().next().value
      if (oldest) loginAttempts.delete(oldest)
    }
  }
  loginAttempts.set(key, {
    count: attempt && attempt.until >= now ? attempt.count + 1 : 1,
    until:
      attempt && attempt.until >= now ? attempt.until : now + 15 * 60 * 1000,
  })
}

export function clearFailures(key: string) {
  loginAttempts.delete(key)
}

export function authRateLimit(limit: number): RequestHandler {
  const attempts = new Map<string, { count: number; until: number }>()
  return (request, response, next) => {
    const now = Date.now()
    const key = request.ip ?? "unknown"
    let entry = attempts.get(key)
    if (!entry || entry.until <= now) {
      for (const [address, value] of attempts)
        if (value.until <= now) attempts.delete(address)
      // Reject new sources at capacity rather than evicting a blocked source.
      if (!attempts.has(key) && attempts.size >= 10_000) {
        response.setHeader("Retry-After", "60")
        response
          .status(429)
          .json({ error: "Too many requests. Try again later" })
        return
      }
      entry = { count: 0, until: now + 60_000 }
      attempts.set(key, entry)
    }
    entry.count += 1
    if (entry.count > limit) {
      response.setHeader(
        "Retry-After",
        String(Math.ceil((entry.until - now) / 1000)),
      )
      response.status(429).json({ error: "Too many requests. Try again later" })
      return
    }
    next()
  }
}
