import { Router } from "express"
import { writeServiceLog } from "../service-operation-logs/log-writer.js"
import { auditDate } from "../service-operation-logs/audit-context.js"
import { requireAuth } from "../auth/auth.middleware.js"
import { getPrisma } from "../../lib/db.js"
import { activeStaff } from "../../shared/query/accounts.js"
import type { Prisma } from "../../generated/prisma/client.js"
import { fail } from "../../shared/http-error.js"
import { requireDepartmentHead } from "../request-inbox/request-inbox.service.js"
import { readDepartmentWorkload } from "./workload-read.service.js"
import { weekValue } from "./workload.schema.js"

export const workloadRouter = Router()
workloadRouter.use(requireAuth)
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
  const result = await getPrisma()!.$transaction(
    async (tx) => {
      const department = await scope(tx, req.auth!.user.id)
      const staff = await readDepartmentWorkload(
        tx,
        { id: department.id, headId: req.auth!.user.id },
        week,
      )
      const eligibleEmployeeIds = new Set(
        staff
          .filter((employee) => employee.status === "ACTIVE")
          .map((employee) => employee.id),
      )
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
        staff,
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
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, ...staffAccountWhere(department.id) },
      select: { fullName: true },
    })
    const before = await tx.workloadCapacity.findUnique({
      where: { employeeId_week: { employeeId, week } },
      select: { scheduledHours: true, timeOffHours: true },
    })
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
    await writeServiceLog(
      tx,
      "CAPACITY_UPDATED",
      employeeId,
      undefined,
      req.auth!.user.id,
      undefined,
      {
        targetLabel: employee?.fullName,
        changes: [
          { field: "Week", before: before ? week : null, after: week },
          {
            field: "Scheduled hours",
            before: before?.scheduledHours ?? null,
            after: scheduledHours,
          },
          {
            field: "Time off hours",
            before: before?.timeOffHours ?? null,
            after: timeOffHours,
          },
        ],
      },
    )
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
    const before = await tx.projectStaff.findUnique({
      where: { projectId_employeeId: { projectId, employeeId } },
      select: {
        weeklyHours: true,
        allocationStart: true,
        allocationEnd: true,
      },
    })
    await tx.projectStaff.upsert({
      where: { projectId_employeeId: { projectId, employeeId } },
      create: { projectId, employeeId, ...data },
      update: data,
    })
    const projectRecord = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { requestId: true, name: true },
    })
    const employee = await tx.employee.findUniqueOrThrow({
      where: { id: employeeId },
      select: { fullName: true },
    })
    const previousEmployee = previousEmployeeId
      ? await tx.employee.findUnique({
          where: { id: previousEmployeeId },
          select: { fullName: true },
        })
      : null
    if (projectRecord.requestId) {
      await writeServiceLog(
        tx,
        "STAFF_ALLOCATED",
        projectId,
        projectRecord.requestId,
        req.auth!.user.id,
        undefined,
        {
          targetLabel: projectRecord.name,
          changes: [
            {
              field: "Staff member",
              before:
                previousEmployee?.fullName ??
                (before ? employee.fullName : null),
              after: employee.fullName,
            },
            {
              field: "Weekly hours",
              before: before?.weeklyHours ?? null,
              after: weeklyHours,
            },
            {
              field: "Allocation start",
              before: auditDate(before?.allocationStart),
              after: auditDate(allocationStart),
            },
            {
              field: "Allocation end",
              before: auditDate(before?.allocationEnd),
              after: auditDate(allocationEnd),
            },
          ],
        },
      )
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
    const assignment = await tx.projectStaff.findFirst({
      where: {
        id: String(req.params.id),
        project: { request: { acceptedDepartmentId: department.id } },
      },
      select: {
        projectId: true,
        weeklyHours: true,
        allocationStart: true,
        allocationEnd: true,
        employee: { select: { fullName: true } },
        project: { select: { requestId: true, name: true } },
      },
    })
    const removed = await tx.projectStaff.deleteMany({
      where: {
        id: String(req.params.id),
        project: { request: { acceptedDepartmentId: department.id } },
      },
    })
    if (!removed.count) return fail(404, "Assignment not found")
    await writeServiceLog(
      tx,
      "STAFF_REMOVED",
      assignment!.projectId,
      assignment!.project.requestId ?? undefined,
      req.auth!.user.id,
      undefined,
      {
        targetLabel: assignment!.project.name,
        changes: [
          {
            field: "Staff member",
            before: assignment!.employee.fullName,
            after: null,
          },
          {
            field: "Weekly hours",
            before: assignment!.weeklyHours,
            after: null,
          },
          {
            field: "Allocation start",
            before: auditDate(assignment!.allocationStart),
            after: null,
          },
          {
            field: "Allocation end",
            before: auditDate(assignment!.allocationEnd),
            after: null,
          },
        ],
      },
    )
  })
  res.json({ saved: true })
})
