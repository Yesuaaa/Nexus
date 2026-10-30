import { Prisma, type WorkAssignment } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import {
  calculateCapacity,
  calendarDays,
  overlaps,
  scheduledWindows,
  type Interval,
} from "./calculation.js"
import {
  check,
  id,
  object,
  period,
  scheduleInput,
  skills,
  text,
  workInput,
  WorkloadError,
} from "./validation.js"

type DB = Prisma.TransactionClient
type WorkInput = ReturnType<typeof workInput>
const departmentSelect = { id: true, name: true } as const
const assignmentInclude = {
  serviceRequest: { select: { id: true, title: true, status: true } },
  project: { select: { id: true, name: true, status: true } },
  task: {
    select: {
      id: true,
      title: true,
      completed: true,
      project: { select: { id: true, name: true, status: true } },
    },
  },
  ownerDepartment: { select: departmentSelect },
} as const
const employeeSelect = {
  id: true,
  employeeId: true,
  fullName: true,
  position: true,
  employmentType: true,
  status: true,
  startDate: true,
  skills: true,
  department: { select: departmentSelect },
  departmentId: true,
  workingSchedule: true,
  commitments: { orderBy: { startsAt: "asc" as const } },
  workAssignments: {
    include: assignmentInclude,
    orderBy: { startsAt: "asc" as const },
  },
} as const
type Employee = Prisma.EmployeeGetPayload<{ select: typeof employeeSelect }>

async function scope(db: DB, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true, accountDeletedAt: true },
  })
  check(
    user?.isActive &&
      !user.accountDeletedAt &&
      (user.role === "ADMIN" || user.role === "STAFF"),
    "Department manager access is required",
    403,
  )
  const department = await db.department.findFirst({
    where: { headId: userId },
    select: departmentSelect,
  })
  check(department, "You must be the current head of a department", 403)
  return department
}

async function transaction<T>(
  userId: string,
  action: (db: DB, department: { id: string; name: string }) => Promise<T>,
) {
  const prisma = getPrisma()
  check(prisma, "Database unavailable", 503)
  return prisma.$transaction(
    async (db) => action(db, await scope(db, userId)),
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 20_000,
    },
  )
}

function effectiveEmployee(employee: Employee) {
  return {
    ...employee,
    workAssignments: employee.workAssignments.map((a) => ({
      ...a,
      pending:
        a.serviceRequest?.status === "PENDING" ||
        a.project?.status === "PLANNED" ||
        a.task?.project.status === "PLANNED",
      status:
        a.status === "CONFIRMED" &&
        (a.task?.completed ||
          [
            a.serviceRequest?.status,
            a.project?.status,
            a.task?.project.status,
          ].some((status) => status === "COMPLETED" || status === "CANCELLED"))
          ? "COMPLETED"
          : a.status,
    })),
  }
}
async function employeeInScope(
  db: DB,
  employeeId: string,
  departmentId: string,
  lock = false,
) {
  if (lock)
    await db.$queryRaw`SELECT "id" FROM "Employee" WHERE "id" = ${employeeId} FOR UPDATE`
  const employee = await db.employee.findFirst({
    where: { id: employeeId, departmentId },
    select: employeeSelect,
  })
  check(employee, "Employee not found in your department", 404)
  return effectiveEmployee(employee)
}
function summary(
  employee: ReturnType<typeof effectiveEmployee>,
  range: Interval,
) {
  return {
    id: employee.id,
    employeeId: employee.employeeId,
    fullName: employee.fullName,
    position: employee.position,
    employmentType: employee.employmentType,
    employeeStatus: employee.status,
    skills: employee.skills,
    department: employee.department,
    ...calculateCapacity(employee, range),
  }
}

