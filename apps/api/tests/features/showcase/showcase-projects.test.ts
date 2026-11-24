import assert from "node:assert/strict"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { applyMigrations } from "../../support/pglite-app.js"
import { getPrisma, disconnectPrisma } from "../../../src/lib/db.js"
import { bootstrapShowcase } from "../../../prisma/seed/showcase-phase2-foundation.js"
import { seedShowcase } from "../../../prisma/seed/showcase-core.js"
import { seedShowcaseProjects } from "../../../prisma/seed/showcase-projects.js"
import { getProjectWorkspace } from "../../../src/features/project-workspace/project-workspace.service.js"
import { authService } from "../../../src/features/auth/auth.service.js"
import { verifyAccessToken } from "../../../src/features/auth/auth.jwt.js"
import { seedShowcaseCompensation } from "../../../prisma/seed/showcase-payroll.js"
import { randomBytes } from "node:crypto"
import { listClientProjects } from "../../../src/features/projects/projects.service.js"
import { showcaseId } from "../../../prisma/seed/showcase-plan.js"
import { seedPayrollDashboard } from "../../../prisma/seed/showcase-payroll-dashboard.js"
import { readPayrollOverview } from "../../../src/features/payroll/payroll-overview.service.js"

test(
  "showcase workflows produce repeatable staffed boards and payroll",
  { timeout: 120_000 },
  async (t) => {
    const original = { ...process.env }
    const initial = new PGlite()
    await initial.exec("CREATE DATABASE nexus_showcase")
    const dump = await initial.dumpDataDir()
    await initial.close()
    const db = new PGlite({ loadDataDir: dump, database: "nexus_showcase" })
    await db.waitReady
    await applyMigrations(db)
    const socket = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" })
    await socket.start()
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/nexus_showcase?sslmode=disable`
    process.env.NODE_ENV = "development"
    process.env.SHOWCASE_CONFIRM_TARGET = "nexus_showcase"
    process.env.DATABASE_POOL_MAX = "1"
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    process.env.PAYROLL_LOCAL_SIMULATOR = "true"
    delete process.env.DIRECT_URL
    t.after(async () => {
      await disconnectPrisma()
      await socket.stop()
      await db.close()
      for (const key of [
        "DATABASE_URL",
        "DIRECT_URL",
        "NODE_ENV",
        "SHOWCASE_CONFIRM_TARGET",
        "DATABASE_POOL_MAX",
        "JWT_SECRET",
        "PAYROLL_LOCAL_SIMULATOR",
      ]) {
        if (original[key] === undefined) delete process.env[key]
        else process.env[key] = original[key]
      }
    })
    const prisma = getPrisma()!
    await bootstrapShowcase(prisma, "IllustrativeStrongPass1!")
    await seedShowcase(prisma, "IllustrativeStrongPass1!")
    const boards = await seedShowcaseProjects("showcase-bootstrap-head")
    assert.equal(boards.length, 4)
    for (const board of boards) {
      const project = await prisma.project.findUniqueOrThrow({
        where: { id: board.projectId },
        include: { staff: true, request: { include: { workflow: true } } },
      })
      assert.equal(project.status, "IN_PROGRESS")
      assert.equal(project.request?.workflow?.state, "ACTIVE_PROJECT")
      assert.equal(project.staff.length, 4)
      const workspace = await getProjectWorkspace(
        "showcase-bootstrap-head",
        board.workspaceId,
      )
      assert.equal(workspace.canManage, true)
      assert.equal(workspace.kanbanAssignments.length, 3)
      assert.equal(workspace.kanbanColumns[0]?.name, "Revisions")
    }
    const aveloraProjects = await listClientProjects(showcaseId("user", 22))
    const avelora = aveloraProjects.find(
      (project) => project.name === "Avelora Product Photography",
    )
    assert.ok(avelora)
    assert.equal(
      aveloraProjects.filter((project) => project.status === "IN_PROGRESS")
        .length,
      3,
    )
    assert.equal(avelora.status, "IN_PROGRESS")
    assert.equal(avelora.completedTasks, 4)
    assert.equal(avelora.taskCount, 16)
    assert.equal(avelora.memberCount, 4)
    assert.deepEqual(
      await seedShowcaseProjects("showcase-bootstrap-head"),
      boards,
    )
    assert.equal(await prisma.workflowActionReceipt.count(), 16)
    const login = await authService.login({
      email: "operations@showcase.invalid",
      password: "IllustrativeStrongPass1!",
    })
    const claims = await verifyAccessToken(login.token)
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: claims.userId },
    })
    const auth = { user, sessionId: claims.sessionId }
    assert.deepEqual(await seedShowcaseCompensation(auth), {
      employees: 20,
      created: 20,
    })
    assert.deepEqual(await seedShowcaseCompensation(auth), {
      employees: 20,
      created: 0,
    })
    assert.equal(await prisma.employeeCompensation.count(), 40)
    for (const [index, email] of [
      "demo.staff@example.test",
      "local-head@example.test",
      "advertising.head@local.test",
    ].entries()) {
      await prisma.user.create({
        data: {
          email,
          role: "STAFF",
          passwordHash: "test",
          employee: {
            create: {
              employeeId: `LOCAL-TEST-${index}`,
              fullName: `Local Test ${index}`,
            },
          },
        },
      })
    }
    const payroll = await seedPayrollDashboard("IllustrativeStrongPass1!")
    assert.equal(payroll.runs.length, 6)
    const overview = await readPayrollOverview(6)
    assert.equal(overview.approvedRuns, 2)
    assert.equal(overview.pendingApprovals, 1)
    assert.equal(overview.trend.length, 2)
    assert.equal(overview.realConfirmedPaid, "0.00")
    assert.ok(overview.payoutCounts.SUCCEEDED > 0)
    assert.ok(overview.payoutCounts.FAILED > 0)
    assert.ok(overview.payoutCounts.PENDING > 0)
    assert.deepEqual(
      await seedPayrollDashboard("IllustrativeStrongPass1!"),
      payroll,
    )
    const enriched = await seedPayrollDashboard(
      "IllustrativeStrongPass1!",
      true,
    )
    const enrichedOverview = await readPayrollOverview(6)
    assert.equal(enrichedOverview.approvedRuns, 4)
    assert.equal(enrichedOverview.pendingApprovals, 1)
    assert.equal(enrichedOverview.trend.length, 4)
    assert.ok(
      new Set(enrichedOverview.trend.map((period) => period.net)).size >= 3,
    )
    assert.deepEqual(
      await seedPayrollDashboard("IllustrativeStrongPass1!", true),
      enriched,
    )
    assert.deepEqual(
      await seedPayrollDashboard("IllustrativeStrongPass1!"),
      enriched,
    )
  },
)
