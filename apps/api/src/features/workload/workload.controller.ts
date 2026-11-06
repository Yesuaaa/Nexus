import { Router, type ErrorRequestHandler } from "express"
import { requireAuth } from "../auth/auth.middleware.js"
import { getPrisma } from "../../lib/db.js"
import type { Prisma } from "../../generated/prisma/client.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"

export const workloadRouter = Router()
workloadRouter.use(requireAuth)
const fail = (message: string, status = 400): never => {
  throw new ServiceRequestsError(status, message)
}
function weekValue(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return fail("Choose a valid week")
  const date = new Date(`${value}T00:00:00Z`)
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    date.getUTCDay() !== 1
  )
    return fail("Week must start on Monday")
  return value
}
function hours(value: unknown, positive = false): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 168 ||
    (positive && value === 0)
  )
    return fail("Hours must be between 0 and 168")
  return value
}
async function scope(tx: Prisma.TransactionClient, userId: string) {
  const department = await tx.department.findFirst({
    where: {
      headId: userId,
      head: { role: "STAFF", isActive: true, accountDeletedAt: null },
    },
    select: { id: true, name: true },
  })
  if (!department)
    return fail("Only the department head can manage workload", 403)
  return department
}
workloadRouter.get("/", async (req, res) => {
  const week = weekValue(req.query.week)
  const end = new Date(`${week}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 6)
  const result = await getPrisma()!.$transaction(
    async (tx) => {
      const department = await scope(tx, req.auth!.user.id)
      const staff = await tx.employee.findMany({
        where: { departmentId: department.id },
        select: {
          id: true,
          fullName: true,
          position: true,
          status: true,
          profileSpecialties: true,
          team: { select: { id: true, name: true } },
          projectAssignments: {
            where: {
              project: {
                status: { in: ["PLANNED", "IN_PROGRESS", "ON_HOLD"] },
              },
            },
            include: {
              project: { select: { id: true, name: true, status: true } },
            },
          },
        },
        orderBy: { fullName: "asc" },
      })
      const capacities = await tx.workloadCapacity.findMany({
        where: { week, employeeId: { in: staff.map((s) => s.id) } },
      })
      const projects = await tx.project.findMany({
        where: {
          request: {
            acceptedDepartmentId: department.id,
            workflow: {
              state: { in: ["READY_FOR_ACTIVATION", "ACTIVE_PROJECT"] },
            },
          },
          status: { in: ["PLANNED", "IN_PROGRESS"] },
        },
        select: {
          id: true,
          name: true,
          status: true,
          requestId: true,
          request: {
            select: {
              referenceNumber: true,
              service: { select: { name: true } },
            },
          },
          staff: { select: { employeeId: true } },
        },
        orderBy: { createdAt: "desc" },
      })
      return {
        department,
        week,
        projects,
        staff: staff.map((employee) => ({
          ...employee,
          capacity:
            capacities.find((c) => c.employeeId === employee.id) ?? null,
          assignments: employee.projectAssignments.filter(
            (a) =>
              (!a.allocationStart || a.allocationStart <= end) &&
              (!a.allocationEnd ||
                a.allocationEnd >= new Date(`${week}T00:00:00Z`)),
          ),
          projectAssignments: undefined,
        })),
      }
    },
    { isolationLevel: "RepeatableRead" },
  )
  res.json(result)
})
workloadRouter.put("/capacity", async (req, res) => {
  const input = (req.body ?? {}) as Record<string, unknown>
  const week = weekValue(input.week),
    scheduledHours = hours(input.scheduledHours),
    timeOffHours = hours(input.timeOffHours)
  if (timeOffHours > scheduledHours)
    return fail("Time off cannot exceed scheduled hours")
  if (typeof input.employeeId !== "string") return fail("Choose an employee")
  const employeeId = input.employeeId
  await getPrisma()!.$transaction(async (tx) => {
    const department = await scope(tx, req.auth!.user.id)
    const member = await tx.employee.updateMany({
      where: { id: employeeId, departmentId: department.id },
      data: { updatedAt: new Date() },
    })
    if (!member.count) return fail("Employee not found in your department", 404)
    await tx.workloadCapacity.upsert({
      where: { employeeId_week: { employeeId, week } },
      create: {
        employeeId,
        week,
        scheduledHours,
        timeOffHours,
        updatedById: req.auth!.user.id,
      },
      update: { scheduledHours, timeOffHours, updatedById: req.auth!.user.id },
    })
  })
  res.json({ saved: true })
})
workloadRouter.put("/assignment", async (req, res) => {
  const input = (req.body ?? {}) as Record<string, unknown>
  if (
    typeof input.employeeId !== "string" ||
    typeof input.projectId !== "string"
  )
    return fail("Choose staff and a project")
  const employeeId = input.employeeId,
    projectId = input.projectId,
    weeklyHours = hours(input.weeklyHours, true)
  const start = weekValue(input.week)
  const allocationStart = new Date(`${start}T00:00:00Z`)
  if (
    typeof input.endDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate)
  )
    return fail("Choose an end date")
  const allocationEnd = new Date(`${input.endDate}T00:00:00Z`)
  if (
    !Number.isFinite(allocationEnd.getTime()) ||
    allocationEnd.toISOString().slice(0, 10) !== input.endDate ||
    allocationEnd < allocationStart
  )
    return fail("End date must be on or after the starting week")
  await getPrisma()!.$transaction(async (tx) => {
    const department = await scope(tx, req.auth!.user.id)
    const project = await tx.project.updateMany({
      where: {
        id: projectId,
        status: { in: ["PLANNED", "IN_PROGRESS"] },
        request: {
          acceptedDepartmentId: department.id,
          workflow: {
            state: { in: ["READY_FOR_ACTIVATION", "ACTIVE_PROJECT"] },
          },
        },
      },
      data: { updatedAt: new Date() },
    })
    if (!project.count)
      return fail("Service must be authorized before allocating staff", 409)
    const member = await tx.employee.updateMany({
      where: {
        id: employeeId,
        departmentId: department.id,
        status: "ACTIVE",
        user: { role: "STAFF", isActive: true, accountDeletedAt: null },
      },
      data: { updatedAt: new Date() },
    })
    if (!member.count)
      return fail("Choose active department staff with an active login", 409)
    const data = {
      weeklyHours,
      allocationStart,
      allocationEnd,
      approvedById: req.auth!.user.id,
      approvedAt: new Date(),
    }
    await tx.projectStaff.upsert({
      where: { projectId_employeeId: { projectId, employeeId } },
      create: { projectId, employeeId, ...data },
      update: data,
    })
    const projectRecord = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { requestId: true, name: true },
    })
    if (projectRecord.requestId) {
      const event = await tx.workflowEvent.create({
        data: {
          requestId: projectRecord.requestId,
          actorId: req.auth!.user.id,
          type: "STAFFING_ALLOCATED",
          summary:
            "Department head allocated " +
            weeklyHours +
            " hours/week to " +
            projectRecord.name,
          entityId: projectId,
        },
      })
      const recipients = await tx.employee.findMany({
        where: {
          id: {
            in: [
              employeeId,
              ...(typeof input.previousEmployeeId === "string"
                ? [input.previousEmployeeId]
                : []),
            ],
          },
          departmentId: department.id,
          userId: { not: null },
        },
        select: { userId: true },
      })
      await tx.workflowNotification.createMany({
        data: [
          ...new Set(
            recipients
              .map((e) => e.userId!)
              .filter((id) => id !== req.auth!.user.id),
          ),
        ].map((userId) => ({
          userId,
          requestId: projectRecord.requestId!,
          eventId: event.id,
        })),
      })
    }

    if (
      typeof input.previousEmployeeId === "string" &&
      input.previousEmployeeId !== employeeId
    ) {
      const previous = await tx.employee.findFirst({
        where: { id: input.previousEmployeeId, departmentId: department.id },
      })
      if (!previous)
        return fail("Previous employee is outside your department", 403)
      await tx.projectStaff.deleteMany({
        where: { projectId, employeeId: previous.id },
      })
    }
  })
  res.json({ saved: true })
})
workloadRouter.delete("/assignment/:id", async (req, res) => {
  await getPrisma()!.$transaction(async (tx) => {
    const department = await scope(tx, req.auth!.user.id)
    const removed = await tx.projectStaff.deleteMany({
      where: {
        id: String(req.params.id),
        employee: { departmentId: department.id },
        project: { request: { acceptedDepartmentId: department.id } },
      },
    })
    if (!removed.count) return fail("Assignment not found", 404)
  })
  res.json({ saved: true })
})
workloadRouter.use(((error, _req, res, next) => {
  if (error instanceof ServiceRequestsError)
    return res.status(error.status).json({ error: error.message })
  next(error)
}) satisfies ErrorRequestHandler)