// Ownership is derived from the actual request's service or project's department
// membership. A manager cannot grant themselves access by submitting an arbitrary ID.
async function target(
  db: DB,
  input: Pick<WorkInput, "serviceRequestId" | "projectId" | "taskId">,
  departmentId: string,
) {
  if (input.serviceRequestId) {
    const item = await db.serviceRequest.findFirst({
      where: {
        id: input.serviceRequestId,
        service: { departments: { some: { id: departmentId } } },
      },
      select: { status: true },
    })
    check(item, "Service request is outside your department", 404)
    check(
      item.status === "PENDING" || item.status === "IN_PROGRESS",
      "Service request is closed",
      409,
    )
  } else {
    const item = input.taskId
      ? await db.projectTask.findFirst({
          where: {
            id: input.taskId,
            project: { departments: { some: { id: departmentId } } },
          },
          select: { completed: true, project: { select: { status: true } } },
        })
      : await db.project.findFirst({
          where: {
            id: input.projectId!,
            departments: { some: { id: departmentId } },
          },
          select: { status: true },
        })
    check(item, "Project or task is outside your department", 404)
    const status = "project" in item ? item.project.status : item.status
    check(
      status !== "COMPLETED" &&
        status !== "CANCELLED" &&
        !("completed" in item && item.completed),
      "Project or task is closed",
      409,
    )
  }
}

function ensureAssignable(employee: Employee, input: WorkInput) {
  check(
    input.startsAt >= new Date(),
    "Assignments must start in the future",
    409,
  )
  check(employee.status === "ACTIVE", "Employee is unavailable", 409)
  check(
    !employee.startDate ||
      new Date(+input.startsAt + 8 * 3_600_000).toISOString().slice(0, 10) >=
        new Date(+employee.startDate + 8 * 3_600_000)
          .toISOString()
          .slice(0, 10),
    "The block cannot start before the employee's employment start date",
    409,
  )
  check(
    input.requiredSkills.every((skill) =>
      employee.skills.some(
        (recorded) => recorded.toLowerCase() === skill.toLowerCase(),
      ),
    ),
    "Employee does not have all required skills",
    409,
  )
  const window = calculateCapacity(employee, input)
  const scheduledHours = scheduledWindows(
    employee.workingSchedule,
    input,
  ).reduce((sum, w) => sum + (+w.endsAt - +w.startsAt) / 3_600_000, 0)
  check(
    scheduledHours + 0.00001 >= (+input.endsAt - +input.startsAt) / 3_600_000 &&
      window.capacityHours + 0.00001 >= input.estimatedHours,
    "The block must fit within configured working hours and available capacity",
    409,
  )
  check(
    !employee.commitments.some((block) => overlaps(block, input)),
    "The block overlaps leave, an appointment or temporary unavailability",
    409,
  )
  check(
    !employee.workAssignments.some(
      (a) => a.status === "CONFIRMED" && overlaps(a, input),
    ),
    "The block overlaps an existing assignment",
    409,
  )
}

