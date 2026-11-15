import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import type { Role } from "../../../src/generated/prisma/client.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "department reads are observational and leadership writes maintain integrity",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, db, base } = await startPgliteApp(t)
    async function account(id: string, role: Role = "STAFF") {
      const user = await prisma.user.create({
        data: {
          id,
          email: `${id}@read-integrity.test`,
          fullName: `${id} Person`,
          role,
          passwordHash: "test-only",
        },
      })
      const session = await issueSession(user)
      return { user, headers: { Authorization: `Bearer ${session.token}` } }
    }
    const admin = await account("admin", "ADMIN")
    const sa = await account("sa", "SUPERADMIN")
    const staff = await account("reader")
    async function member(
      id: string,
      departmentId: string,
      position: string | null = null,
    ) {
      const person = await account(id)
      await prisma.user.update({
        where: { id },
        data: { departmentId, position },
      })
      await prisma.employee.create({
        data: {
          id: `employee-${id}`,
          employeeId: `EXP-${id}`,
          userId: id,
          fullName: `${id} Person`,
          departmentId,
          position,
        },
      })
      return person
    }
    async function request(
      path: string,
      method = "GET",
      body?: unknown,
      actor = admin,
    ) {
      return fetch(`${base}${path}`, {
        method,
        headers: { ...actor.headers, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    }
    async function snapshot() {
      return {
        users: await prisma.user.findMany({ orderBy: { id: "asc" } }),
        employees: await prisma.employee.findMany({ orderBy: { id: "asc" } }),
        departments: await prisma.department.findMany({
          orderBy: { id: "asc" },
        }),
        teams: await prisma.team.findMany({ orderBy: { id: "asc" } }),
      }
    }
    const staleDepartment = await prisma.department.create({
      data: { id: "stale", name: "Stale data" },
    })
    await member("head", staleDepartment.id, "Department Head")
    await member("stale-title", staleDepartment.id, "  dEPt   HEAD ")
    const orphan = await account("orphan-title")
    await prisma.user.update({
      where: { id: orphan.user.id },
      data: { departmentId: staleDepartment.id, position: "Department Head" },
    })
    const team = await prisma.team.create({
      data: { name: "Legacy team", departmentId: staleDepartment.id },
    })
    await prisma.department.update({
      where: { id: staleDepartment.id },
      data: { headId: "head" },
    })
    await prisma.user.update({
      where: { id: "head" },
      data: { teamId: team.id },
    })
    await prisma.employee.update({
      where: { id: "employee-head" },
      data: { teamId: team.id },
    })

    await t.test(
      "repeated list/detail/candidate reads preserve every HR row and timestamp, including stale records",
      async () => {
        const before = await snapshot()
        for (const actor of [admin, sa]) {
          for (let repeat = 0; repeat < 2; repeat++) {
            for (const path of [
              "/departments",
              "/departments/stale",
              "/departments/eligible-heads",
              "/departments/employee-options",
            ]) {
              const response = await request(path, "GET", undefined, actor)
              assert.equal(response.status, 200, await response.text())
            }
          }
        }
        assert.deepEqual(await snapshot(), before)
        assert.equal(
          await prisma.employee.count({ where: { userId: orphan.user.id } }),
          0,
        )
      },
    )

    await t.test(
      "department GETs succeed when the database rejects all HR INSERT/UPDATE/DELETE operations",
      async () => {
        await prisma.user.update({
          where: { id: "stale-title" },
          data: { position: "Department Head" },
        })
        await db.exec(`
      CREATE FUNCTION reject_hr_read_writes() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'GET must not write HR'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER reject_hr_read_writes BEFORE INSERT OR UPDATE OR DELETE ON "User" FOR EACH ROW EXECUTE FUNCTION reject_hr_read_writes();
      CREATE TRIGGER reject_hr_read_writes BEFORE INSERT OR UPDATE OR DELETE ON "Employee" FOR EACH ROW EXECUTE FUNCTION reject_hr_read_writes();
      CREATE TRIGGER reject_hr_read_writes BEFORE INSERT OR UPDATE OR DELETE ON "Department" FOR EACH ROW EXECUTE FUNCTION reject_hr_read_writes();
      CREATE TRIGGER reject_hr_read_writes BEFORE INSERT OR UPDATE OR DELETE ON "Team" FOR EACH ROW EXECUTE FUNCTION reject_hr_read_writes();
    `)
        try {
          for (const path of [
            "/departments",
            "/departments/stale",
            "/departments/eligible-heads",
            "/departments/employee-options",
          ])
            assert.equal((await request(path)).status, 200, path)
          assert.equal((await request("/departments/missing")).status, 404)
          assert.equal(
            (await request("/departments", "GET", undefined, staff)).status,
            200,
          )
          assert.equal(
            (await request("/departments/stale", "GET", undefined, staff))
              .status,
            403,
          )
        } finally {
          await db.exec(`
        DROP TRIGGER reject_hr_read_writes ON "User";
        DROP TRIGGER reject_hr_read_writes ON "Employee";
        DROP TRIGGER reject_hr_read_writes ON "Department";
        DROP TRIGGER reject_hr_read_writes ON "Team";
        DROP FUNCTION reject_hr_read_writes();
      `)
        }
      },
    )

    async function leadershipFixture(prefix: string) {
      const department = await prisma.department.create({
        data: { id: prefix, name: prefix },
      })
      await member(`${prefix}-original`, prefix, "Department Head")
      await member(`${prefix}-deputy`, prefix)
      await member(`${prefix}-third`, prefix)
      await prisma.department.update({
        where: { id: prefix },
        data: { headId: `${prefix}-original` },
      })
      return department
    }
    async function leave(prefix: string) {
      const response = await request(
        `/employees/employee-${prefix}-original`,
        "PUT",
        {
          status: "ON_LEAVE",
          replacementHeadEmployeeId: `employee-${prefix}-deputy`,
        },
      )
      assert.equal(response.status, 200, await response.text())
      const title = await request(
        `/employees/employee-${prefix}-deputy`,
        "PUT",
        { position: "Dept Head" },
      )
      assert.equal(title.status, 200, await title.text())
    }
    async function positions(id: string) {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id },
        include: { employee: true },
      })
      return [user.position, user.employee?.position]
    }

    await t.test(
      "restoration clears the displaced deputy's title inside the Employee status transaction",
      async () => {
        await leadershipFixture("restore")
        await leave("restore")
        const response = await request(
          "/employees/employee-restore-original",
          "PUT",
          { status: "ACTIVE" },
        )
        assert.equal(response.status, 200, await response.text())
        assert.deepEqual(await positions("restore-deputy"), [null, null])
        assert.deepEqual(await positions("restore-original"), [
          "Department Head",
          "Department Head",
        ])
        const department = await prisma.department.findUniqueOrThrow({
          where: { id: "restore" },
        })
        assert.equal(department.headId, "restore-original")
        assert.equal(department.temporaryHeadOriginalId, null)
      },
    )

    await t.test(
      "manual replacement/removal clears current and tracked former titles without a GET",
      async () => {
        await leadershipFixture("manual")
        await leave("manual")
        const replace = await request(
          "/departments/manual",
          "PUT",
          { headId: "manual-third" },
          sa,
        )
        assert.equal(replace.status, 200, await replace.text())
        assert.deepEqual(await positions("manual-original"), [null, null])
        assert.deepEqual(await positions("manual-deputy"), [null, null])
        assert.equal(
          (
            await request("/employees/employee-manual-third", "PUT", {
              position: "Department Head",
            })
          ).status,
          200,
        )
        assert.equal(
          (await request("/departments/manual", "PUT", { headId: null }))
            .status,
          200,
        )
        assert.deepEqual(await positions("manual-third"), [null, null])
      },
    )

    await t.test(
      "nested temporary handoff preserves only the original's reserved Head title",
      async () => {
        await leadershipFixture("nested")
        await leave("nested")
        const response = await request(
          "/employees/employee-nested-deputy",
          "PUT",
          {
            status: "ON_LEAVE",
            replacementHeadEmployeeId: "employee-nested-third",
          },
        )
        const payload = (await response.json()) as {
          employee: { position: string | null }
        }
        assert.equal(response.status, 200, JSON.stringify(payload))
        assert.equal(payload.employee.position, null)
        assert.deepEqual(await positions("nested-deputy"), [null, null])
        assert.deepEqual(await positions("nested-original"), [
          "Department Head",
          "Department Head",
        ])
        const department = await prisma.department.findUniqueOrThrow({
          where: { id: "nested" },
        })
        assert.equal(department.headId, "nested-third")
        assert.equal(department.temporaryHeadOriginalId, "nested-original")
      },
    )

    await t.test(
      "a failed displaced-title write rolls back the complete restoration",
      async () => {
        await leadershipFixture("rollback")
        await leave("rollback")
        const before = await snapshot()
        await db.exec(`
      CREATE FUNCTION reject_displaced_title() RETURNS trigger AS $$
      BEGIN IF OLD.id = 'rollback-deputy' AND NEW.position IS NULL THEN RAISE EXCEPTION 'Injected title write failure'; END IF; RETURN NEW; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER reject_displaced_title BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION reject_displaced_title();
    `)
        try {
          assert.equal(
            (
              await request("/employees/employee-rollback-original", "PUT", {
                status: "ACTIVE",
              })
            ).status,
            500,
          )
          assert.deepEqual(await snapshot(), before)
        } finally {
          await db.exec(
            'DROP TRIGGER reject_displaced_title ON "User"; DROP FUNCTION reject_displaced_title();',
          )
        }
      },
    )

    await t.test(
      "explicit Head assignment synchronizes teams, preserves eligibility and rolls back on failure",
      async () => {
        await leadershipFixture("teams")
        const subteam = await prisma.team.create({
          data: { name: "Subteam", departmentId: "teams" },
        })
        for (const id of ["teams-original", "teams-deputy", "teams-third"]) {
          await prisma.user.update({
            where: { id },
            data: { teamId: subteam.id },
          })
          await prisma.employee.update({
            where: { userId: id },
            data: { teamId: subteam.id },
          })
        }
        // An explicit administrative save, not a GET, corrects the legacy current Head.
        assert.equal(
          (
            await request("/departments/teams", "PUT", {
              headId: "teams-original",
            })
          ).status,
          200,
        )
        assert.equal(
          (
            await prisma.user.findUniqueOrThrow({
              where: { id: "teams-original" },
            })
          ).teamId,
          null,
        )
        assert.equal(
          (
            await prisma.employee.findUniqueOrThrow({
              where: { userId: "teams-original" },
            })
          ).teamId,
          null,
        )
        assert.equal(
          (
            await request("/departments/teams", "PUT", {
              headId: "teams-deputy",
            })
          ).status,
          200,
        )
        assert.equal(
          (
            await prisma.user.findUniqueOrThrow({
              where: { id: "teams-deputy" },
            })
          ).teamId,
          null,
        )
        assert.equal(
          (
            await prisma.employee.findUniqueOrThrow({
              where: { userId: "teams-deputy" },
            })
          ).teamId,
          null,
        )
        assert.deepEqual(await positions("teams-original"), [null, null])
        assert.equal(
          (
            await request("/employees/employee-teams-deputy", "PUT", {
              teamId: subteam.id,
            })
          ).status,
          400,
        )
        assert.equal(
          (
            await request("/departments/teams/teams", "POST", {
              name: "Invalid team",
              memberIds: ["employee-teams-deputy"],
            })
          ).status,
          400,
        )
        assert.equal(
          (
            await request("/employees/employee-teams-deputy", "PUT", {
              position: "Department Head",
            })
          ).status,
          200,
        )
        const before = await snapshot()
        await db.exec(`
      CREATE FUNCTION reject_head_sync() RETURNS trigger AS $$
      BEGIN IF OLD."userId" = 'teams-third' THEN RAISE EXCEPTION 'Injected Employee sync failure'; END IF; RETURN NEW; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER reject_head_sync BEFORE UPDATE ON "Employee" FOR EACH ROW EXECUTE FUNCTION reject_head_sync();
    `)
        try {
          assert.equal(
            (
              await request("/departments/teams", "PUT", {
                headId: "teams-third",
              })
            ).status,
            500,
          )
          assert.deepEqual(await snapshot(), before)
        } finally {
          await db.exec(
            'DROP TRIGGER reject_head_sync ON "Employee"; DROP FUNCTION reject_head_sync();',
          )
        }
      },
    )

    await t.test(
      "concurrent reads and head replacements finish with consistent assignments",
      async () => {
        await leadershipFixture("parallel")
        const outcomes = await Promise.all([
          request("/departments/parallel"),
          request("/departments/parallel", "PUT", {
            headId: "parallel-deputy",
          }),
          request("/departments/parallel"),
          request("/departments/parallel", "PUT", { headId: "parallel-third" }),
          request("/departments/parallel"),
        ])
        for (const response of outcomes)
          assert.equal(response.status, 200, await response.text())
        const department = await prisma.department.findUniqueOrThrow({
          where: { id: "parallel" },
        })
        assert.ok(
          ["parallel-deputy", "parallel-third"].includes(department.headId!),
        )
        const head = await prisma.user.findUniqueOrThrow({
          where: { id: department.headId! },
          include: { employee: true },
        })
        assert.equal(head.departmentId, department.id)
        assert.equal(head.teamId, null)
        assert.equal(head.employee?.teamId, null)
        assert.deepEqual(await positions("parallel-original"), [null, null])
        const before = await snapshot()
        assert.equal((await request("/departments/parallel")).status, 200)
        assert.deepEqual(await snapshot(), before)
      },
    )
  },
)
