import assert from "node:assert/strict"
import { test } from "node:test"
import { Role } from "../../../src/generated/prisma/client.js"
import {
  hashPassword,
  verifyPassword,
} from "../../../src/features/auth/auth.password.js"
import { usersRepository } from "../../../src/features/users/users.repository.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "only Superadmins can change other account passwords and revoke their sessions",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, db: database, origin } = await startPgliteApp(t)
    const base = `${origin}/api`
    const initialPassword = "OriginalPassword123!"
    const initialHash = await hashPassword(initialPassword)
    const tokens = new Map<string, string>()
    const refreshTokens = new Map<string, string>()
    for (const [id, role] of [
      ["superadmin", Role.SUPERADMIN],
      ["admin", Role.ADMIN],
      ["staff", Role.STAFF],
      ["user", Role.USER],
      ["target", Role.USER],
      ["inactive", Role.STAFF],
      ["peer", Role.SUPERADMIN],
      ["trashed", Role.USER],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          id,
          email: `${id}@example.com`,
          fullName: `${id} Person`,
          passwordHash: initialHash,
          role,
          isActive: id !== "inactive" && id !== "trashed",
          accountDeletedAt: id === "trashed" ? new Date() : null,
        },
      })
      const session = await issueSession(user)
      tokens.set(id, session.token)
      refreshTokens.set(id, session.refreshToken)
    }
    const secondTargetSession = await issueSession(
      await prisma.user.findUniqueOrThrow({ where: { id: "target" } }),
    )
    const newPassword = " NewTargetPassword123! "
    async function change(
      actor: string | null,
      target: string,
      body: unknown = { newPassword },
    ) {
      return fetch(`${base}/users/${target}/password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(actor ? { Authorization: `Bearer ${tokens.get(actor)}` } : {}),
        },
        body: JSON.stringify(body),
      })
    }
    assert.equal((await change(null, "target")).status, 401)
    for (const role of ["admin", "staff", "user"]) {
      assert.equal((await change(role, "target")).status, 403)
      assert.equal((await change(role, "superadmin")).status, 403)
    }
    assert.equal((await change("inactive", "target")).status, 401)
    assert.equal((await change("superadmin", "superadmin")).status, 403)
    assert.equal((await change("superadmin", "missing")).status, 404)
    assert.equal((await change("superadmin", "trashed")).status, 404)
    for (const invalid of [
      null,
      [],
      {},
      { newPassword: 123 },
      { newPassword: "short" },
      { newPassword: "lowercasepassword123!" },
      { newPassword: "UPPERCASEPASSWORD123!" },
      { newPassword: "NoDigitsPassword!" },
      { newPassword: "NoSpecialPassword123" },
      { newPassword: `Valid123!${"界".repeat(342)}` },
    ]) {
      assert.equal((await change("superadmin", "target", invalid)).status, 400)
    }
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: "target" } }))
        .passwordHash,
      initialHash,
    )
    assert.equal(await prisma.session.count({ where: { userId: "target" } }), 2)
    // A failed session revocation must also roll back the credential update.
    await database.exec(`
      CREATE FUNCTION reject_session_deletion() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'Simulated revocation failure'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER reject_session_deletion BEFORE DELETE ON "Session"
      FOR EACH ROW EXECUTE FUNCTION reject_session_deletion();
    `)
    await assert.rejects(
      usersRepository.changePasswordAndRevokeSessions(
        "target",
        initialHash,
        await hashPassword(newPassword),
      ),
    )
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: "target" } }))
        .passwordHash,
      initialHash,
    )
    assert.equal(await prisma.session.count({ where: { userId: "target" } }), 2)
    await database.exec(
      'DROP TRIGGER reject_session_deletion ON "Session"; DROP FUNCTION reject_session_deletion();',
    )
    const response = await change("superadmin", "target", {
      newPassword,
      userId: "superadmin",
      role: "SUPERADMIN",
      isActive: false,
    })
    assert.equal(response.status, 204)
    assert.equal(await response.text(), "")
    const target = await prisma.user.findUniqueOrThrow({
      where: { id: "target" },
    })
    assert.notEqual(target.passwordHash, initialHash)
    assert.notEqual(target.passwordHash, newPassword)
    assert.equal(await verifyPassword(newPassword, target.passwordHash), true)
    assert.equal(
      await verifyPassword(initialPassword, target.passwordHash),
      false,
    )
    assert.equal(target.role, Role.USER)
    assert.equal(target.isActive, true)
    assert.equal(await prisma.session.count({ where: { userId: "target" } }), 0)
    assert.equal(
      await prisma.session.count({ where: { userId: "superadmin" } }),
      1,
    )
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: "superadmin" } }))
        .passwordHash,
      initialHash,
    )
    for (const [token, refreshToken] of [
      [tokens.get("target"), refreshTokens.get("target")],
      [secondTargetSession.token, secondTargetSession.refreshToken],
    ]) {
      const me = await fetch(`${base}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      assert.equal(me.status, 401)
      const refresh = await fetch(`${base}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      })
      assert.equal(refresh.status, 401)
    }
    assert.equal(
      (
        await fetch(`${base}/auth/me`, {
          headers: { Authorization: `Bearer ${tokens.get("superadmin")}` },
        })
      ).status,
      200,
    )
    const login = (password: string) =>
      fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "target@example.com", password }),
      })
    assert.equal((await login(initialPassword)).status, 401)
    assert.equal((await login(newPassword)).status, 200)
    assert.equal((await change("superadmin", "inactive")).status, 204)
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: "inactive" } }))
        .isActive,
      false,
    )
    assert.equal(
      await prisma.session.count({ where: { userId: "inactive" } }),
      0,
    )
    assert.equal((await change("superadmin", "peer")).status, 204)
    assert.equal(await prisma.session.count({ where: { userId: "peer" } }), 0)
  },
)