export const workloadService = {
  overview(userId: string, range: Interval) {
    return transaction(userId, async (db, department) => {
      const employees = await db.employee.findMany({
        where: { departmentId: department.id },
        select: employeeSelect,
        orderBy: [{ fullName: "asc" }, { id: "asc" }],
      })
      const staffing = await db.staffingRequest.findMany({
        where: {
          OR: [
            { ownerDepartmentId: department.id },
            { recipientDepartmentId: department.id },
          ],
        },
        include: {
          ...assignmentInclude,
          ownerDepartment: { select: departmentSelect },
          recipientDepartment: { select: departmentSelect },
          assignment: {
            select: {
              id: true,
              employee: { select: { fullName: true } },
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
      return {
        department,
        timezone: "Asia/Manila",
        range,
        employees: employees.map((e) => summary(effectiveEmployee(e), range)),
        staffing,
      }
    })
  },
  detail(userId: string, employeeId: string, range: Interval) {
    return transaction(userId, async (db, department) => {
      const employee = await employeeInScope(db, employeeId, department.id)
      return {
        ...summary(employee, range),
        workingSchedule: employee.workingSchedule,
        calendar: calendarDays(employee, range),
        commitments: employee.commitments.filter((c) => overlaps(c, range)),
        assignments: employee.workAssignments.filter((a) => overlaps(a, range)),
        upcomingBeyondPeriod: employee.workAssignments
          .filter((a) => a.status === "CONFIRMED" && a.startsAt >= range.endsAt)
          .slice(0, 50),
      }
    })
  },
  options(userId: string) {
    return transaction(userId, async (db, department) => {
      const [departments, serviceRequests, projects] = await Promise.all([
        db.department.findMany({
          where: {
            id: { not: department.id },
            headId: { not: null },
            head: {
              isActive: true,
              accountDeletedAt: null,
              role: { in: ["ADMIN", "STAFF"] },
            },
          },
          select: departmentSelect,
          orderBy: { name: "asc" },
        }),
        db.serviceRequest.findMany({
          where: {
            status: { in: ["PENDING", "IN_PROGRESS"] },
            service: { departments: { some: { id: department.id } } },
          },
          select: { id: true, title: true, preferredSpecialistName: true },
          orderBy: { createdAt: "desc" },
        }),
        db.project.findMany({
          where: {
            status: { notIn: ["COMPLETED", "CANCELLED"] },
            departments: { some: { id: department.id } },
          },
          select: {
            id: true,
            name: true,
            tasks: {
              where: { completed: false },
              select: { id: true, title: true },
            },
          },
          orderBy: { name: "asc" },
        }),
      ])
      const actor = await db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { role: true },
      })
      const unallocatedProjects =
        actor.role === "ADMIN"
          ? await db.project.findMany({
              where: {
                departments: { none: {} },
                status: { notIn: ["COMPLETED", "CANCELLED"] },
              },
              select: { id: true, name: true },
              orderBy: { name: "asc" },
            })
          : []
      return { departments, serviceRequests, projects, unallocatedProjects }
    })
  },
  configureProject(userId: string, projectId: string) {
    return transaction(userId, async (db, department) => {
      const actor = await db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { role: true },
      })
      check(
        actor.role === "ADMIN",
        "Only an Admin manager may establish project responsibility",
        403,
      )
      const project = await db.project.findFirst({
        where: {
          id: projectId,
          departments: { none: {} },
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
      })
      check(
        project,
        "Project already has a responsible department or is closed",
        409,
      )
      await db.project.update({
        where: { id: projectId },
        data: { departments: { connect: { id: department.id } } },
      })
      return { saved: true }
    })
  },
  createTask(userId: string, projectId: string, value: unknown) {
    const title = text(object(value).title)
    return transaction(userId, async (db, department) => {
      await target(
        db,
        { projectId, serviceRequestId: null, taskId: null },
        department.id,
      )
      return db.projectTask.create({
        data: { projectId, title },
        select: { id: true, title: true },
      })
    })
  },
  configure(userId: string, employeeId: string, value: unknown) {
    const input = object(value),
      schedule = scheduleInput(input.workingSchedule),
      recordedSkills = skills(input.skills)
    return transaction(userId, async (db, department) => {
      await employeeInScope(db, employeeId, department.id, true)
      await db.workingSchedule.deleteMany({ where: { employeeId } })
      await db.employee.update({
        where: { id: employeeId },
        data: { skills: recordedSkills, workingSchedule: { create: schedule } },
      })
      return { saved: true }
    })
  },
  addCommitment(userId: string, employeeId: string, value: unknown) {
    const input = object(value),
      range = period(input),
      title = text(input.title),
      kind = input.kind
    check(
      kind === "APPOINTMENT" || kind === "LEAVE" || kind === "UNAVAILABLE",
      "Invalid commitment type",
    )
    return transaction(userId, async (db, department) => {
      await employeeInScope(db, employeeId, department.id, true)
      return db.workCommitment.create({
        data: {
          employeeId,
          ...range,
          title,
          kind,
          recordedBy: userId,
          source: "MANUAL",
        },
      })
    })
  },
  removeCommitment(userId: string, employeeId: string, commitmentId: string) {
    return transaction(userId, async (db, department) => {
      await employeeInScope(db, employeeId, department.id, true)
      const result = await db.workCommitment.deleteMany({
        where: { id: commitmentId, employeeId, source: "MANUAL" },
      })
      check(result.count, "Manual commitment not found", 404)
      return { removed: true }
    })
  },
  assign(userId: string, value: unknown) {
    const input = workInput(value),
      employeeId = id(object(value).employeeId)
    return transaction(userId, async (db, department) => {
      await target(db, input, department.id)
      const employee = await employeeInScope(
        db,
        employeeId,
        department.id,
        true,
      )
      ensureAssignable(employee, input)
      return db.workAssignment.create({
        data: {
          ...input,
          employeeId,
          ownerDepartmentId: department.id,
          assignedBy: userId,
        },
      })
    })
  },
  transition(userId: string, assignmentId: string, value: unknown) {
    const status = object(value).status
    check(
      status === "COMPLETED" || status === "CANCELLED",
      "Choose completed or cancelled",
    )
    return transaction(userId, async (db, department) => {
      const assignment = await db.workAssignment.findFirst({
        where: {
          id: assignmentId,
          OR: [
            { ownerDepartmentId: department.id },
            { employee: { departmentId: department.id } },
          ],
        },
      })
      check(assignment, "Assignment not found", 404)
      await db.$queryRaw`SELECT "id" FROM "Employee" WHERE "id" = ${assignment.employeeId} FOR UPDATE`
      const updated = await db.workAssignment.updateMany({
        where: { id: assignmentId, status: "CONFIRMED" },
        data: { status },
      })
      check(updated.count, "Assignment has already been closed", 409)
      return { saved: true }
    })
  },
  requestStaffing(userId: string, value: unknown) {
    const input = workInput(value),
      recipientDepartmentId = id(object(value).recipientDepartmentId)
    return transaction(userId, async (db, department) => {
      check(
        recipientDepartmentId !== department.id,
        "Choose another department",
      )
      check(
        input.startsAt >= new Date(),
        "Staffing requests must start in the future",
        409,
      )
      await target(db, input, department.id)
      const recipient = await db.department.findFirst({
        where: {
          id: recipientDepartmentId,
          head: {
            isActive: true,
            accountDeletedAt: null,
            role: { in: ["ADMIN", "STAFF"] },
          },
        },
      })
      check(recipient, "Recipient department has no authorized manager", 404)
      return db.staffingRequest.create({
        data: {
          ...input,
          ownerDepartmentId: department.id,
          recipientDepartmentId,
          requestedBy: userId,
        },
      })
    })
  },
  decideStaffing(userId: string, requestId: string, value: unknown) {
    const input = object(value),
      decision = input.decision
    check(
      decision === "APPROVED" ||
        decision === "REJECTED" ||
        decision === "CANCELLED",
      "Invalid staffing decision",
    )
    return transaction(userId, async (db, department) => {
      const request = await db.staffingRequest.findFirst({
        where: {
          id: requestId,
          ...(decision === "CANCELLED"
            ? { ownerDepartmentId: department.id }
            : { recipientDepartmentId: department.id }),
        },
      })
      check(request, "Staffing request not found", 404)
      check(
        request.status === "PENDING",
        "Staffing request has already been decided",
        409,
      )
      let assignment: WorkAssignment | null = null
      if (decision === "APPROVED") {
        const employeeId = id(input.employeeId)
        const employee = await employeeInScope(
          db,
          employeeId,
          department.id,
          true,
        )
        await target(db, request, request.ownerDepartmentId)
        ensureAssignable(employee, request)
        const {
          serviceRequestId,
          projectId,
          taskId,
          title,
          requiredSkills,
          startsAt,
          endsAt,
          estimatedHours,
          deadline,
          priority,
        } = request
        assignment = await db.workAssignment.create({
          data: {
            serviceRequestId,
            projectId,
            taskId,
            title,
            requiredSkills,
            startsAt,
            endsAt,
            estimatedHours,
            deadline,
            priority,
            ownerDepartmentId: request.ownerDepartmentId,
            employeeId,
            assignedBy: userId,
            staffingRequestId: request.id,
          },
        })
      }
      const changed = await db.staffingRequest.updateMany({
        where: { id: request.id, status: "PENDING" },
        data: { status: decision, decidedBy: userId, decidedAt: new Date() },
      })
      check(changed.count, "Staffing request has already been decided", 409)
      return { saved: true, assignmentId: assignment?.id ?? null }
    })
  },
}

export function workloadError(error: unknown) {
  if (error instanceof WorkloadError)
    return { status: error.status, error: error.message }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ["P2034", "P2002"].includes(error.code)
  )
    return {
      status: 409,
      error: "The schedule or staffing request changed. Refresh and try again.",
    }
  return null
}
