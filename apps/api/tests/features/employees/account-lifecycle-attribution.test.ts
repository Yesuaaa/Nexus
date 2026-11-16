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
  "Employee login lifecycle attributes actual administrators and preserves HR rules",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, db, base } = await startPgliteApp(t)
    const password = "EmployeePrivate123!"
    const passwordHash = await hashPassword(password)
    const tokens = new Map<string, string>()
    async function user(
      id: string,
      role: Role = "STAFF",
      inactive = false,
      archived = false,
    ) {
      const account = await prisma.user.create({
        data: {
          id,
          role,
          email: `${id}@employee-attribution.test`,
          fullName: "Private Login Sentinel",
          passwordHash,
          isActive: !inactive,
          accountDeletedAt: archived
            ? new Date("2026-11-15T00:00:00.000Z")
            : null,
        },
      })
      tokens.set(id, (await issueSession(account)).token)
      return account
    }
    async function employee(id: string, userId: string | null = null) {
      return prisma.employee.create({
        data: {
          id,
          employeeId: `HR-${id}`,
          fullName: "Private Employee Sentinel",
          email: `${id}@employee-attribution.test`,
          contactNumber: "09123456789",
          position: "Private Position Sentinel",
          userId,
        },
      })
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
    await user("inactive-admin", "ADMIN", true)
    await user("retired-root", "SUPERADMIN", true, true)
    await employee("self-admin", "admin-a")
    await prisma.department.create({
      data: { name: "Actor head department", headId: "head" },
    })
    const forged = {
      actorId: "staff",
      actorAccountId: "head",
      actorRoleAtTime: "USER",
      operationId: randomUUID(),
      createdAt: "2000-01-01T00:00:00.000Z",
      role: "SUPERADMIN",
      email: "forged@example.test",
      fullName: "Forged Name",
      departmentId: "forged-department",
    }
    function request(
      id: string,
      suffix: string,
      method: string,
      body?: unknown,
      actor: string | null = "admin-a",
    ) {
      return fetch(
        `${base}/employees/${encodeURIComponent(id)}/account${suffix}`,
        {
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
        },
      )
    }
    function management(
      path: string,
      method: string,
      body?: unknown,
      feature = "users",
    ) {
      return fetch(`${base}/${feature}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.get("root-b")}`,
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
      employees: await prisma.employee.findMany({ orderBy: { id: "asc" } }),
      departments: await prisma.department.findMany({ orderBy: { id: "asc" } }),
      teams: await prisma.team.findMany({ orderBy: { id: "asc" } }),
      sessions: await prisma.session.findMany({ orderBy: { id: "asc" } }),
      refresh: await prisma.refreshToken.findMany({ orderBy: { id: "asc" } }),
      counts: await counts(),
    })
    let provisionedId = ""

    await t.test(
      "provisioning records Staff creation and actual Employee linking under one operation",
      async () => {
        const department = await prisma.department.create({
          data: { name: "Provisioning department" },
        })
        const team = await prisma.team.create({
          data: { name: "Provisioning team", departmentId: department.id },
        })
        for (const [id, actor] of [
          ["provision-admin", "admin-a"],
          ["provision-root", "root-a"],
        ] as const) {
          await employee(id)
          const before = await prisma.employee.update({
            where: { id },
            data: {
              departmentId: department.id,
              teamId: team.id,
              status: "ON_LEAVE",
            },
          })
          const response = await request(
            id,
            "",
            "POST",
            { password, ...forged },
            actor,
          )
          assert.equal(response.status, 201, await response.clone().text())
          const payload = (await response.json()) as {
            employee: Record<string, unknown>
          }
          assert.equal(payload.employee.hasAccount, true)
          assert.equal(payload.employee.accountIsActive, true)
          assert.equal("userId" in payload.employee, false)
          assert.equal("user" in payload.employee, false)
          const after = await prisma.employee.findUniqueOrThrow({
            where: { id },
          })
          assert.ok(after.userId)
          assert.deepEqual(
            { ...after, userId: before.userId, updatedAt: before.updatedAt },
            before,
          )
          const account = await prisma.user.findUniqueOrThrow({
            where: { id: after.userId },
          })
          assert.equal(account.role, "STAFF")
          assert.equal(account.email, before.email)
          assert.ok(await verifyPassword(password, account.passwordHash))
          const event = await prisma.accountManagementChange.findFirstOrThrow({
            where: { subjectAccountId: account.id },
          })
          assert.equal(event.origin, "EMPLOYEE_MANAGEMENT")
          assert.equal(event.action, "CREATED")
          assert.equal(event.actorAccountId, actor)
          assert.equal(
            event.actorRoleAtTime,
            actor === "admin-a" ? "ADMIN" : "SUPERADMIN",
          )
          assert.notEqual(event.operationId, forged.operationId)
          assert.notEqual(event.createdAt.toISOString(), forged.createdAt)
          assert.deepEqual(event.changes, {
            role: { before: null, after: "STAFF" },
            isActive: { before: null, after: true },
          })
          const effects = await prisma.workforceManagementChange.findMany({
            where: { operationId: event.operationId },
          })
          assert.ok(
            effects.every(
              (row) =>
                row.actorAccountId === actor &&
                row.origin === "EMPLOYEE_MANAGEMENT",
            ),
          )
          assert.deepEqual(
            effects.find((row) => row.subjectId === id)!.changes,
            { userId: { before: null, after: account.id } },
          )
          assert.ok(
            effects.some(
              (row) =>
                row.subjectId === department.id &&
                row.action === "ASSIGNMENT_CHANGED",
            ),
          )
          assert.equal(
            effects.some(
              (row) =>
                row.action === "CREATED" || row.action === "STATUS_CHANGED",
            ),
            false,
          )
          if (actor === "admin-a") provisionedId = account.id
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
      "status changes and archival preserve Employee state and truthful no-op semantics",
      async () => {
        const before = await prisma.employee.findUniqueOrThrow({
          where: { id: "provision-admin" },
        })
        const session = await issueSession(
          await prisma.user.findUniqueOrThrow({ where: { id: provisionedId } }),
        )
        const workforceCount = await prisma.workforceManagementChange.count()
        assert.equal(
          (
            await request(
              "provision-admin",
              "/status",
              "PATCH",
              { isActive: false, ...forged },
              "root-a",
            )
          ).status,
          204,
        )
        const status = await prisma.accountManagementChange.findFirstOrThrow({
          where: { subjectAccountId: provisionedId, action: "STATUS_CHANGED" },
        })
        assert.equal(status.actorAccountId, "root-a")
        assert.equal(status.origin, "EMPLOYEE_MANAGEMENT")
        assert.deepEqual(status.changes, {
          isActive: { before: true, after: false },
          sessionsRevoked: true,
        })
        assert.equal(
          await prisma.session.count({ where: { userId: provisionedId } }),
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
          (
            await request("provision-admin", "/status", "PATCH", {
              isActive: false,
            })
          ).status,
          204,
        )
        const repeated = await prisma.accountManagementChange.findFirstOrThrow({
          where: { subjectAccountId: provisionedId, action: "STATUS_CHANGED" },
          orderBy: { createdAt: "desc" },
        })
        assert.deepEqual(repeated.changedFields, [])
        assert.deepEqual(repeated.changes, { sessionsRevoked: true })
        assert.equal(
          (
            await request("provision-admin", "/status", "PATCH", {
              isActive: true,
            })
          ).status,
          204,
        )
        const count = await counts()
        assert.equal(
          (
            await request("provision-admin", "/status", "PATCH", {
              isActive: true,
            })
          ).status,
          204,
        )
        assert.deepEqual(await counts(), count)
        assert.equal(
          (
            await request("provision-admin", "/status", "PATCH", {
              isActive: false,
            })
          ).status,
          204,
        )
        await issueSession(
          await prisma.user.findUniqueOrThrow({ where: { id: provisionedId } }),
        )
        assert.equal(
          (await request("provision-admin", "", "DELETE", forged, "root-a"))
            .status,
          204,
        )
        const archived = await prisma.user.findUniqueOrThrow({
          where: { id: provisionedId },
        })
        const event = await prisma.accountManagementChange.findFirstOrThrow({
          where: { subjectAccountId: provisionedId, action: "ARCHIVED" },
        })
        assert.equal(event.actorAccountId, "root-a")
        assert.deepEqual(event.changedFields, ["accountDeletedAt"])
        assert.deepEqual(event.changes, {
          accountDeletedAt: {
            before: null,
            after: archived.accountDeletedAt!.toISOString(),
          },
          sessionsRevoked: true,
        })
        assert.equal(
          await prisma.session.count({ where: { userId: provisionedId } }),
          0,
        )
        assert.deepEqual(
          await prisma.employee.findUniqueOrThrow({
            where: { id: "provision-admin" },
          }),
          before,
        )
        assert.equal(
          await prisma.workforceManagementChange.count(),
          workforceCount,
        )
      },
    )

    async function deletionFixture(id: string) {
      await user(id, "STAFF", true, true)
      await employee(`employee-${id}`, id)
      const department = await prisma.department.create({
        data: { name: `Head ${id}`, headId: id },
      })
      const original = await prisma.department.create({
        data: { name: `Original ${id}`, temporaryHeadOriginalId: id },
      })
      const temporary = await prisma.department.create({
        data: { name: `Temporary ${id}`, temporaryHeadAssignedId: id },
      })
      const team = await prisma.team.create({
        data: { name: `Team ${id}`, departmentId: department.id, leadId: id },
      })
      await prisma.user.update({
        where: { id },
        data: { departmentId: department.id, teamId: team.id },
      })
      await prisma.employee.update({
        where: { id: `employee-${id}` },
        data: {
          departmentId: department.id,
          teamId: team.id,
          status: "ON_LEAVE",
        },
      })
      return { department, original, temporary, team }
    }

    await t.test(
      "permanent deletion attributes unlinking, membership and existing leadership FK effects",
      async () => {
        const fixture = await deletionFixture("delete-target")
        const before = await prisma.employee.findUniqueOrThrow({
          where: { id: "employee-delete-target" },
        })
        assert.equal(
          (await request(before.id, "/permanent", "DELETE", forged, "root-a"))
            .status,
          204,
        )
        assert.equal(
          await prisma.user.findUnique({ where: { id: "delete-target" } }),
          null,
        )
        const after = await prisma.employee.findUniqueOrThrow({
          where: { id: before.id },
        })
        assert.deepEqual(after, { ...before, userId: null })
        const event = await prisma.accountManagementChange.findFirstOrThrow({
          where: { subjectAccountId: "delete-target", action: "DELETED" },
        })
        assert.equal(event.origin, "EMPLOYEE_MANAGEMENT")
        assert.equal(event.actorAccountId, "root-a")
        const effects = await prisma.workforceManagementChange.findMany({
          where: { operationId: event.operationId },
        })
        assert.equal(effects.length, 6)
        assert.ok(
          effects.every(
            (row) =>
              row.origin === "EMPLOYEE_MANAGEMENT" &&
              row.actorAccountId === "root-a",
          ),
        )
        assert.deepEqual(
          effects.find((row) => row.subjectId === before.id)!.changes,
          { userId: { before: "delete-target", after: null } },
        )
        assert.ok(
          effects.some(
            (row) =>
              row.subjectId === fixture.department.id &&
              row.action === "HEAD_CHANGED",
          ),
        )
        assert.ok(
          effects.some(
            (row) =>
              row.subjectId === fixture.original.id &&
              row.changedFields.includes("temporaryHeadOriginalId"),
          ),
        )
        assert.ok(
          effects.some(
            (row) =>
              row.subjectId === fixture.temporary.id &&
              row.changedFields.includes("temporaryHeadAssignedId"),
          ),
        )
        assert.ok(
          effects.some(
            (row) =>
              row.subjectId === fixture.team.id &&
              row.action === "LEAD_CHANGED",
          ),
        )
        await user("virtual-target", "STAFF")
        assert.equal(
          (
            await request("account:virtual-target", "/status", "PATCH", {
              isActive: false,
            })
          ).status,
          204,
        )
        assert.equal(
          (await request("account:virtual-target", "", "DELETE")).status,
          204,
        )
        assert.equal(
          (await request("account:virtual-target", "/permanent", "DELETE"))
            .status,
          204,
        )
        assert.equal(
          await prisma.employee.count({ where: { userId: "virtual-target" } }),
          0,
        )
      },
    )

    await t.test(
      "permissions, self-protection, eligibility, passwords and linked history remain enforced",
      async () => {
        await employee("unlinked")
        await user("admin-target", "ADMIN", true)
        await employee("admin-target-hr", "admin-target")
        await user("active-target")
        await employee("active-target-hr", "active-target")
        await user("inactive-target", "STAFF", true)
        await employee("inactive-target-hr", "inactive-target")
        const before = await counts()
        for (const actor of [
          null,
          "staff",
          "head",
          "client",
          "inactive-admin",
          "retired-root",
        ]) {
          const expected =
            actor === null ||
            actor === "inactive-admin" ||
            actor === "retired-root"
              ? 401
              : 403
          for (const [suffix, method, body] of [
            ["", "POST", { password, ...forged }],
            ["/status", "PATCH", { isActive: false, ...forged }],
            ["", "DELETE", forged],
            ["/permanent", "DELETE", forged],
          ] as const)
            assert.equal(
              (await request("unlinked", suffix, method, body, actor)).status,
              expected,
            )
        }
        for (const [suffix, method, body] of [
          ["/status", "PATCH", { isActive: false }],
          ["", "DELETE", undefined],
          ["/permanent", "DELETE", undefined],
        ] as const) {
          assert.equal(
            (await request("self-admin", suffix, method, body)).status,
            403,
          )
          assert.equal(
            (await request("admin-target-hr", suffix, method, body)).status,
            403,
          )
          assert.equal(
            (await request("missing", suffix, method, body)).status,
            404,
          )
          assert.equal(
            (await request("unlinked", suffix, method, body)).status,
            404,
          )
        }
        assert.equal(
          (await request("active-target-hr", "", "DELETE")).status,
          409,
        )
        assert.equal(
          (await request("inactive-target-hr", "/permanent", "DELETE")).status,
          409,
        )
        assert.equal(
          (await request("provision-admin", "", "POST", { password })).status,
          409,
        )
        assert.equal(
          (
            await request("provision-admin", "/status", "PATCH", {
              isActive: true,
            })
          ).status,
          409,
        )
        assert.equal(
          (await request("provision-admin", "", "DELETE")).status,
          409,
        )
        assert.equal(
          (await request("unlinked", "", "POST", { password: "weak" })).status,
          400,
        )
        assert.equal(
          (await request("missing", "", "POST", { password })).status,
          404,
        )
        assert.equal(
          (
            await request("active-target-hr", "/status", "PATCH", {
              isActive: "false",
            })
          ).status,
          400,
        )
        await employee("duplicate-login")
        await prisma.employee.update({
          where: { id: "duplicate-login" },
          data: { email: "client@employee-attribution.test" },
        })
        assert.equal(
          (await request("duplicate-login", "", "POST", { password })).status,
          409,
        )
        await user("blocked-target", "STAFF", true, true)
        await employee("blocked-target-hr", "blocked-target")
        await prisma.attendanceAudit.create({
          data: {
            actorId: "blocked-target",
            entityType: "AttendancePolicy",
            entityId: "existing",
            action: "UPDATE",
            reason: "Existing related history",
            actionId: randomUUID(),
          },
        })
        assert.equal(
          (await request("blocked-target-hr", "/permanent", "DELETE")).status,
          409,
        )
        assert.deepEqual(await counts(), before)
      },
    )

    await t.test(
      "history failures roll back provisioning, status, archival, deletion, sessions and all workforce effects",
      async () => {
        await employee("rollback-provision")
        await user("rollback-status")
        await employee("rollback-status-hr", "rollback-status")
        await user("rollback-archive", "STAFF", true)
        await employee("rollback-archive-hr", "rollback-archive")
        await deletionFixture("rollback-delete")
        const before = await snapshot()
        await db.exec(
          `CREATE FUNCTION reject_employee_account_history() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'employee account history unavailable'; END; $$ LANGUAGE plpgsql; CREATE TRIGGER reject_employee_account_history BEFORE INSERT ON "AccountManagementChange" FOR EACH ROW WHEN (NEW.origin = 'EMPLOYEE_MANAGEMENT') EXECUTE FUNCTION reject_employee_account_history();`,
        )
        try {
          for (const [id, suffix, method, body] of [
            ["rollback-provision", "", "POST", { password }],
            ["rollback-status-hr", "/status", "PATCH", { isActive: false }],
            ["rollback-archive-hr", "", "DELETE", undefined],
            ["employee-rollback-delete", "/permanent", "DELETE", undefined],
          ] as const) {
            assert.equal((await request(id, suffix, method, body)).status, 500)
            assert.deepEqual(await snapshot(), before)
          }
        } finally {
          await db.exec(
            `DROP TRIGGER reject_employee_account_history ON "AccountManagementChange"; DROP FUNCTION reject_employee_account_history();`,
          )
        }
        await db.exec(
          `CREATE FUNCTION reject_employee_workforce_history() RETURNS trigger AS $$ BEGIN IF NEW."subjectId" = 'rollback-provision' OR NEW.action = 'LEAD_CHANGED' THEN RAISE EXCEPTION 'employee workforce history unavailable'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql; CREATE TRIGGER reject_employee_workforce_history BEFORE INSERT ON "WorkforceManagementChange" FOR EACH ROW WHEN (NEW.origin = 'EMPLOYEE_MANAGEMENT') EXECUTE FUNCTION reject_employee_workforce_history();`,
        )
        try {
          assert.equal(
            (await request("rollback-provision", "", "POST", { password }))
              .status,
            500,
          )
          assert.deepEqual(await snapshot(), before)
          assert.equal(
            (await request("employee-rollback-delete", "/permanent", "DELETE"))
              .status,
            500,
          )
          assert.deepEqual(await snapshot(), before)
        } finally {
          await db.exec(
            `DROP TRIGGER reject_employee_workforce_history ON "WorkforceManagementChange"; DROP FUNCTION reject_employee_workforce_history();`,
          )
        }
      },
    )

    await t.test(
      "overlapping provisioning and deletion commit only one link or unlink history",
      async () => {
        await employee("concurrent-provision")
        const provisions = await Promise.all([
          request("concurrent-provision", "", "POST", { password }),
          request("concurrent-provision", "", "POST", { password }, "root-a"),
        ])
        assert.equal(provisions.filter((r) => r.status === 201).length, 1)
        assert.ok(provisions.every((r) => [201, 409].includes(r.status)))
        const linked = await prisma.employee.findUniqueOrThrow({
          where: { id: "concurrent-provision" },
        })
        const accountEvents = await prisma.accountManagementChange.findMany({
          where: { subjectAccountId: linked.userId! },
        })
        assert.equal(accountEvents.length, 1)
        assert.equal(
          (
            await prisma.workforceManagementChange.findMany({
              where: { subjectId: linked.id },
            })
          ).length,
          1,
        )
        assert.equal(
          (await request(linked.id, "/status", "PATCH", { isActive: false }))
            .status,
          204,
        )
        assert.equal((await request(linked.id, "", "DELETE")).status, 204)
        const deletions = await Promise.all([
          request(linked.id, "/permanent", "DELETE"),
          request(linked.id, "/permanent", "DELETE", undefined, "root-a"),
        ])
        assert.equal(deletions.filter((r) => r.status === 204).length, 1)
        assert.ok(deletions.every((r) => [204, 404, 409].includes(r.status)))
        assert.equal(
          await prisma.accountManagementChange.count({
            where: { subjectAccountId: linked.userId!, action: "DELETED" },
          }),
          1,
        )
      },
    )

    await t.test(
      "history excludes private values, survives actor/target deletion, and other integrations retain their origins",
      async () => {
        const stored = JSON.stringify([
          await prisma.accountManagementChange.findMany(),
          await prisma.workforceManagementChange.findMany(),
        ])
        for (const secret of [
          password,
          passwordHash,
          "Private Login Sentinel",
          "Private Employee Sentinel",
          "Private Position Sentinel",
          "09123456789",
          "forged@example.test",
          "Forged Name",
          ...tokens.values(),
        ])
          assert.ok(!stored.includes(secret))
        assert.equal(
          (
            await request(
              "provision-admin",
              "/permanent",
              "DELETE",
              undefined,
              "root-a",
            )
          ).status,
          204,
        )
        assert.ok(
          await prisma.accountManagementChange.count({
            where: {
              subjectAccountId: provisionedId,
              origin: "EMPLOYEE_MANAGEMENT",
            },
          }),
        )
        const originalAccount = await prisma.accountManagementChange.findMany({
          where: { actorAccountId: "admin-a" },
        })
        const originalWorkforce =
          await prisma.workforceManagementChange.findMany({
            where: { actorAccountId: "admin-a" },
          })
        assert.equal(
          (await management("/admin-a/status", "PATCH", { isActive: false }))
            .status,
          200,
        )
        assert.equal((await management("/admin-a", "DELETE")).status, 200)
        assert.equal(
          (await management("/admin-a/permanent", "DELETE")).status,
          200,
        )
        assert.deepEqual(
          await prisma.accountManagementChange.findMany({
            where: { actorAccountId: "admin-a" },
          }),
          originalAccount,
        )
        assert.deepEqual(
          await prisma.workforceManagementChange.findMany({
            where: { actorAccountId: "admin-a" },
          }),
          originalWorkforce,
        )
        assert.equal(
          (
            await prisma.accountManagementChange.findFirstOrThrow({
              where: { subjectAccountId: "admin-a", action: "DELETED" },
            })
          ).origin,
          "ACCOUNT_MANAGEMENT",
        )
        const client = await management(
          "",
          "POST",
          {
            fullName: "Regression Client",
            email: "regression-client@employee-attribution.test",
            contactNumber: "09123456789",
            password,
            isActive: true,
          },
          "clients",
        )
        assert.equal(client.status, 201)
        const clientId = ((await client.json()) as { client: { id: string } })
          .client.id
        assert.equal(
          (
            await prisma.accountManagementChange.findFirstOrThrow({
              where: { subjectAccountId: clientId },
            })
          ).origin,
          "CLIENT_MANAGEMENT",
        )
      },
    )
  },
)
