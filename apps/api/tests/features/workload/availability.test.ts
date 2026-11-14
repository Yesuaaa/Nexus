import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import type { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"
import { listInternalCalendar } from "../../../src/features/projects/calendar.service.js"
import { listClientCalendar } from "../../../src/features/projects/client-calendar.service.js"

test(
  "workload uses HR policy context without inventing availability",
  { timeout: 120000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const department = await prisma.department.create({
      data: { name: "Planning" },
    })
    const outside = await prisma.department.create({
      data: { name: "Outside" },
    })
    async function actor(
      name: string,
      role: Role = "STAFF",
      departmentId = department.id,
    ) {
      const user = await prisma.user.create({
        data: {
          email: `${name}@planning.test`,
          fullName: name,
          passwordHash: "test-only",
          role,
          departmentId,
        },
      })
      const employee = await prisma.employee.create({
        data: {
          employeeId: `PLAN-${name}`,
          fullName: name,
          departmentId,
          userId: user.id,
        },
      })
      return { user, employee, token: (await issueSession(user)).token }
    }
    const head = await actor("head"),
      staff = await actor("staff"),
      foreign = await actor("foreign", "STAFF", outside.id),
      admin = await actor("admin", "ADMIN"),
      client = await actor("client", "USER")
    await prisma.department.update({
      where: { id: department.id },
      data: { headId: head.user.id },
    })
    await prisma.department.update({
      where: { id: outside.id },
      data: { headId: foreign.user.id },
    })
    async function policy(
      name: string,
      requiredMinutes: number,
      timeZone = "Asia/Manila",
    ) {
      return prisma.attendancePolicy.create({
        data: {
          name,
          timeZone,
          days: {
            create: Array.from({ length: 7 }, (_, weekday) => ({
              weekday,
              isWorkingDay: weekday > 0 && weekday < 6,
              requiredMinutes: weekday > 0 && weekday < 6 ? requiredMinutes : 0,
            })),
          },
        },
      })
    }
    const first = await policy("Flexible six hours", 360)
    const second = await policy("Flexible four hours", 240, "America/New_York")
    await prisma.attendancePolicyAssignment.createMany({
      data: [
        {
          employeeId: staff.employee.id,
          policyId: first.id,
          effectiveFrom: new Date("2026-01-01"),
          effectiveUntil: new Date("2026-11-11"),
        },
        {
          employeeId: staff.employee.id,
          policyId: second.id,
          effectiveFrom: new Date("2026-11-11"),
        },
        {
          employeeId: head.employee.id,
          policyId: first.id,
          effectiveFrom: new Date("2026-11-11"),
        },
        {
          employeeId: foreign.employee.id,
          policyId: first.id,
          effectiveFrom: new Date("2026-01-01"),
        },
      ],
    })
    await prisma.workloadCapacity.create({
      data: {
        employeeId: staff.employee.id,
        week: "2026-11-09",
        scheduledHours: 30,
        timeOffHours: 6,
        updatedById: head.user.id,
      },
    })
    const project = await prisma.project.create({
      data: {
        clientId: client.user.id,
        name: "Existing commitment",
        status: "IN_PROGRESS",
      },
    })
    await prisma.projectStaff.create({
      data: {
        projectId: project.id,
        employeeId: staff.employee.id,
        approvedById: head.user.id,
        weeklyHours: 28,
        allocationStart: new Date("2026-11-13"),
        allocationEnd: new Date("2026-11-16"),
      },
    })
    const conversation = await prisma.requestConversation.create({
      data: { clientId: client.user.id, departmentId: department.id },
    })
    async function meeting(
      start: string,
      end: string,
      status: "SCHEDULED" | "CANCELLED" | "COMPLETED" = "SCHEDULED",
      conversationId = conversation.id,
    ) {
      return prisma.conversationMeeting.create({
        data: {
          conversationId,
          clientActionId: randomUUID(),
          startsAt: new Date(start),
          endsAt: new Date(end),
          location: "Online",
          notes: "Planning",
          status,
        },
      })
    }
    await meeting("2026-11-13T20:00:00Z", "2026-11-14T04:00:00Z")
    await meeting("2026-11-14T03:00:00Z", "2026-11-14T05:00:00Z")
    await meeting("2026-11-14T05:00:00Z", "2026-11-14T06:00:00Z") // Adjacent, not overlapping.
    const cancelled = await meeting(
      "2026-11-14T02:00:00Z",
      "2026-11-14T06:00:00Z",
      "CANCELLED",
    )
    const completed = await meeting(
      "2026-11-14T02:00:00Z",
      "2026-11-14T06:00:00Z",
      "COMPLETED",
    )
    await meeting("2026-11-16T00:00:00Z", "2026-11-16T01:00:00Z") // Next week.
    const otherConversation = await prisma.requestConversation.create({
      data: { clientId: client.user.id, departmentId: outside.id },
    })
    await meeting(
      "2026-11-14T03:00:00Z",
      "2026-11-14T07:00:00Z",
      "SCHEDULED",
      otherConversation.id,
    )
    const service = await prisma.service.create({
      data: { name: "Planning service", description: "Test" },
    })
    const request = await prisma.serviceRequest.create({
      data: {
        clientId: client.user.id,
        serviceId: service.id,
        title: "Planning request",
        acceptedDepartmentId: department.id,
        workflow: { create: {} },
      },
    })
    await prisma.workflowConsultation.create({
      data: {
        requestId: request.id,
        startsAt: new Date("2026-11-12T12:00:00Z"),
        endsAt: new Date("2026-11-12T13:00:00Z"),
        location: "Online",
      },
    })

    type Planning = {
      requirement: {
        totalHours: number | null
        knownHours: number
        days: {
          workDate: string
          requiredMinutes: number | null
          timeZone: string | null
          isWorkingDay: boolean | null
        }[]
      }
      confirmedAvailableSlots: null
      commitments: { startsAt: string; endsAt: string }[]
      overlaps: { firstId: string; secondId: string }[]
    }
    type Row = {
      id: string
      capacity: { scheduledHours: number; timeOffHours: number } | null
      assignments: { weeklyHours: number }[]
      planning: Planning
    }
    async function get(who = head, week = "2026-11-09") {
      return fetch(`${base}/workload?week=${week}`, {
        headers: { authorization: `Bearer ${who.token}` },
      })
    }
    async function rows(who = head, week?: string) {
      const response = await get(who, week)
      assert.equal(response.status, 200, await response.clone().text())
      return ((await response.json()) as { staff: Row[] }).staff
    }
    await t.test(
      "effective policy dates preserve flexible daily targets and rest days",
      async () => {
        const result = await rows()
        const member = result.find((row) => row.id === staff.employee.id)!
        assert.equal(member.planning.requirement.totalHours, 24)
        assert.deepEqual(
          member.planning.requirement.days.map((day) => day.requiredMinutes),
          [360, 360, 240, 240, 240, 0, 0],
        )
        assert.equal(
          member.planning.requirement.days[2]!.timeZone,
          "America/New_York",
        )
        assert.equal(member.planning.requirement.days[5]!.isWorkingDay, false)
        assert.equal(member.capacity!.scheduledHours, 30)
        assert.equal(member.capacity!.timeOffHours, 6)
        assert.equal(member.assignments[0]!.weeklyHours, 28) // Full overlapping week, no proration.
        assert.equal(member.planning.confirmedAvailableSlots, null)
        const headRow = result.find((row) => row.id === head.employee.id)!
        assert.equal(headRow.planning.requirement.totalHours, null)
        assert.equal(headRow.planning.requirement.knownHours, 18)
        assert.equal(
          headRow.planning.requirement.days[0]!.requiredMinutes,
          null,
        )
        assert.equal(headRow.capacity, null) // Policy is not substituted for missing capacity.
        assert.equal(
          result.some((row) => row.id === foreign.employee.id),
          false,
        )
        const next = (await rows(head, "2026-11-16")).find(
          (row) => row.id === staff.employee.id,
        )!
        assert.equal(next.planning.requirement.totalHours, 20)
        assert.equal(next.capacity, null)
        assert.equal(next.assignments.length, 1) // Existing inclusive allocation end.
      },
    )
    await t.test(
      "known busy times and overlaps belong only to the current head",
      async () => {
        const result = await rows()
        const headRow = result.find((row) => row.id === head.employee.id)!
        assert.equal(headRow.planning.commitments.length, 4)
        assert.equal(headRow.planning.overlaps.length, 1)
        assert.ok(
          headRow.planning.commitments.some(
            (item) =>
              item.startsAt === "2026-11-13T20:00:00.000Z" &&
              item.endsAt === "2026-11-14T04:00:00.000Z",
          ),
        )
        assert.deepEqual(
          result.find((row) => row.id === staff.employee.id)!.planning
            .commitments,
          [],
        )
        assert.equal((await rows(foreign))[0]!.planning.commitments.length, 1)
      },
    )
    await t.test(
      "shared calendar queries retain completed history without turning it into workload commitments",
      async () => {
        const internal = await listInternalCalendar(head.user.id, "mine")
        const clients = await listClientCalendar(client.user.id)
        for (const events of [internal.events, clients]) {
          assert.ok(
            events.some(
              (event) =>
                event.id === `meeting-${completed.id}` && event.completed,
            ),
          )
          assert.equal(
            events.some((event) => event.id === `meeting-${cancelled.id}`),
            false,
          )
        }
        const headRow = (await rows()).find(
          (row) => row.id === head.employee.id,
        )!
        assert.equal(headRow.planning.commitments.length, 4)
      },
    )
    await t.test(
      "clock-in and overnight actual hours do not alter planning or allocations",
      async () => {
        const before = await rows()
        const session = await prisma.attendanceWorkSession.create({
          data: {
            employeeId: staff.employee.id,
            startedAt: new Date("2026-11-13T20:00:00-05:00"),
          },
        })
        assert.deepEqual(await rows(), before)
        await prisma.attendanceWorkSession.update({
          where: { id: session.id },
          data: { endedAt: new Date("2026-11-14T04:00:00-05:00") },
        })
        assert.deepEqual(await rows(), before)
        assert.equal(await prisma.projectStaff.count(), 1)
        assert.equal(await prisma.workloadCapacity.count(), 1)
      },
    )
    await t.test(
      "existing head-only permission is rechecked server-side",
      async () => {
        assert.equal(
          (await fetch(`${base}/workload?week=2026-11-09`)).status,
          401,
        )
        for (const who of [staff, admin, client])
          assert.equal((await get(who)).status, 403)
        await prisma.department.update({
          where: { id: department.id },
          data: { headId: null },
        })
        assert.equal((await get()).status, 403)
      },
    )
  },
)
