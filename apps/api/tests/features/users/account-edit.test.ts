import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "account edits enforce authority, validation and atomic role/profile history",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const tokens = new Map<string, string>()
    for (const [id, role] of [
      ["root", "SUPERADMIN"],
      ["admin", "ADMIN"],
      ["staff", "STAFF"],
      ["client", "USER"],
      ["target", "USER"],
      ["head", "STAFF"],
    ] as const) {
      const user = await prisma.user.create({
        data: {
          id,
          role,
          fullName: "Original Name",
          email: `${id}@example.test`,
          passwordHash: "private",
        },
      })
      tokens.set(id, (await issueSession(user)).token)
    }
    const details = {
      fullName: "Updated Name",
      email: "updated@example.test",
      contactNumber: "+63 9123456789",
      role: "ADMIN",
    }
    const edit = (id: string, body: unknown, actor: string | null = "root") =>
      fetch(`${base}/users/${id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(actor ? { authorization: `Bearer ${tokens.get(actor)}` } : {}),
        },
        body: JSON.stringify(body),
      })
    for (const actor of ["admin", "staff", "client", null])
      assert.equal(
        (await edit("target", details, actor)).status,
        actor ? 403 : 401,
      )
    assert.equal((await edit("target", details)).status, 200)
    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: "target" },
    })
    assert.equal(updated.fullName, details.fullName)
    assert.equal(updated.email, details.email)
    assert.equal(updated.role, "ADMIN")
    const history = await prisma.accountManagementChange.findMany({
      where: { subjectAccountId: "target" },
    })
    assert.equal(history.length, 2)
    assert.equal(new Set(history.map((row) => row.operationId)).size, 1)
    assert.ok(history.every((row) => row.actorAccountId === "root"))
    const profile = history.find((row) => row.action === "PROFILE_UPDATED")!
    assert.deepEqual([...profile.changedFields].sort(), [
      "contactNumber",
      "email",
      "fullName",
    ])
    assert.deepEqual(profile.changes, {})
    assert.equal(
      (await edit("root", { ...details, role: "STAFF" })).status,
      403,
    )
    assert.equal(
      (
        await edit("root", {
          ...details,
          email: "root@example.test",
          role: "SUPERADMIN",
        })
      ).status,
      200,
    )
    for (const body of [
      { ...details, email: "invalid" },
      { ...details, fullName: " " },
      { ...details, contactNumber: "bad" },
      { ...details, role: "UNKNOWN" },
      { ...details, isActive: false },
      [],
    ])
      assert.equal((await edit("target", body)).status, 400)
    await prisma.department.create({ data: { name: "Design", headId: "head" } })
    assert.equal(
      (await edit("head", { ...details, email: "head-new@example.test" }))
        .status,
      409,
    )
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: "head" } })).fullName,
      "Original Name",
    )
    assert.equal(
      await prisma.accountManagementChange.count({
        where: { subjectAccountId: "head" },
      }),
      0,
    )
    assert.equal(
      (await edit("target", { ...details, email: "staff@example.test" }))
        .status,
      409,
    )
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: "target" } })).email,
      details.email,
    )
    await prisma.user.update({
      where: { id: "client" },
      data: { accountDeletedAt: new Date(), isActive: false },
    })
    assert.equal((await edit("client", details)).status, 404)
    assert.equal((await edit("missing", details)).status, 404)
  },
)
