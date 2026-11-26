import { randomUUID } from "node:crypto"
import type { PrismaClient, Role } from "../../src/generated/prisma/client.js"
import { issueSession } from "../../src/features/auth/auth.service.js"

export const day = "2026-11-13"
export const now = new Date("2026-11-14T12:00:00Z")
export const date = (workDate: string) => new Date(workDate + "T00:00:00Z")
export const range = "from=" + day + "&to=" + day
export const start = day + "T09:00:00Z"
export const end = day + "T12:00:00Z"
export const note = "Confirmed clock out"

export function recordsFixture(prisma: PrismaClient, base: string) {
  async function actor(name: string, role: Role) {
    const user = await prisma.user.create({
      data: {
        email: name + "@pg015.test",
        fullName: name,
        role,
        passwordHash: "fixture",
      },
    })
    return { user, token: (await issueSession(user)).token }
  }
  function read(path: string, token?: string, body?: unknown) {
    return fetch(base + "/attendance" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }
  async function setup() {
    const admin = await actor("report-admin", "ADMIN")
    const supervisor = await actor("report-supervisor", "SUPERADMIN")
    const employeeUser = await actor("worker", "STAFF")
    const department = await prisma.department.create({
      data: { name: "Design" },
    })
    const outside = await prisma.department.create({
      data: { name: "Operations" },
    })
    const policy = await prisma.attendancePolicy.create({
      data: {
        name: "PG-015 flexible",
        timeZone: "UTC",
        unpaidBreaksEnabled: true,
        days: {
          create: Array.from({ length: 7 }, (_, weekday) => ({
            weekday,
            isWorkingDay: true,
            requiredMinutes: 480,
          })),
        },
      },
    })
    async function worker(
      name: string,
      departmentId: string | null,
      userId?: string,
    ) {
      const employee = await prisma.employee.create({
        data: {
          employeeId: name,
          fullName: name,
          departmentId,
          userId,
        },
      })
      const assignment = await prisma.attendancePolicyAssignment.create({
        data: {
          employeeId: employee.id,
          policyId: policy.id,
          effectiveFrom: date("2024-01-01"),
        },
      })
      return { employee, assignment }
    }
    const subject = await worker(
      "PG015-worker",
      department.id,
      employeeUser.user.id,
    )
    async function workday(worker: typeof subject, value: string, id?: string) {
      return prisma.attendanceWorkday.create({
        data: {
          id,
          employeeId: worker.employee.id,
          assignmentId: worker.assignment.id,
          workDate: date(value),
          timeZone: "UTC",
          policyName: policy.name,
          isWorkingDay: true,
          requiredMinutes: 480,
          unpaidBreaksEnabled: true,
          overnightRequiresReview: false,
        },
      })
    }
    async function suspended(workDate = day) {
      return prisma.attendanceWorkSession.create({
        data: {
          employeeId: subject.employee.id,
          startedAt: new Date(workDate + "T09:00:00Z"),
          suspendedAt: new Date(workDate + "T11:00:00Z"),
        },
      })
    }
    async function leave(workDate: string) {
      return prisma.leaveRequest.create({
        data: {
          requestKey: randomUUID(),
          employeeId: subject.employee.id,
          requestedById: employeeUser.user.id,
          type: "ANNUAL",
          reason: "PG-015 isolated leave",
          startDate: date(workDate),
          endDate: date(workDate),
          status: "APPROVED",
          days: {
            create: {
              employeeId: subject.employee.id,
              assignmentId: subject.assignment.id,
              workDate: date(workDate),
              timeZone: "UTC",
              policyName: policy.name,
              baseRequiredMinutes: 480,
              leaveMinutes: 480,
            },
          },
        },
      })
    }
    return {
      admin,
      supervisor,
      employeeUser,
      department,
      outside,
      subject,
      worker,
      workday,
      suspended,
      leave,
    }
  }
  return { actor, read, setup }
}

export function reconcilePath(employee: string, session: string) {
  return "/employees/" + employee + "/sessions/" + session + "/reconcile"
}
