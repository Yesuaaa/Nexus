type LogLevel = "info" | "warn" | "error"

const redacted = "[REDACTED]"
const sensitiveKey =
  /(?:authorization|cookie|password|secret|credential|(?:^|_)(?:access|refresh)?token(?:$|_)|tokenhash|dataurl|filedata|filecontent|privatepayload)/i
const privateContainerKey = /^(?:body|payload|content|bytes|data)$/i

function redactString(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/data:[^;,\s]+;base64,[A-Za-z0-9+/=]+/gi, "data:[REDACTED]")
    .replace(
      /(["']?(?:accessToken|refreshToken|password|currentPassword|newPassword)["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi,
      `$1${redacted}`,
    )
    .slice(0, 1000)
}

/** Converts arbitrary diagnostics into bounded JSON-safe values. */
export function sanitizeLogValue(
  value: unknown,
  key = "",
  seen = new WeakSet<object>(),
): unknown {
  if (sensitiveKey.test(key) || privateContainerKey.test(key)) return redacted
  if (value === null || value === undefined) return value ?? null
  if (typeof value === "string") return redactString(value)
  if (typeof value === "number" || typeof value === "boolean") return value
  if (typeof value === "bigint") return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) {
    const code =
      "code" in value &&
      (typeof value.code === "string" || typeof value.code === "number")
        ? value.code
        : undefined
    return { name: value.name, ...(code === undefined ? {} : { code }) }
  }
  if (typeof value !== "object") return String(value).slice(0, 1000)
  if (seen.has(value)) return "[Circular]"
  seen.add(value)
  if (Array.isArray(value))
    return value.slice(0, 50).map((item) => sanitizeLogValue(item, "", seen))

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 50)
      .map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeLogValue(entryValue, entryKey, seen),
      ]),
  )
}

export function safeLog(
  level: LogLevel,
  event: string,
  metadata: Record<string, unknown> = {},
  error?: unknown,
) {
  const entry = sanitizeLogValue({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...metadata,
    ...(error === undefined ? {} : { error }),
  })
  const line = JSON.stringify(entry)
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.info(line)
}
