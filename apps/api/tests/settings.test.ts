import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../src/features/auth/auth.service.js"
import { hashPassword } from "../src/features/auth/auth.password.js"
import { startPgliteApp } from "./support/pglite-app.js"

test(
  "settings validate preferences and isolate and revoke sessions",
  { timeout: 90000 },
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const base = `${origin}/api/auth`
    const request = (
      token: string,
      path: string,
      method = "GET",
      body?: unknown,
    ) =>
      fetch(`${base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    const password = "Profile-password-123!"
    const passwordHash = await hashPassword(password)
    const actors = []
    for (const role of ["USER", "STAFF", "ADMIN", "SUPERADMIN"] as const) {
      const user = await prisma.user.create({
        data: {
          role,
          fullName: `${role} Profile`,
          email: `${role.toLowerCase()}@profile.example`,
          passwordHash,
        },
      })
      actors.push({ user, token: (await issueSession(user)).token })
    }

    const actor = actors[0]!
    const other = actors[1]!
    const first = await request(actor.token, "/settings")
    assert.equal(first.status, 200)
    const initial = (await first.json()) as {
      preferences: Record<string, unknown>
      sessions: { id: string; current: boolean }[]
    }
    assert.equal(initial.sessions.length, 1)
    assert.equal(initial.sessions[0]!.current, true)
    const prefs = {
      timeZone: "Asia/Tokyo",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "24h",
      workflowNotifications: false,
    }
    assert.equal(
      (await request(actor.token, "/settings", "PATCH", prefs)).status,
      200,
    )
    const saved = (await (await request(actor.token, "/settings")).json()) as {
      preferences: unknown
    }
    assert.deepEqual(saved.preferences, prefs)
    for (const invalid of [
      { ...prefs, timeZone: "invalid" },
      { ...prefs, dateFormat: "bad" },
      { ...prefs, dateFormat: ["YYYY-MM-DD"] },
      { ...prefs, timeFormat: ["24h"] },
      { ...prefs, constructor: "bad" },
      { ...prefs, toString: "bad" },
      { ...prefs, workflowNotifications: "false" },
      { ...prefs, role: "ADMIN" },
      {},
      [],
    ])
      assert.equal(
        (await request(actor.token, "/settings", "PATCH", invalid)).status,
        400,
      )
    const foreign = (await (
      await request(other.token, "/settings")
    ).json()) as {
      sessions: { id: string }[]
      preferences: { workflowNotifications: boolean }
    }
    assert.equal(foreign.preferences.workflowNotifications, true)
    assert.equal(
      (
        await request(
          actor.token,
          "/sessions/" + foreign.sessions[0]!.id,
          "DELETE",
        )
      ).status,
      404,
    )
    const second = await issueSession(
      actor.user,
      "Mozilla/5.0 (Windows NT 10.0) Chrome/140.0",
    )
    const secondList = (await (
      await request(second.token, "/settings")
    ).json()) as {
      sessions: { id: string; current: boolean; device: string }[]
    }
    const current = secondList.sessions.find((row) => row.current)!
    await prisma.session.update({
      where: { id: current.id },
      data: { approximateLocation: "Quezon City, Philippines" },
    })
    const located = (await (
      await request(second.token, "/settings")
    ).json()) as { sessions: { id: string; location: string | null }[] }
    assert.equal(
      located.sessions.find((row) => row.id === current.id)!.location,
      "Quezon City, Philippines",
    )

    assert.equal(current.device, "Windows · Chrome")
    assert.equal(
      (await request(actor.token, "/sessions/" + current.id, "DELETE")).status,
      204,
    )
    assert.equal((await request(second.token, "/settings")).status, 401)
    assert.equal(
      (
        await request(actor.token, "/refresh", "POST", {
          refreshToken: second.refreshToken,
        })
      ).status,
      401,
    )
    assert.equal((await request(actor.token, "/settings")).status, 200)
    const third = await issueSession(actor.user)
    assert.equal(
      (await request(actor.token, "/sessions/revoke-others", "POST")).status,
      204,
    )
    assert.equal((await request(third.token, "/settings")).status, 401)
    assert.equal((await request(actor.token, "/settings")).status, 200)
    const fourth = await issueSession(actor.user)
    assert.equal(
      (await request(actor.token, "/sessions/revoke-all", "POST")).status,
      204,
    )
    for (const session of [actor, fourth])
      assert.equal((await request(session.token, "/settings")).status, 401)
    assert.equal(
      (
        await request(fourth.token, "/refresh", "POST", {
          refreshToken: fourth.refreshToken,
        })
      ).status,
      401,
    )
    assert.equal((await request(other.token, "/settings")).status, 200)
  },
)
