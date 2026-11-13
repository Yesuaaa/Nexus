import { Router } from "express"
import { requireAuth } from "../auth/auth.middleware.js"
import { getPrisma } from "../../lib/db.js"
import { activeStaff } from "../../shared/query/accounts.js"
import type { Prisma } from "../../generated/prisma/client.js"
import { fail } from "../../shared/http-error.js"
import { requireDepartmentHead } from "../request-inbox/request-inbox.service.js"
import { workloadPlanningContext } from "./workload-availability.service.js"

export const workloadRouter = Router()
workloadRouter.use(requireAuth)
function weekValue(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return fail(400, "Choose a valid week")
  const date = new Date(`${value}T00:00:00Z`)
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    date.getUTCDay() !== 1
  )
    return fail(400, "Week must start on Monday")
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
    return fail(400, "Hours must be between 0 and 168")
  return value
}
function scope(tx: Prisma.TransactionClient, userId: string) {
  return requireDepartmentHead(userId, {
    client: tx,
    message: "Only the department head can manage workload",
  })
}
function staffAccountWhere(departmentId: string): Prisma.EmployeeWhereInput {
  return { departmentId, user: activeStaff }
}
function eligibleStaffWhere(departmentId: string): Prisma.EmployeeWhereInput {
  return { ...staffAccountWhere(departmentId), status: "ACTIVE" }
}
workloadRouter.get("/", async (req, res) => {
  const week = weekValue(req.query.week)
  const end = new Date(`${week}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 6)
  const result = await getPrisma()!.$transaction(
    async (tx) => {
      const department = await scope(tx, req.auth!.user.id)
      const staff = await tx.employee.findMany({
        where: staffAccountWhere(department.id),
        select: {
          id: true,
          userId: true,
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
      const eligibleEmployeeIds = new Set(
        staff
          .filter((employee) => employee.status === "ACTIVE")
          .map((employee) => employee.id),
      )
      const planning = await workloadPlanningContext(
        tx,
        { id: department.id, headId: req.auth!.user.id },
        week,
        staff,
      )
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
          staff: {
            select: {
              id: true,
              employeeId: true,
              weeklyHours: true,
              allocationStart: true,
              allocationEnd: true,
              employee: { select: { fullName: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
      return {
        department,
        week,
        projects: projects.map((project) => ({
          ...project,
          staff: project.staff.map((allocation) => ({
            id: allocation.id,
            employeeId: allocation.employeeId,
            employeeName: allocation.employee.fullName,
            weeklyHours: allocation.weeklyHours,
            allocationStart: allocation.allocationStart,
            allocationEnd: allocation.allocationEnd,
            eligible: eligibleEmployeeIds.has(allocation.employeeId),
          })),
        })),
        staff: staff.map((employee) => ({
          ...employee,
          userId: undefined,
          planning: planning.get(employee.id),
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
    return fail(400, "Time off cannot exceed scheduled hours")
  if (typeof input.employeeId !== "string")
    return fail(400, "Choose an employee")
  const employeeId = input.employeeId
  await getPrisma()!.$transaction(async (tx) => {
    const department = await scope(tx, req.auth!.user.id)
    const member = await tx.employee.updateMany({
      where: { id: employeeId, ...staffAccountWhere(department.id) },
      data: { updatedAt: new Date() },
    })
    if (!member.count)
      return fail(404, "Choose staff with an active account in your department")
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
    return fail(400, "Choose staff and a project")
  const employeeId = input.employeeId,
    projectId = input.projectId,
    weeklyHours = hours(input.weeklyHours, true)
  const start = weekValue(input.week)
  const allocationStart = new Date(`${start}T00:00:00Z`)
  if (
    typeof input.endDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate)
  )
    return fail(400, "Choose an end date")
  const allocationEnd = new Date(`${input.endDate}T00:00:00Z`)
  if (
    !Number.isFinite(allocationEnd.getTime()) ||
    allocationEnd.toISOString().slice(0, 10) !== input.endDate ||
    allocationEnd < allocationStart
  )
    return fail(400, "End date must be on or after the starting week")
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
      return fail(409, "Service must be authorized before allocating staff")
    const member = await tx.employee.updateMany({
      where: {
        id: employeeId,
        ...eligibleStaffWhere(department.id),
      },
      data: { updatedAt: new Date() },
    })
    if (!member.count)
      return fail(409, "Choose active department staff with an active login")
    const previousEmployeeId =
      typeof input.previousEmployeeId === "string"
        ? input.previousEmployeeId
        : null
    if (previousEmployeeId && previousEmployeeId !== employeeId) {
      const previous = await tx.projectStaff.findFirst({
        where: { projectId, employeeId: previousEmployeeId },
        select: { id: true },
      })
      if (!previous) return fail(404, "Previous assignment was not found")
    }
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
              ...(previousEmployeeId ? [previousEmployeeId] : []),
            ],
          },
          ...staffAccountWhere(department.id),
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

    if (previousEmployeeId && previousEmployeeId !== employeeId) {
      await tx.projectStaff.deleteMany({
        where: { projectId, employeeId: previousEmployeeId },
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
        project: { request: { acceptedDepartmentId: department.id } },
      },
    })
    if (!removed.count) return fail(404, "Assignment not found")
  })
  res.json({ saved: true })
})
