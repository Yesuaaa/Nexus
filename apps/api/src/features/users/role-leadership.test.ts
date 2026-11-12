import assert from "node:assert/strict"
import { test } from "node:test"
import { Role } from "../../generated/prisma/client.js"
import { issueSession } from "../auth/auth.service.js"
import { startPgliteApp } from "../../test/pglite-app.js"

test(
  "role changes cannot strand department heads or team leads outside STAFF",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const base = `${origin}/api`

    for (const [id, role] of [
      ["actor", Role.SUPERADMIN],
      ["head", Role.STAFF],
      ["lead", Role.STAFF],
      ["member", Role.STAFF],
    ] as const)
      await prisma.user.create({
        data: {
          id,
          role,
          email: `${id}@example.com`,
          fullName: `${id} Person`,
          passwordHash: "private-hash",
        },
      })
    const department = await prisma.department.create({
      data: { name: "Design", headId: "head" },
    })
    await prisma.team.create({
      data: { name: "Creative", departmentId: department.id, leadId: "lead" },
    })
    const session = await issueSession(
      await prisma.user.findUniqueOrThrow({ where: { id: "actor" } }),
    )
    const changeRole = (id: string, role: Role) =>
      fetch(`${base}/users/${id}/role`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${session.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ role }),
      })
    const roleOf = async (id: string) =>
      (await prisma.user.findUniqueOrThrow({ where: { id } })).role

    await t.test("department heads keep STAFF until reassigned", async () => {
      for (const role of [Role.USER, Role.ADMIN, Role.SUPERADMIN]) {
        const response = await changeRole("head", role)
        assert.equal(response.status, 409)
        assert.deepEqual(await response.json(), {
          error:
            "Reassign the Design head role before changing this account's role",
        })
        assert.equal(await roleOf("head"), Role.STAFF)
      }
      assert.equal(
        (
          await prisma.department.findUniqueOrThrow({
            where: { id: department.id },
          })
        ).headId,
        "head",
      )
    })

    await t.test("team leads keep STAFF until reassigned", async () => {
      for (const role of [Role.USER, Role.ADMIN, Role.SUPERADMIN]) {
        const response = await changeRole("lead", role)
        assert.equal(response.status, 409)
        assert.deepEqual(await response.json(), {
          error:
            "Reassign the Creative team lead role before changing this account's role",
        })
        assert.equal(await roleOf("lead"), Role.STAFF)
      }
    })

    await t.test(
      "STAFF without leadership and reassigned heads can change role",
      async () => {
        assert.equal((await changeRole("member", Role.USER)).status, 200)
        assert.equal(await roleOf("member"), Role.USER)
        await prisma.department.update({
          where: { id: department.id },
          data: { headId: null },
        })
        assert.equal((await changeRole("head", Role.ADMIN)).status, 200)
        assert.equal(await roleOf("head"), Role.ADMIN)
      },
    )
  },
)
