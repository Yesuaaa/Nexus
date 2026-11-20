import assert from "node:assert/strict"
import { test } from "node:test"
import { safeLog, sanitizeLogValue } from "../src/shared/safe-logger.js"

const secrets = {
  bearer: "Bearer access-token-sentinel",
  refresh: "refresh-token-sentinel",
  password: "password-sentinel",
  file: "private-file-sentinel",
  dataUrl: "data:image/png;base64,cHJpdmF0ZS1pbWFnZQ==",
}

test("safe logs redact authentication secrets and private payloads", () => {
  const sanitized = JSON.stringify(
    sanitizeLogValue({
      authorization: secrets.bearer,
      refreshToken: secrets.refresh,
      password: secrets.password,
      body: { message: "private client message" },
      fileContent: secrets.file,
      dataUrl: secrets.dataUrl,
      nested: {
        cookie: "session=private-cookie",
        safeId: "request-safe-id",
      },
    }),
  )

  for (const value of Object.values(secrets))
    assert.equal(sanitized.includes(value), false)
  assert.equal(sanitized.includes("private client message"), false)
  assert.match(sanitized, /request-safe-id/)
  assert.match(sanitized, /\[REDACTED\]/)
})

test("safe logs retain correlation metadata without serializing error messages", () => {
  const lines: string[] = []
  const original = console.error
  console.error = (...values: unknown[]) => lines.push(values.join(" "))
  try {
    const error = new Error(
      `provider failed with ${secrets.bearer} and ${secrets.file}`,
    )
    Object.assign(error, { code: "PROVIDER_UNAVAILABLE" })
    safeLog(
      "error",
      "storage.upload_failed",
      {
        requestId: "request-safe-id",
        privatePayload: secrets.file,
        password: secrets.password,
      },
      error,
    )
  } finally {
    console.error = original
  }

  assert.equal(lines.length, 1)
  assert.match(lines[0]!, /storage\.upload_failed/)
  assert.match(lines[0]!, /request-safe-id/)
  assert.match(lines[0]!, /PROVIDER_UNAVAILABLE/)
  for (const value of Object.values(secrets))
    assert.equal(lines[0]!.includes(value), false)
})
