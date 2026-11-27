import assert from "node:assert/strict"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { applyMigrations } from "../../support/pglite-app.js"
import { getPrisma, disconnectPrisma } from "../../../src/lib/db.js"
import { bootstrapShowcase } from "../../../prisma/seed/showcase-phase2-foundation.js"
import { seedShowcase } from "../../../prisma/seed/showcase-core.js"
import { seedShowcaseProjects } from "../../../prisma/seed/showcase-projects.js"
import {
  getProjectWorkspace,
  updateProjectTask,
  updateProjectWorkspaceStatus,
} from "../../../src/features/project-workspace/project-workspace.service.js"
import { authService } from "../../../src/features/auth/auth.service.js"
import { verifyAccessToken } from "../../../src/features/auth/auth.jwt.js"
import { seedShowcaseCompensation } from "../../../prisma/seed/showcase-payroll.js"
import { randomBytes } from "node:crypto"
import { listClientProjects } from "../../../src/features/projects/projects.service.js"
import { showcaseId } from "../../../prisma/seed/showcase-plan.js"
import { seedPayrollDashboard } from "../../../prisma/seed/showcase-payroll-dashboard.js"
import { readPayrollOverview } from "../../../src/features/payroll/payroll-overview.service.js"
import { seedShowcaseWorkload } from "../../../prisma/seed/showcase-workload.js"
import { seedFeaturedShowcase } from "../../../prisma/seed/showcase-featured.js"
import { seedFeaturedDeliverables } from "../../../prisma/seed/showcase-deliverables.js"
import { seedShowcaseOnHold } from "../../../prisma/seed/showcase-status.js"
import { seedFinalShowcaseStaff } from "../../../prisma/seed/showcase-final-staff.js"

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
    const workload = await seedShowcaseWorkload(
      "showcase-bootstrap-head",
      "2026-11-23",
    )
    assert.equal(workload.createdCapacities, 8)
    assert.equal(workload.updatedAllocations, 16)
    assert.deepEqual(
      await seedShowcaseWorkload("showcase-bootstrap-head", "2026-11-23"),
      {
        createdCapacities: 0,
        updatedAllocations: 0,
        skippedCapacities: 8,
        skippedAllocations: 16,
      },
    )
    await prisma.user.update({
      where: { id: "showcase-bootstrap-head" },
      data: { email: "advertising.head@local.test" },
    })
    const expectedRefinement = {
      skillsUpdated: 20,
      skillsSkipped: 0,
      capacitiesCreated: 12,
      capacitiesSkipped: 8,
    }
    assert.deepEqual(
      await seedFinalShowcaseStaff("showcase-bootstrap-head", "2026-11-23"),
      expectedRefinement,
    )
    assert.deepEqual(
      await seedFinalShowcaseStaff(
        "showcase-bootstrap-head",
        "2026-11-23",
        true,
      ),
      expectedRefinement,
    )
    assert.deepEqual(
      await seedFinalShowcaseStaff(
        "showcase-bootstrap-head",
        "2026-11-23",
        true,
      ),
      {
        skillsUpdated: 0,
        skillsSkipped: 20,
        capacitiesCreated: 0,
        capacitiesSkipped: 20,
      },
    )
    await prisma.user.update({
      where: { id: "showcase-bootstrap-head" },
      data: { email: "head@showcase.invalid" },
    })
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
    assert.deepEqual(await seedShowcaseOnHold("showcase-bootstrap-head"), {
      placedOnHold: 2,
      skipped: 0,
    })
    assert.deepEqual(await seedShowcaseOnHold("showcase-bootstrap-head"), {
      placedOnHold: 0,
      skipped: 2,
    })
    assert.deepEqual(
      await seedShowcaseProjects("showcase-bootstrap-head"),
      boards,
    )
    await updateProjectWorkspaceStatus(
      "showcase-bootstrap-head",
      boards[1]!.workspaceId,
      "RESUME",
    )
    assert.deepEqual(await seedShowcaseOnHold("showcase-bootstrap-head"), {
      placedOnHold: 0,
      skipped: 2,
    })
    assert.equal(
      (
        await getProjectWorkspace(
          "showcase-bootstrap-head",
          boards[1]!.workspaceId,
        )
      ).workstreams[0]?.status,
      "IN_PROGRESS",
    )
    assert.equal(await prisma.workflowActionReceipt.count(), 16)
    const featured = await seedFeaturedShowcase("showcase-bootstrap-head")
    const featuredWorkspace = await getProjectWorkspace(
      "showcase-bootstrap-head",
      featured.workspaceId,
    )
    const featuredTasks = featuredWorkspace.workstreams.flatMap(
      (stream) => stream.plan?.phases.flatMap((phase) => phase.tasks) ?? [],
    )
    assert.equal(featuredTasks.length, 24)
    assert.equal(
      featuredTasks.filter((task) => task.status === "DONE").length,
      14,
    )
    assert.equal(featuredWorkspace.workstreams[0]?.staff?.length, 6)
    assert.equal(
      featuredWorkspace.workstreams[0]?.staff?.filter(
        (person) => person.isTeamLead,
      ).length,
      1,
    )
    assert.equal(featuredWorkspace.workstreams[0]?.milestones?.length, 6)
    assert.equal(featuredWorkspace.kanbanAssignments.length, 3)
    const movedTask = featuredWorkspace.kanbanAssignments[0]!
    const afterMove = await updateProjectTask(
      "showcase-bootstrap-head",
      featured.workspaceId,
      featured.projectId,
      movedTask.taskId,
      "IN_PROGRESS",
      null,
    )
    assert.ok(
      afterMove.kanbanAssignments.every(
        (entry) => entry.taskId !== movedTask.taskId,
      ),
    )
    await assert.rejects(
      () => seedFeaturedShowcase("showcase-bootstrap-head"),
      /showcase task was moved/,
    )
    const afterReturn = await updateProjectTask(
      "showcase-bootstrap-head",
      featured.workspaceId,
      featured.projectId,
      movedTask.taskId,
      "IN_PROGRESS",
      movedTask.columnId,
    )
    assert.equal(afterReturn.kanbanAssignments.length, 3)
    const featuredClientProjects = await listClientProjects(
      showcaseId("user", 22),
    )
    assert.ok(
      featuredClientProjects.some(
        (project) =>
          project.id === featured.projectId &&
          project.completedTasks === 14 &&
          project.taskCount === 24,
      ),
    )
    const otherClientProjects = await listClientProjects(showcaseId("user", 23))
    assert.ok(
      otherClientProjects.every((project) => project.id !== featured.projectId),
    )
    assert.deepEqual(
      await seedFeaturedShowcase("showcase-bootstrap-head"),
      featured,
    )
    await seedFeaturedDeliverables(
      "showcase-bootstrap-head",
      featured.workspaceId,
      featured.projectId,
    )
    const actualDeliverables = await prisma.projectMilestone.findMany({
      where: { projectId: featured.projectId },
      orderBy: { displayOrder: "asc" },
      include: { workflowFile: true },
    })
    assert.deepEqual(
      actualDeliverables.map((item) => item.deliveryStatus),
      [
        "SENT_TO_CLIENT",
        "APPROVED",
        "IN_REVIEW",
        "NOT_SUBMITTED",
        "NOT_SUBMITTED",
        "NOT_SUBMITTED",
      ],
    )
    assert.ok(actualDeliverables[0]?.workflowFile?.clientVisible)
    const filesBefore = await prisma.workflowFile.count({
      where: { requestId: featured.requestId },
    })
    await seedFeaturedDeliverables(
      "showcase-bootstrap-head",
      featured.workspaceId,
      featured.projectId,
    )
    assert.equal(
      await prisma.workflowFile.count({
        where: { requestId: featured.requestId },
      }),
      filesBefore,
    )
    await prisma.user.update({
      where: { id: showcaseId("user", 22) },
      data: { email: "not-showcase@example.test" },
    })
    await assert.rejects(
      () =>
        seedFeaturedDeliverables(
          "showcase-bootstrap-head",
          featured.workspaceId,
          featured.projectId,
        ),
      /expected featured showcase project/,
    )
    await prisma.user.update({
      where: { id: showcaseId("user", 22) },
      data: { email: "client1@showcase.invalid" },
    })
    assert.deepEqual(
      await seedShowcaseWorkload("showcase-bootstrap-head", "2026-11-23"),
      {
        createdCapacities: 0,
        updatedAllocations: 6,
        skippedCapacities: 8,
        skippedAllocations: 16,
      },
    )
    assert.deepEqual(
      await seedShowcaseWorkload("showcase-bootstrap-head", "2026-11-23"),
      {
        createdCapacities: 0,
        updatedAllocations: 0,
        skippedCapacities: 8,
        skippedAllocations: 22,
      },
    )
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
