import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import {
  hashPassword,
  verifyPassword,
} from "../../../src/features/auth/auth.password.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "Client mutations persist trusted administrative attribution atomically",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, db, base } = await startPgliteApp(t)
    const password = "ClientPrivate123!"
    const passwordHash = await hashPassword(password)
    const tokens = new Map<string, string>()
    async function account(
      id: string,
      role: Role = "USER",
      inactive = false,
      retired = false,
    ) {
      const user = await prisma.user.create({
        data: {
          id,
          email: `${id}@client-attribution.test`,
          fullName: "Original Private Sentinel",
          contactNumber: "09123456789",
          passwordHash,
          role,
          isActive: !inactive,
          accountDeletedAt: retired
            ? new Date("2026-11-15T00:00:00.000Z")
            : null,
        },
      })
      tokens.set(id, (await issueSession(user)).token)
      return user
    }
    for (const [id, role] of [
      ["admin-one", "ADMIN"],
      ["admin-two", "ADMIN"],
      ["root-one", "SUPERADMIN"],
      ["root-two", "SUPERADMIN"],
      ["staff", "STAFF"],
      ["client", "USER"],
    ] as const)
      await account(id, role)
    await account("inactive", "ADMIN", true)
    await account("retired", "SUPERADMIN", true, true)
    const input = (email: string, isActive = true) => ({
      email,
      fullName: "  Private Client Sentinel  ",
      contactNumber: "09123456789",
      isActive,
      password,
    })
    const forged = {
      actorAccountId: "staff",
      actorId: "client",
      actorRoleAtTime: "USER",
      operationId: randomUUID(),
      createdAt: "2000-01-01T00:00:00.000Z",
      role: "SUPERADMIN",
      changes: { passwordHash: "forged-secret" },
    }
    function request(
      path: string,
      method: string,
      body?: unknown,
      actor: string | null = "root-one",
      feature = "clients",
    ) {
      return fetch(`${base}/${feature}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(actor
            ? {
                Authorization: `Bearer ${tokens.get(actor)}`,
                "X-Actor-Id": "staff",
              }
            : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    }
    const counts = async () => [
      await prisma.accountManagementChange.count(),
      await prisma.workforceManagementChange.count(),
    ]
    const snapshot = async () => ({
      users: await prisma.user.findMany({ orderBy: { id: "asc" } }),
      sessions: await prisma.session.findMany({ orderBy: { id: "asc" } }),
      refresh: await prisma.refreshToken.findMany({ orderBy: { id: "asc" } }),
      counts: await counts(),
    })
    let activeId = ""
    let inactiveId = ""
    const updated = {
      fullName: "Changed Private Sentinel",
      email: "changed-private@client-attribution.test",
      contactNumber: "09987654321",
      isActive: false,
    }

    await t.test(
      "Admin and Superadmin creation records the actual actor and fixed persisted USER role",
      async () => {
        for (const [actor, active] of [
          ["admin-one", true],
          ["root-two", false],
        ] as const) {
          const response = await request(
            "",
            "POST",
            {
              ...input(`${actor}-created@client-attribution.test`, active),
              ...forged,
            },
            actor,
          )
          assert.equal(response.status, 201, await response.clone().text())
          const body = (await response.json()) as {
            client: { id: string; isActive: boolean }
          }
          assert.deepEqual(
            Object.keys(body.client).sort(),
            [
              "id",
              "fullName",
              "email",
              "contactNumber",
              "isActive",
              "createdAt",
            ].sort(),
          )
          const saved = await prisma.user.findUniqueOrThrow({
            where: { id: body.client.id },
          })
          assert.equal(saved.role, "USER")
          assert.equal(saved.fullName, "Private Client Sentinel")
          assert.ok(await verifyPassword(password, saved.passwordHash))
          const history = await prisma.accountManagementChange.findFirstOrThrow(
            { where: { subjectAccountId: saved.id } },
          )
          assert.equal(history.actorAccountId, actor)
          assert.equal(
            history.actorRoleAtTime,
            actor === "admin-one" ? "ADMIN" : "SUPERADMIN",
          )
          assert.equal(history.origin, "CLIENT_MANAGEMENT")
          assert.equal(history.action, "CREATED")
          assert.notEqual(history.operationId, forged.operationId)
          assert.notEqual(history.createdAt.toISOString(), forged.createdAt)
          assert.deepEqual(history.changes, {
            role: { before: null, after: "USER" },
            isActive: { before: null, after: active },
          })
          if (active) activeId = saved.id
          else inactiveId = saved.id
        }
        assert.equal(await prisma.workforceManagementChange.count(), 0)
      },
    )

    await t.test(
      "profile changes retain field names, actual status, and completion-only inactive no-ops",
      async () => {
        const before = await prisma.user.findUniqueOrThrow({
          where: { id: activeId },
        })
        const session = await issueSession(before)
        const response = await request(
          `/${activeId}`,
          "PATCH",
          {
            ...updated,
            fullName: ` ${updated.fullName} `,
            email: ` ${updated.email.toUpperCase()} `,
            password: "MustNotReplace123!",
            ...forged,
          },
          "root-two",
        )
        assert.equal(response.status, 200, await response.clone().text())
        const after = await prisma.user.findUniqueOrThrow({
          where: { id: activeId },
        })
        assert.equal(after.role, "USER")
        assert.equal(after.passwordHash, before.passwordHash)
        assert.equal(after.fullName, updated.fullName)
        assert.equal(after.email, updated.email)
        const history = await prisma.accountManagementChange.findFirstOrThrow({
          where: { subjectAccountId: activeId, action: "PROFILE_UPDATED" },
        })
        assert.equal(history.actorAccountId, "root-two")
        assert.equal(history.actorRoleAtTime, "SUPERADMIN")
        assert.equal(history.origin, "CLIENT_MANAGEMENT")
        assert.deepEqual(history.changedFields, [
          "fullName",
          "email",
          "contactNumber",
          "isActive",
        ])
        assert.deepEqual(history.changes, {
          isActive: { before: true, after: false },
          sessionsRevoked: true,
        })
        assert.equal(
          await prisma.session.count({ where: { userId: activeId } }),
          0,
        )
        assert.equal(
          (
            await fetch(`${base}/auth/me`, {
              headers: { Authorization: `Bearer ${session.token}` },
            })
          ).status,
          401,
        )
        assert.equal(
          (await request(`/${activeId}`, "PATCH", updated)).status,
          200,
        )
        const repeated = await prisma.accountManagementChange.findFirstOrThrow({
          where: { subjectAccountId: activeId, action: "PROFILE_UPDATED" },
          orderBy: { createdAt: "desc" },
        })
        assert.deepEqual(repeated.changedFields, [])
        assert.deepEqual(repeated.changes, { sessionsRevoked: true })
        assert.equal(
          (
            await request(`/${activeId}`, "PATCH", {
              ...updated,
              isActive: true,
            })
          ).status,
          200,
        )
        const activated = await prisma.accountManagementChange.findFirstOrThrow(
          {
            where: { subjectAccountId: activeId, action: "PROFILE_UPDATED" },
            orderBy: { createdAt: "desc" },
          },
        )
        assert.deepEqual(activated.changedFields, ["isActive"])
        assert.deepEqual(activated.changes, {
          isActive: { before: false, after: true },
        })
        const count = await counts()
        assert.equal(
          (
            await request(`/${activeId}`, "PATCH", {
              ...updated,
              isActive: true,
            })
          ).status,
          200,
        )
        assert.deepEqual(await counts(), count)
        const profileOnlyEmail = "profile-only@client-attribution.test"
        assert.equal(
          (await request("/client", "PATCH", input(profileOnlyEmail))).status,
          200,
        )
        const profileOnly =
          await prisma.accountManagementChange.findFirstOrThrow({
            where: { subjectAccountId: "client", action: "PROFILE_UPDATED" },
          })
        assert.deepEqual(profileOnly.changedFields, ["fullName", "email"])
        assert.deepEqual(profileOnly.changes, {})
        assert.equal(
          (
            await fetch(`${base}/auth/me`, {
              headers: { Authorization: `Bearer ${tokens.get("client")}` },
            })
          ).status,
          200,
        )
        const serialized = JSON.stringify(
          await prisma.accountManagementChange.findMany(),
        )
        for (const value of [
          password,
          passwordHash,
          before.passwordHash,
          session.token,
          session.refreshToken,
          "Private Client Sentinel",
          profileOnlyEmail,
          updated.fullName,
          updated.email,
          updated.contactNumber,
          "09123456789",
          "forged-secret",
        ])
          assert.ok(!serialized.includes(value))
      },
    )

    await t.test(
      "archival records actual active and already-inactive states and preserves linked records",
      async () => {
        const session = await issueSession(
          await prisma.user.findUniqueOrThrow({ where: { id: activeId } }),
        )
        assert.equal(
          (await request(`/${activeId}`, "DELETE", forged)).status,
          204,
        )
        const after = await prisma.user.findUniqueOrThrow({
          where: { id: activeId },
        })
        assert.equal(after.isActive, false)
        const history = await prisma.accountManagementChange.findFirstOrThrow({
          where: { subjectAccountId: activeId, action: "ARCHIVED" },
        })
        assert.equal(history.actorAccountId, "root-one")
        assert.equal(history.origin, "CLIENT_MANAGEMENT")
        assert.deepEqual(history.changedFields, [
          "accountDeletedAt",
          "isActive",
        ])
        assert.deepEqual(history.changes, {
          accountDeletedAt: {
            before: null,
            after: after.accountDeletedAt!.toISOString(),
          },
          isActive: { before: true, after: false },
          sessionsRevoked: true,
        })
        assert.equal(
          await prisma.session.count({ where: { userId: activeId } }),
          0,
        )
        assert.equal(
          (
            await fetch(`${base}/auth/me`, {
              headers: { Authorization: `Bearer ${session.token}` },
            })
          ).status,
          401,
        )
        const count = await counts()
        assert.equal((await request(`/${activeId}`, "DELETE")).status, 404)
        assert.deepEqual(await counts(), count)
        assert.equal(
          (await request(`/${inactiveId}`, "DELETE", undefined, "root-two"))
            .status,
          204,
        )
        const inactiveHistory =
          await prisma.accountManagementChange.findFirstOrThrow({
            where: { subjectAccountId: inactiveId, action: "ARCHIVED" },
          })
        assert.deepEqual(inactiveHistory.changedFields, ["accountDeletedAt"])
        assert.equal(
          Object.hasOwn(inactiveHistory.changes as object, "isActive"),
          false,
        )
        const service = await prisma.service.create({
          data: { name: "Linked attribution service", description: "Fixture" },
        })
        for (const kind of ["request", "project"] as const) {
          await account(`linked-${kind}`)
          if (kind === "request")
            await prisma.serviceRequest.create({
              data: {
                clientId: "linked-request",
                serviceId: service.id,
                title: "Linked request",
                description: "Private request",
                status: "SUBMITTED",
              },
            })
          else
            await prisma.project.create({
              data: {
                clientId: "linked-project",
                name: "Linked project",
                status: "PLANNED",
              },
            })
          const before = await snapshot()
          assert.equal((await request(`/linked-${kind}`, "DELETE")).status, 409)
          assert.deepEqual(await snapshot(), before)
        }
      },
    )

    await t.test(
      "existing grants, retired accounts, validation and duplicate denials create no history",
      async () => {
        const before = await counts()
        for (const actor of [null, "staff", "client", "inactive", "retired"]) {
          const expected =
            actor === null || actor === "inactive" || actor === "retired"
              ? 401
              : 403
          for (const [path, method] of [
            ["", "POST"],
            ["/client", "PATCH"],
            ["/client", "DELETE"],
          ])
            assert.equal(
              (
                await request(
                  path,
                  method,
                  { ...input("denied@client-attribution.test"), ...forged },
                  actor,
                )
              ).status,
              expected,
            )
        }
        for (const method of ["PATCH", "DELETE"])
          assert.equal(
            (
              await request(
                "/client",
                method,
                input("denied@client-attribution.test"),
                "admin-two",
              )
            ).status,
            403,
          )
        assert.equal(
          (
            await request(
              "",
              "POST",
              input("admin-one@client-attribution.test"),
              "admin-two",
            )
          ).status,
          409,
        )
        assert.equal(
          (
            await request(
              "",
              "POST",
              { ...input("weak@client-attribution.test"), password: "weak" },
              "admin-one",
            )
          ).status,
          400,
        )
        assert.equal(
          (
            await request(
              "/admin-two",
              "PATCH",
              input("wrong-role@client-attribution.test"),
            )
          ).status,
          404,
        )
        assert.equal(
          (
            await request(
              "/missing",
              "PATCH",
              input("missing@client-attribution.test"),
            )
          ).status,
          404,
        )
        assert.equal(
          (await request(`/${activeId}`, "PATCH", updated)).status,
          404,
        )
        assert.equal(
          (
            await request("/client", "PATCH", {
              ...input("invalid@client-attribution.test"),
              isActive: "false",
            })
          ).status,
          400,
        )
        assert.deepEqual(await counts(), before)
      },
    )

    await t.test(
      "history failures roll back creation, profile changes, archival and session revocation",
      async () => {
        await account("rollback-update")
        await account("rollback-archive")
        const before = await snapshot()
        await db.exec(
          `CREATE FUNCTION reject_client_history() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'client history unavailable'; END; $$ LANGUAGE plpgsql; CREATE TRIGGER reject_client_history BEFORE INSERT ON "AccountManagementChange" FOR EACH ROW WHEN (NEW.origin = 'CLIENT_MANAGEMENT') EXECUTE FUNCTION reject_client_history();`,
        )
        try {
          for (const [path, method, body, actor] of [
            [
              "",
              "POST",
              input("rollback-new@client-attribution.test"),
              "admin-two",
            ],
            [
              "/rollback-update",
              "PATCH",
              { ...updated, email: "rollback-changed@client-attribution.test" },
              "root-one",
            ],
            ["/rollback-archive", "DELETE", undefined, "root-two"],
          ] as const) {
            assert.equal(
              (await request(path, method, body, actor)).status,
              500,
              `${method} ${path}`,
            )
            assert.deepEqual(await snapshot(), before)
          }
        } finally {
          await db.exec(
            `DROP TRIGGER reject_client_history ON "AccountManagementChange"; DROP FUNCTION reject_client_history();`,
          )
        }
      },
    )

    await t.test(
      "overlapping archive requests produce one truthful success history",
      async () => {
        await account("archive-race")
        const results = await Promise.all([
          request("/archive-race", "DELETE"),
          request("/archive-race", "DELETE", undefined, "root-two"),
        ])
        assert.equal(results.filter((r) => r.status === 204).length, 1)
        assert.ok(results.every((r) => [204, 404, 409].includes(r.status)))
        const rows = await prisma.accountManagementChange.findMany({
          where: { subjectAccountId: "archive-race" },
        })
        assert.equal(rows.length, 1)
        assert.equal(rows[0].action, "ARCHIVED")
      },
    )

    await t.test(
      "Account Management remains functional and preserves Client history after subject and actor deletion",
      async () => {
        const original = await prisma.accountManagementChange.findMany({
          where: { subjectAccountId: activeId, origin: "CLIENT_MANAGEMENT" },
        })
        assert.ok(original.length)
        assert.equal(
          (
            await request(
              `/${activeId}/permanent`,
              "DELETE",
              undefined,
              "root-one",
              "users",
            )
          ).status,
          200,
        )
        assert.equal(
          await prisma.user.findUnique({ where: { id: activeId } }),
          null,
        )
        assert.deepEqual(
          await prisma.accountManagementChange.findMany({
            where: { subjectAccountId: activeId, origin: "CLIENT_MANAGEMENT" },
          }),
          original,
        )
        assert.equal(
          (
            await prisma.accountManagementChange.findFirstOrThrow({
              where: { subjectAccountId: activeId, action: "DELETED" },
            })
          ).origin,
          "ACCOUNT_MANAGEMENT",
        )
        const actorRows = await prisma.accountManagementChange.findMany({
          where: { actorAccountId: "admin-one" },
        })
        assert.equal(
          (
            await request(
              "/admin-one/status",
              "PATCH",
              { isActive: false },
              "root-two",
              "users",
            )
          ).status,
          200,
        )
        assert.equal(
          (
            await request(
              "/admin-one",
              "DELETE",
              undefined,
              "root-two",
              "users",
            )
          ).status,
          200,
        )
        assert.equal(
          (
            await request(
              "/admin-one/permanent",
              "DELETE",
              undefined,
              "root-two",
              "users",
            )
          ).status,
          200,
        )
        assert.deepEqual(
          await prisma.accountManagementChange.findMany({
            where: { actorAccountId: "admin-one" },
          }),
          actorRows,
        )
        assert.equal(await prisma.workforceManagementChange.count(), 0)
      },
    )
  },
)
