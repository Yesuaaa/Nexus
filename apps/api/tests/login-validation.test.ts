import assert from "node:assert/strict"
import { test } from "node:test"

import { hashPassword } from "../src/features/auth/auth.password.js"
import { startPgliteApp } from "./support/pglite-app.js"

test(
  "Login input boundaries and tampered requests are safe",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const base = `${origin}/api/auth`
    const password = "  密碼🔒'<>  "
    const post = (path: string, body: unknown, token?: string) =>
      fetch(`${base}/${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })
    const email = "login+tag@example.org"
    await prisma.user.create({
      data: { email, passwordHash: await hashPassword(password), role: "USER" },
    })
    await t.test(
      "rejects missing, null, non-string, malformed, and oversized credentials",
      async () => {
        const invalid = [undefined, null, false, 0, -1, 1.5, 1e300, [], {}, ""]
        for (const field of ["email", "password"] as const) {
          for (const value of invalid) {
            const response = await post("login", {
              email,
              password,
              [field]: value,
            })
            assert.equal(
              response.status,
              400,
              `${field}: ${JSON.stringify(value)}`,
            )
          }
        }
        for (const value of [
          " ",
          "no-at",
          "a@@b.com",
          "a b@example.com",
          `${"a".repeat(243)}@example.com`,
        ])
          assert.equal(
            (await post("login", { email: value, password })).status,
            400,
          )
        for (const value of ["x".repeat(1025), "🔒".repeat(257)])
          assert.equal(
            (await post("login", { email, password: value })).status,
            400,
          )
        assert.equal(await prisma.session.count(), 0)
      },
    )
    await t.test(
      "preserves exact passwords and ignores privilege, redirect, and header tampering",
      async () => {
        const response = await post(
          "login?role=SUPERADMIN&next=https://example.org",
          {
            email: `  ${email.toUpperCase()}  `,
            password,
            role: "SUPERADMIN",
            isActive: true,
            ip: "8.8.8.8",
            userAgent: "forged",
            token: "forged",
          },
          "forged",
        )
        assert.equal(response.status, 200)
        const body = (await response.json()) as { user: { role: string } }
        assert.equal(body.user.role, "USER")
        assert.equal(response.headers.get("cache-control"), "no-store")
        assert.equal(response.headers.has("set-cookie"), false)
        for (const value of [
          password.trim(),
          "   ",
          "' OR 1=1 --",
          "<script>alert(1)</script>",
        ])
          assert.equal(
            (await post("login", { email, password: value })).status,
            401,
          )
      },
    )
    await t.test(
      "accepts exact email and UTF-8 password boundaries",
      async () => {
        for (const value of [
          "x".repeat(1024),
          "🔒".repeat(256),
          " ".repeat(12),
        ]) {
          await prisma.user.update({
            where: { email },
            data: { passwordHash: await hashPassword(value) },
          })
          assert.equal(
            (await post("login", { email, password: value })).status,
            200,
          )
        }
        const boundaryEmail = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(58)}.ph`
        assert.equal(boundaryEmail.length, 254)
        await prisma.user.create({
          data: {
            email: boundaryEmail,
            passwordHash: await hashPassword(password),
            role: "USER",
          },
        })
        assert.equal(
          (await post("login", { email: boundaryEmail, password })).status,
          200,
        )
      },
    )
    await t.test(
      "rejects malformed JSON, unsupported body formats, and oversized requests",
      async () => {
        for (const body of ["{", "null", "0", '"string"']) {
          const response = await fetch(`${base}/login`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
          })
          assert.equal(response.status, 400)
        }
        for (const body of [[], {}, [{ email, password }]])
          assert.equal((await post("login", body)).status, 400)
        for (const contentType of [
          "text/plain",
          "application/x-www-form-urlencoded",
          "multipart/form-data; boundary=test",
        ]) {
          const response = await fetch(`${base}/login`, {
            method: "POST",
            headers: { "content-type": contentType },
            body: JSON.stringify({ email, password }),
          })
          assert.equal(response.status, 400)
        }
        assert.equal(
          (await post("login", { email, password: "x".repeat(17_000) })).status,
          413,
        )
      },
    )
    await t.test(
      "rapid requests are limited even with spoofed forwarding headers",
      async () => {
        const responses = await Promise.all(
          Array.from({ length: 65 }, (_, index) =>
            fetch(`${base}/login`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-forwarded-for": `192.0.2.${index + 1}`,
              },
              body: JSON.stringify({
                email: `missing${index}@example.com`,
                password,
              }),
            }),
          ),
        )
        assert.ok(
          responses.every((response) => [401, 429].includes(response.status)),
        )
        const limited = responses.filter((response) => response.status === 429)
        assert.ok(limited.length > 0)
        assert.ok(
          limited.every(
            (response) => Number(response.headers.get("retry-after")) > 0,
          ),
        )
      },
    )
  },
)
