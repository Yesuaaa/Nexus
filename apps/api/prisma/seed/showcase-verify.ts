import "dotenv/config"
import { getPrisma, disconnectPrisma } from "../../src/lib/db.js"
import { HttpError } from "../../src/shared/http-error.js"
import {
  getProjectWorkspace,
  listProjectWorkspaces,
} from "../../src/features/project-workspace/project-workspace.service.js"
import { getProjectWorkspaceOverview } from "../../src/features/project-workspace/project-workspace-overview.service.js"
import {
  getClientDeliverableFile,
  listClientProjects,
} from "../../src/features/projects/projects.service.js"
import { listClientBookings } from "../../src/features/service-requests/service-requests.service.js"
import { listClientCalendar } from "../../src/features/projects/client-calendar.service.js"
import { listClientInvoices } from "../../src/features/billing/client-invoices.js"
import { readDepartmentWorkload } from "../../src/features/workload/workload-read.service.js"
import { weekValue } from "../../src/features/workload/workload.schema.js"
import { assertPhase2Target } from "./showcase-phase2-foundation.js"
import { showcaseId, showcaseUuid } from "./showcase-plan.js"

async function main() {
  const target = assertPhase2Target(process.env)
  const week = weekValue(process.argv[2])
  if (process.argv.length !== 3 || !process.env.SHOWCASE_HEAD_EMAIL)
    throw new Error("Choose the confirmed head and week")
  const db = getPrisma()
  if (!db) throw new Error("Database configuration is required")
  try {
    const [connected] = await db.$queryRaw<
      { name: string }[]
    >`SELECT current_database() AS name`
    if (connected?.name !== target.database)
      throw new Error("Connected database does not match confirmed target")
    const head = await db.user.findFirstOrThrow({
      where: {
        email: process.env.SHOWCASE_HEAD_EMAIL,
        role: "STAFF",
        isActive: true,
        accountDeletedAt: null,
      },
      select: { id: true, email: true },
    })
    const department = await db.department.findFirstOrThrow({
      where: { headId: head.id },
      select: { id: true, headId: true },
    })
    const project = await db.project.findFirstOrThrow({
      where: {
        clientId: showcaseId("user", 22),
        request: {
          submissionKey: showcaseUuid("featured-request", 0),
          acceptedDepartmentId: department.id,
        },
      },
      select: { id: true, workspaceGroupId: true },
    })
    const workspaceId = project.workspaceGroupId
      ? `group:${project.workspaceGroupId}`
      : `ungrouped-project:${project.id}`
    const [
      workspace,
      overview,
      directory,
      clientProjects,
      otherClientProjects,
      bookings,
      calendar,
      invoices,
      workload,
    ] = await Promise.all([
      getProjectWorkspace(head.id, workspaceId),
      getProjectWorkspaceOverview(head.id),
      listProjectWorkspaces(head.id),
      listClientProjects(showcaseId("user", 22)),
      listClientProjects(showcaseId("user", 23)),
      listClientBookings(showcaseId("user", 22), {
        page: 1,
        search: "",
        status: "",
      }),
      listClientCalendar(showcaseId("user", 22)),
      listClientInvoices(showcaseId("user", 22)),
      db.$transaction((tx) => readDepartmentWorkload(tx, department, week)),
    ])
    const featured = clientProjects.find((item) => item.id === project.id)
    if (!featured || otherClientProjects.some((item) => item.id === project.id))
      throw new Error("Client isolation verification failed")
    const stream = workspace.workstreams.find((item) => item.id === project.id)
    if (!stream)
      throw new Error("The department head cannot read the featured project")
    const tasks = stream.plan?.phases.flatMap((phase) => phase.tasks) ?? []
    const staffIds = new Set((stream.staff ?? []).map((member) => member.id))
    const taskMap = new Map(tasks.map((task) => [task.id, task]))
    const columnIds = new Set(
      workspace.kanbanColumns.map((column) => column.id),
    )
    const assignmentsValid =
      workspace.kanbanAssignments.every(
        (assignment) =>
          assignment.projectId === project.id &&
          columnIds.has(assignment.columnId) &&
          taskMap.get(assignment.taskId)?.status === "IN_PROGRESS",
      ) &&
      tasks.every((task) => !task.employeeId || staffIds.has(task.employeeId))
    if (!assignmentsValid)
      throw new Error("Task or board ownership verification failed")
    const sent = stream.milestones?.find(
      (item) => item.deliveryStatus === "SENT_TO_CLIENT",
    )
    let ownerDownload = false,
      otherClientDenied = false
    if (sent) {
      ownerDownload =
        (
          await getClientDeliverableFile(
            showcaseId("user", 22),
            project.id,
            sent.id,
          )
        ).size > 0
      try {
        await getClientDeliverableFile(
          showcaseId("user", 23),
          project.id,
          sent.id,
        )
      } catch (error) {
        if (!(error instanceof HttpError) || ![403, 404].includes(error.status))
          throw error
        otherClientDenied = true
      }
    }
    if (!sent || !ownerDownload || !otherClientDenied)
      throw new Error("Client file isolation verification failed")
    const staff = workload
      .filter(
        (item) =>
          item.id.startsWith("showcase-2026-employee-") &&
          Number(item.id.slice(-3)) < 8,
      )
      .map((item) => ({
        name: item.fullName,
        capacity: item.capacity?.scheduledHours ?? null,
        timeOff: item.capacity?.timeOffHours ?? null,
        assignedKnown: item.assignments.reduce(
          (sum, assignment) => sum + (assignment.weeklyHours ?? 0),
          0,
        ),
        unknownAssignments: item.assignments.filter(
          (assignment) => assignment.weeklyHours === null,
        ).length,
      }))
    console.log(
      JSON.stringify({
        database: target.database,
        head: head.email,
        clientLogin: "client1@showcase.invalid",
        week,
        workspaceId,
        project: {
          id: project.id,
          name: workspace.name,
          phases: stream.plan?.phases.map((phase) => ({
            name: phase.title,
            tasks: phase.tasks.length,
          })),
          taskStatuses: {
            done: tasks.filter((task) => task.status === "DONE").length,
            inProgress: tasks.filter((task) => task.status === "IN_PROGRESS")
              .length,
            notStarted: tasks.filter((task) => task.status === "NOT_STARTED")
              .length,
          },
          reviewColumnTasks: workspace.kanbanAssignments.length,
          team: stream.staff?.length,
          leads: stream.staff?.filter((member) => member.isTeamLead).length,
          deliverables: stream.milestones?.map((item) => item.deliveryStatus),
          activity: workspace.activity.length,
          assignmentsValid,
        },
        overview: {
          totals: overview.totals,
          clients: overview.clientDistribution.length,
          workspaces: directory.workspaces.length,
        },
        client: {
          activeProjects: clientProjects.filter(
            (item) => item.status === "IN_PROGRESS",
          ).length,
          bookings: bookings.total,
          lastService: bookings.serviceRequests[0]?.service.name ?? null,
          upcomingConsultations: calendar.filter(
            (item) =>
              item.type === "consultation" &&
              !item.completed &&
              item.startsAt &&
              item.startsAt > new Date(),
          ).length,
          invoices: invoices.length,
          featuredCompleted: featured.completedTasks,
          featuredTasks: featured.taskCount,
          featuredMembers: featured.memberCount,
          visibleDeliverables: featured.deliverableCount,
          otherClientSeesFeatured: false,
          ownerDownload,
          otherClientDenied,
        },
        workload: staff,
      }),
    )
  } finally {
    await disconnectPrisma()
  }
}
main().catch(() => {
  console.error(
    "Showcase verification failed. Check target and showcase prerequisites.",
  )
  process.exitCode = 1
})
