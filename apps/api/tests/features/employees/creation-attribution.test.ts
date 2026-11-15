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
  "Employee creation and profile attachment retain actual administrative actors atomically",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, db, base } = await startPgliteApp(t)
    const password = "CreationPrivate123!"
    const passwordHash = await hashPassword(password)
    const tokens = new Map<string, string>()
    async function user(
      id: string,
      role: Role = "STAFF",
      inactive = false,
      retired = false,
    ) {
      const account = await prisma.user.create({
        data: {
          id,
          role,
          email: `${id}@creation-attribution.test`,
          fullName: "Original Private Sentinel",
          contactNumber: "09123456789",
          position: "Original Job Sentinel",
          passwordHash,
          isActive: !inactive,
          accountDeletedAt: retired
            ? new Date("2026-11-15T00:00:00.000Z")
            : null,
        },
      })
      tokens.set(id, (await issueSession(account)).token)
      return account
    }
    for (const [id, role] of [
      ["admin-a", "ADMIN"],
      ["admin-b", "ADMIN"],
      ["root-a", "SUPERADMIN"],
      ["root-b", "SUPERADMIN"],
      ["staff", "STAFF"],
      ["head", "STAFF"],
      ["client", "USER"],
    ] as const)
      await user(id, role)
    await user("inactive-actor", "ADMIN", true)
    await user("retired-actor", "SUPERADMIN", true, true)
    await prisma.department.create({
      data: { name: "Actor head department", headId: "head" },
    })
    const department = await prisma.department.create({
      data: { name: "Creation department" },
    })
    const team = await prisma.team.create({
      data: { name: "Creation team", departmentId: department.id },
    })
    const priorDepartment = await prisma.department.create({
      data: { name: "Prior department" },
    })
    const priorTeam = await prisma.team.create({
      data: { name: "Prior team", departmentId: priorDepartment.id },
    })
    function input(id: string) {
      return {
        employeeId: `EXP-${id}`,
        fullName: "  Created Private Sentinel  ",
        email: `${id}@creation-attribution.test`,
        contactNumber: "09123456789",
        position: "Private Position Sentinel",
        employmentType: "CONTRACT",
        status: "ON_LEAVE",
        startDate: "2026-11-01",
        departmentId: department.id,
        teamId: team.id,
      }
    }
    const forged = {
      actorId: "staff",
      actorAccountId: "client",
      actorRoleAtTime: "USER",
      operationId: randomUUID(),
      createdAt: "2000-01-01T00:00:00.000Z",
      role: "SUPERADMIN",
      changes: { passwordHash: "forged-secret" },
    }
    function request(
      path: string,
      body: unknown,
      actor: string | null = "admin-a",
    ) {
      return fetch(`${base}/employees${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(actor
            ? {
                Authorization: `Bearer ${tokens.get(actor)}`,
                "X-Actor-Id": "client",
              }
            : {}),
        },
        body: JSON.stringify(body),
      })
    }
    const counts = async () => [
      await prisma.accountManagementChange.count(),
      await prisma.workforceManagementChange.count(),
    ]
    const snapshot = async () => ({
      users: await prisma.user.findMany({ orderBy: { id: "asc" } }),
      employees: await prisma.employee.findMany({ orderBy: { id: "asc" } }),
      departments: await prisma.department.findMany({ orderBy: { id: "asc" } }),
      teams: await prisma.team.findMany({ orderBy: { id: "asc" } }),
      sessions: await prisma.session.findMany({ orderBy: { id: "asc" } }),
      refresh: await prisma.refreshToken.findMany({ orderBy: { id: "asc" } }),
      counts: await counts(),
    })
    async function createdEmployee(response: Response) {
      assert.equal(response.status, 201, await response.clone().text())
      const payload = (await response.json()) as {
        employee: { id: string; hasAccount: boolean; accountIsActive: boolean }
      }
      assert.equal("userId" in payload.employee, false)
      assert.equal("user" in payload.employee, false)
      assert.equal("passwordHash" in payload.employee, false)
      return prisma.employee.findUniqueOrThrow({
        where: { id: payload.employee.id },
      })
    }
    await t.test(
      "creation records one Staff account and one Employee with shared trusted operation and actual assignments",
      async () => {
        for (const [id, actor] of [
          ["new-admin", "admin-a"],
          ["new-root", "root-a"],
        ] as const) {
          const employee = await createdEmployee(
            await request(
              "",
              { ...input(id), password, ...forged, isActive: false },
              actor,
            ),
          )
          const account = await prisma.user.findUniqueOrThrow({
            where: { id: employee.userId! },
          })
          assert.equal(account.role, "STAFF")
          assert.equal(account.isActive, true)
          assert.equal(employee.status, "ON_LEAVE")
          assert.equal(employee.fullName, "Created Private Sentinel")
          assert.ok(await verifyPassword(password, account.passwordHash))
          const accountEvents = await prisma.accountManagementChange.findMany({
            where: { subjectAccountId: account.id },
          })
          assert.equal(accountEvents.length, 1)
          const event = accountEvents[0]
          assert.equal(event.action, "CREATED")
          assert.equal(event.actorAccountId, actor)
          assert.equal(
            event.actorRoleAtTime,
            actor === "admin-a" ? "ADMIN" : "SUPERADMIN",
          )
          assert.equal(event.origin, "EMPLOYEE_MANAGEMENT")
          assert.notEqual(event.operationId, forged.operationId)
          assert.notEqual(event.createdAt.toISOString(), forged.createdAt)
          assert.deepEqual(event.changes, {
            role: { before: null, after: "STAFF" },
            isActive: { before: null, after: true },
          })
          const effects = await prisma.workforceManagementChange.findMany({
            where: { operationId: event.operationId },
          })
          assert.equal(effects.length, 2)
          assert.ok(
            effects.every(
              (row) =>
                row.actorAccountId === actor &&
                row.actorRoleAtTime === event.actorRoleAtTime &&
                row.origin === "EMPLOYEE_MANAGEMENT",
            ),
          )
          const creation = effects.find((row) => row.subjectId === employee.id)!
          assert.equal(creation.action, "CREATED")
          assert.deepEqual(creation.changes, {
            userId: { before: null, after: account.id },
            departmentId: { before: null, after: department.id },
            teamId: { before: null, after: team.id },
            status: { before: null, after: employee.status },
            employmentType: { before: null, after: employee.employmentType },
          })
          const membership = effects.find(
            (row) => row.subjectType === "DEPARTMENT",
          )!
          assert.equal(membership.subjectId, department.id)
          assert.deepEqual(membership.changes, {
            affectedAccountId: account.id,
            departmentId: { before: null, after: department.id },
            teamId: { before: null, after: team.id },
          })
        }
        assert.equal(
          await prisma.employee.count({
            where: { userId: { in: ["root-a", "root-b"] } },
          }),
          0,
        )
      },
    )
    await t.test(
      "profile attachment creates only an Employee and records actual existing-account assignment synchronization",
      async () => {
        for (const [id, role, actor] of [
          ["attach-staff", "STAFF", "root-a"],
          ["attach-admin", "ADMIN", "admin-a"],
        ] as const) {
          await user(id, role, role === "ADMIN")
          const before = await prisma.user.update({
            where: { id },
            data: { departmentId: priorDepartment.id, teamId: priorTeam.id },
          })
          const userCount = await prisma.user.count()
          const accountEvents = await prisma.accountManagementChange.count()
          const employee = await createdEmployee(
            await request(
              `/accounts/${id}/profile`,
              { ...input(id), ...forged },
              actor,
            ),
          )
          const after = await prisma.user.findUniqueOrThrow({ where: { id } })
          assert.equal(await prisma.user.count(), userCount)
          assert.equal(
            await prisma.accountManagementChange.count(),
            accountEvents,
          )
          assert.equal(after.passwordHash, before.passwordHash)
          assert.equal(after.role, role)
          assert.equal(after.isActive, before.isActive)
          assert.equal(await prisma.session.count({ where: { userId: id } }), 1)
          assert.equal(employee.userId, id)
          assert.equal(after.fullName, employee.fullName)
          assert.equal(after.position, employee.position)
          const creation =
            await prisma.workforceManagementChange.findFirstOrThrow({
              where: { subjectId: employee.id },
            })
          assert.equal(creation.action, "CREATED")
          assert.equal(creation.actorAccountId, actor)
          assert.equal(creation.origin, "EMPLOYEE_MANAGEMENT")
          const effects = await prisma.workforceManagementChange.findMany({
            where: { operationId: creation.operationId },
          })
          assert.equal(effects.length, 2)
          assert.deepEqual(
            effects.find((row) => row.subjectType === "DEPARTMENT")!.changes,
            {
              affectedAccountId: id,
              departmentId: {
                before: priorDepartment.id,
                after: department.id,
              },
              teamId: { before: priorTeam.id, after: team.id },
            },
          )
          assert.ok(
            effects.every(
              (row) =>
                row.action === "CREATED" || row.action === "ASSIGNMENT_CHANGED",
            ),
          )
        }
      },
    )
    await t.test(
      "unchanged assignments and explicit No team do not produce duplicate or fabricated events",
      async () => {
        await user("same-assignment")
        await prisma.user.update({
          where: { id: "same-assignment" },
          data: { departmentId: department.id, teamId: team.id },
        })
        const same = await createdEmployee(
          await request(
            "/accounts/same-assignment/profile",
            input("same-assignment"),
          ),
        )
        const sameCreation =
          await prisma.workforceManagementChange.findFirstOrThrow({
            where: { subjectId: same.id },
          })
        assert.equal(
          await prisma.workforceManagementChange.count({
            where: { operationId: sameCreation.operationId },
          }),
          1,
        )
        await user("removed-assignment")
        await prisma.user.update({
          where: { id: "removed-assignment" },
          data: { departmentId: priorDepartment.id, teamId: priorTeam.id },
        })
        const removed = await createdEmployee(
          await request("/accounts/removed-assignment/profile", {
            ...input("removed-assignment"),
            departmentId: priorDepartment.id,
            teamId: null,
          }),
        )
        const removedCreation =
          await prisma.workforceManagementChange.findFirstOrThrow({
            where: { subjectId: removed.id },
          })
        const removal = await prisma.workforceManagementChange.findFirstOrThrow(
          {
            where: {
              operationId: removedCreation.operationId,
              subjectType: "DEPARTMENT",
            },
          },
        )
        assert.equal(removal.subjectId, priorDepartment.id)
        assert.deepEqual(removal.changes, {
          affectedAccountId: "removed-assignment",
          teamId: { before: priorTeam.id, after: null },
        })
        const empty = await createdEmployee(
          await request("", {
            ...input("unassigned-new"),
            teamId: null,
            password,
          }),
        )
        const emptyEvent =
          await prisma.workforceManagementChange.findFirstOrThrow({
            where: { subjectId: empty.id },
          })
        const emptyEffects = await prisma.workforceManagementChange.findMany({
          where: { operationId: emptyEvent.operationId },
        })
        assert.equal(emptyEffects.length, 2)
        assert.deepEqual(
          emptyEffects.find((row) => row.subjectType === "DEPARTMENT")!.changes,
          {
            affectedAccountId: empty.userId,
            departmentId: { before: null, after: department.id },
          },
        )
      },
    )
    await t.test(
      "existing permission, eligibility, credentials, duplicate and leadership rules reject without success history",
      async () => {
        const before = await counts()
        for (const actor of [
          null,
          "staff",
          "head",
          "client",
          "inactive-actor",
          "retired-actor",
        ]) {
          const expected =
            actor === null ||
            actor === "inactive-actor" ||
            actor === "retired-actor"
              ? 401
              : 403
          for (const path of ["", "/accounts/staff/profile"])
            assert.equal(
              (
                await request(
                  path,
                  {
                    ...input("denied"),
                    ...(path ? {} : { password }),
                    ...forged,
                  },
                  actor,
                )
              ).status,
              expected,
            )
        }
        for (const id of ["root-a", "client", "retired-actor", "missing"])
          assert.equal(
            (await request(`/accounts/${id}/profile`, input("invalid-target")))
              .status,
            404,
          )
        assert.equal(
          (
            await request(
              "/accounts/attach-staff/profile",
              input("duplicate-profile"),
            )
          ).status,
          409,
        )
        assert.equal(
          (
            await request("/accounts/staff/profile", {
              ...input("password-attachment"),
              password,
            })
          ).status,
          400,
        )
        assert.equal(
          (await request("", { ...input("weak-password"), password: "weak" }))
            .status,
          400,
        )
        assert.equal(
          (await request("", { ...input("new-admin"), password })).status,
          409,
        )
        assert.equal(
          (
            await request("", {
              ...input("bad-team"),
              departmentId: priorDepartment.id,
              password,
            })
          ).status,
          400,
        )
        assert.equal(
          (
            await request("", {
              ...input("missing-department"),
              departmentId: null,
              teamId: null,
              password,
            })
          ).status,
          400,
        )
        assert.equal(
          (
            await request("", {
              ...input("invalid-link"),
              userId: "root-a",
              password,
            })
          ).status,
          400,
        )
        assert.equal(
          (
            await request("", {
              ...input("invalid-title"),
              position: "Department Head",
              password,
            })
          ).status,
          400,
        )
        assert.equal(
          (
            await request("/accounts/head/profile", {
              ...input("head-move"),
              teamId: null,
            })
          ).status,
          409,
        )
        assert.deepEqual(await counts(), before)
        assert.equal(
          await prisma.employee.count({
            where: { userId: { in: ["root-a", "root-b"] } },
          }),
          0,
        )
      },
    )
    await t.test(
      "Account and late Workforce history failures roll back both endpoint transactions completely",
      async () => {
        await user("rollback-attach")
        await prisma.user.update({
          where: { id: "rollback-attach" },
          data: { departmentId: priorDepartment.id, teamId: priorTeam.id },
        })
        const before = await snapshot()
        await db.exec(
          `CREATE FUNCTION reject_creation_account_history() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'creation account history unavailable'; END; $$ LANGUAGE plpgsql; CREATE TRIGGER reject_creation_account_history BEFORE INSERT ON "AccountManagementChange" FOR EACH ROW WHEN (NEW.origin = 'EMPLOYEE_MANAGEMENT') EXECUTE FUNCTION reject_creation_account_history();`,
        )
        try {
          assert.equal(
            (await request("", { ...input("rollback-new"), password })).status,
            500,
          )
          assert.deepEqual(await snapshot(), before)
        } finally {
          await db.exec(
            `DROP TRIGGER reject_creation_account_history ON "AccountManagementChange"; DROP FUNCTION reject_creation_account_history();`,
          )
        }
        await db.exec(
          `CREATE FUNCTION reject_creation_workforce_history() RETURNS trigger AS $$ BEGIN IF NEW."subjectType" = 'DEPARTMENT' THEN RAISE EXCEPTION 'creation workforce history unavailable'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql; CREATE TRIGGER reject_creation_workforce_history BEFORE INSERT ON "WorkforceManagementChange" FOR EACH ROW WHEN (NEW.origin = 'EMPLOYEE_MANAGEMENT') EXECUTE FUNCTION reject_creation_workforce_history();`,
        )
        try {
          assert.equal(
            (await request("", { ...input("rollback-new"), password })).status,
            500,
          )
          assert.deepEqual(await snapshot(), before)
          assert.equal(
            (
              await request(
                "/accounts/rollback-attach/profile",
                input("rollback-attach"),
              )
            ).status,
            500,
          )
          assert.deepEqual(await snapshot(), before)
        } finally {
          await db.exec(
            `DROP TRIGGER reject_creation_workforce_history ON "WorkforceManagementChange"; DROP FUNCTION reject_creation_workforce_history();`,
          )
        }
      },
    )
    await t.test(
      "concurrent attachments preserve one Employee and one creation history group",
      async () => {
        await user("concurrent-attach")
        const results = await Promise.all([
          request(
            "/accounts/concurrent-attach/profile",
            input("concurrent-attach"),
          ),
          request(
            "/accounts/concurrent-attach/profile",
            input("concurrent-attach"),
            "root-a",
          ),
        ])
        assert.equal(results.filter((r) => r.status === 201).length, 1)
        assert.ok(results.every((r) => [201, 409].includes(r.status)))
        const employee = await prisma.employee.findUniqueOrThrow({
          where: { userId: "concurrent-attach" },
        })
        assert.equal(
          await prisma.workforceManagementChange.count({
            where: { subjectId: employee.id, action: "CREATED" },
          }),
          1,
        )
        assert.equal(
          await prisma.accountManagementChange.count({
            where: { subjectAccountId: "concurrent-attach" },
          }),
          0,
        )
      },
    )
    await t.test(
      "history never stores private profiles, credentials, submitted claims or synthetic account events",
      async () => {
        const events = await prisma.accountManagementChange.findMany()
        const workforce = await prisma.workforceManagementChange.findMany()
        const stored = JSON.stringify([events, workforce])
        for (const secret of [
          password,
          passwordHash,
          "Created Private Sentinel",
          "Original Private Sentinel",
          "Original Job Sentinel",
          "Private Position Sentinel",
          "09123456789",
          "forged-secret",
          "@creation-attribution.test",
          "2026-11-01",
          ...tokens.values(),
        ])
          assert.ok(!stored.includes(secret))
        for (const event of events) {
          assert.equal(event.origin, "EMPLOYEE_MANAGEMENT")
          assert.equal(event.action, "CREATED")
          assert.ok(
            event.actorAccountId === "admin-a" ||
              event.actorAccountId === "root-a",
          )
          assert.ok(
            await prisma.employee.findUnique({
              where: { userId: event.subjectAccountId },
            }),
          )
        }
        assert.equal(events.length, 3)
        assert.ok(
          workforce.every(
            (row) =>
              row.action === "CREATED" || row.action === "ASSIGNMENT_CHANGED",
          ),
        )
      },
    )
  },
)
