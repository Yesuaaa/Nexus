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
