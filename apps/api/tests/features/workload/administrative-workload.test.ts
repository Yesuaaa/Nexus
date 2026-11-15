import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import type { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "administrative workload reuses department calculations without participation or writes",
  { timeout: 120000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    async function actor(name: string, role: Role = "STAFF") {
      const user = await prisma.user.create({
        data: {
          email: `${name}@oversight.test`,
          fullName: name,
          role,
          passwordHash: "PRIVATE-CREDENTIAL",
        },
      })
      return {
        user,
        headers: {
          authorization: `Bearer ${(await issueSession(user)).token}`,
          "content-type": "application/json",
        },
      }
    }
    const sa = await actor("superadmin", "SUPERADMIN")
    const admin = await actor("admin", "ADMIN")
    const client = await actor("client", "USER")
    const heads = await Promise.all([
      actor("Design head"),
      actor("Engineering head"),
    ])
    const departments = await Promise.all(
      heads.map((head, index) =>
        prisma.department.create({
          data: {
            name: index ? "Engineering" : "Design",
            headId: head.user.id,
          },
        }),
      ),
    )
    const noHead = await prisma.department.create({ data: { name: "No head" } })
    async function employee(
      name: string,
      departmentId: string | null,
      status: "ACTIVE" | "ON_LEAVE" | "INACTIVE" = "ACTIVE",
    ) {
      const account = await actor(name)
      const row = await prisma.employee.create({
        data: {
          employeeId: name.replaceAll(" ", "-"),
          fullName: name,
          departmentId,
          status,
          userId: account.user.id,
          email: "PRIVATE-HR-CONTACT",
          profileSpecialties: ["Design"],
          position: "Specialist",
        },
      })
      return { ...account, employee: row }
    }
    const headEmployees = await Promise.all(
      heads.map((head, index) =>
        prisma.employee.create({
          data: {
            employeeId: `HEAD-${index}`,
            fullName: head.user.fullName!,
            userId: head.user.id,
            departmentId: departments[index].id,
          },
        }),
      ),
    )
    const staff = await employee("Active staff", departments[0].id)
    const leave = await employee("Leave staff", departments[1].id, "ON_LEAVE")
    const inactive = await employee(
      "Inactive staff",
      departments[1].id,
      "INACTIVE",
    )
    const unassigned = await employee("Unassigned staff", null)
    const unheaded = await employee("No head staff", noHead.id)
    const retired = await employee("Retired staff", departments[0].id)
    await prisma.user.update({
      where: { id: retired.user.id },
      data: { accountDeletedAt: new Date() },
    })
    const disabled = await employee("Disabled staff", departments[1].id)
    await prisma.user.update({
      where: { id: disabled.user.id },
      data: { isActive: false },
    })
    await prisma.employee.create({
      data: {
        employeeId: "ADMIN-EMP",
        fullName: "Admin employee",
        userId: admin.user.id,
        departmentId: departments[0].id,
      },
    })
    const week = "2026-11-09"
    const policy = await prisma.attendancePolicy.create({
      data: {
        name: "Flexible target",
        timeZone: "Asia/Manila",
        days: {
          create: Array.from({ length: 7 }, (_, weekday) => ({
            weekday,
            isWorkingDay: weekday > 0 && weekday < 6,
            requiredMinutes: weekday > 0 && weekday < 6 ? 360 : 0,
          })),
        },
      },
    })
    await prisma.attendancePolicyAssignment.create({
      data: {
        employeeId: staff.employee.id,
        policyId: policy.id,
        effectiveFrom: new Date("2026-01-01"),
      },
    })
    await prisma.workloadCapacity.createMany({
      data: [staff, leave, inactive].map((member) => ({
        employeeId: member.employee.id,
        week,
        scheduledHours: 40,
        timeOffHours: 8,
        updatedById: "PRIVATE-CAPACITY-ACTOR",
      })),
    })
    const project = await prisma.project.create({
      data: {
        name: "Held assignment",
        clientId: client.user.id,
        status: "ON_HOLD",
      },
    })
    const assignment = await prisma.projectStaff.create({
      data: {
        employeeId: staff.employee.id,
        projectId: project.id,
        weeklyHours: 36,
        approvedById: "PRIVATE-APPROVER",
        allocationStart: new Date("2026-11-13"),
        allocationEnd: new Date("2026-11-16"),
      },
    })
    for (const [name, status, start] of [
      ["Future", "IN_PROGRESS", "2026-11-16"],
      ["Finished", "COMPLETED", "2026-11-09"],
    ] as const) {
      await prisma.project.create({
        data: {
          name,
          clientId: client.user.id,
          status,
          staff: {
            create: {
              employeeId: staff.employee.id,
              approvedById: heads[0].user.id,
              weeklyHours: 100,
              allocationStart: new Date(start),
            },
          },
        },
      })
    }
    const conversation = await prisma.requestConversation.create({
      data: { clientId: client.user.id, departmentId: departments[0].id },
    })
    const meetings = []
    for (const hour of [8, 9])
      meetings.push(
        await prisma.conversationMeeting.create({
          data: {
            conversationId: conversation.id,
            clientActionId: randomUUID(),
            startsAt: new Date(`2026-11-10T0${hour}:00:00Z`),
            endsAt: new Date(`2026-11-10T${hour + 2}:00:00Z`),
            location: "PRIVATE-LOCATION",
            notes: "PRIVATE-MEETING-NOTES",
          },
        }),
      )
    const get = (path: string, who = sa) =>
      fetch(`${base}${path}`, { headers: who.headers })
    const endpoint = `/administrative-workload?week=${week}`
    assert.equal((await fetch(`${base}${endpoint}`)).status, 401)
    const response = await get(endpoint)
    assert.equal(response.status, 200)
    const text = await response.text()
    assert.ok(!text.includes("PRIVATE-"))
    assert.ok(!text.includes(conversation.id))
    for (const meeting of meetings) assert.ok(!text.includes(meeting.id))
    type Row = {
      id: string
      fullName: string
      status: string
      department: { id: string } | null
      capacity: { scheduledHours: number; timeOffHours: number } | null
      assignments: { id: string; weeklyHours: number | null }[]
      planning: {
        requirement: { totalHours: number | null }
        confirmedAvailableSlots: null
        commitments: {
          id: string
          startsAt: string
          endsAt: string
          title: string
        }[]
        overlaps: { firstId: string; secondId: string }[]
      }
    }
    const result = JSON.parse(text) as {
      staff: Row[]
      capabilities: Record<string, boolean>
      projects: unknown[]
    }
    assert.deepEqual(
      result.staff.map((row) => row.id).sort(),
      [
        ...headEmployees.map((row) => row.id),
        staff.employee.id,
        leave.employee.id,
        inactive.employee.id,
        unassigned.employee.id,
        unheaded.employee.id,
      ].sort(),
    )
    assert.ok(
      Object.entries(result.capabilities).every(
        ([key, value]) => value === (key === "read"),
      ),
    )
    assert.deepEqual(result.projects, [])
    const member = result.staff.find((row) => row.id === staff.employee.id)!
    assert.equal(member.department!.id, departments[0].id)
    assert.deepEqual(member.capacity, { scheduledHours: 40, timeOffHours: 8 })
    assert.equal(member.planning.requirement.totalHours, 30)
    assert.deepEqual(
      member.assignments.map((row) => row.id),
      [assignment.id],
    )
    assert.equal(member.assignments[0].weeklyHours, 36)
    assert.equal(member.planning.confirmedAvailableSlots, null)
    assert.equal(member.planning.commitments.length, 0)
    const headRow = result.staff.find((row) => row.id === headEmployees[0].id)!
    assert.equal(headRow.planning.commitments.length, 2)
    assert.equal(headRow.planning.overlaps.length, 1)
    assert.ok(
      headRow.planning.commitments.every((item) =>
        item.id.startsWith("commitment-"),
      ),
    )
    assert.equal(
      result.staff.find((row) => row.id === unassigned.employee.id)!.department,
      null,
    )
    assert.equal(
      result.staff.find((row) => row.id === unheaded.employee.id)!.planning
        .commitments.length,
      0,
    )
    for (const [index, head] of heads.entries()) {
      const operational = await get(`/workload?week=${week}`, head)
      assert.equal(operational.status, 200)
      const rows = ((await operational.json()) as { staff: Row[] }).staff
      assert.deepEqual(
        rows.map((row) => row.id).sort(),
        result.staff
          .filter((row) => row.department?.id === departments[index].id)
          .map((row) => row.id)
          .sort(),
      )
      for (const row of rows) {
        const inspected = result.staff.find((item) => item.id === row.id)!
        assert.deepEqual(
          inspected.capacity,
          row.capacity
            ? {
                scheduledHours: row.capacity.scheduledHours,
                timeOffHours: row.capacity.timeOffHours,
              }
            : null,
        )
        assert.deepEqual(
          inspected.assignments.map((item) => [item.id, item.weeklyHours]),
          row.assignments.map((item) => [item.id, item.weeklyHours]),
        )
        assert.deepEqual(
          inspected.planning.requirement,
          row.planning.requirement,
        )
        assert.deepEqual(
          inspected.planning.commitments.map((item) => [
            item.title,
            item.startsAt,
            item.endsAt,
          ]),
          row.planning.commitments.map((item) => [
            item.title,
            item.startsAt,
            item.endsAt,
          ]),
        )
        assert.equal(
          inspected.planning.overlaps.length,
          row.planning.overlaps.length,
        )
      }
    }
    for (const who of [admin, ...heads, staff, client])
      assert.equal((await get(endpoint, who)).status, 403)
    for (const who of [sa, admin, staff, client])
      assert.equal((await get(`/workload?week=${week}`, who)).status, 403)
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      for (const path of [
        "/administrative-workload",
        "/administrative-workload/capacity",
        "/administrative-workload/assignment",
      ])
        assert.equal(
          (
            await fetch(`${base}${path}`, {
              method,
              headers: sa.headers,
              body: "{}",
            })
          ).status,
          404,
        )
    }
    for (const who of [sa, admin, staff, client]) {
      assert.equal(
        (
          await fetch(`${base}/workload/capacity`, {
            method: "PUT",
            headers: who.headers,
            body: JSON.stringify({
              week,
              employeeId: staff.employee.id,
              scheduledHours: 40,
              timeOffHours: 0,
            }),
          })
        ).status,
        403,
      )
      assert.equal(
        (
          await fetch(`${base}/workload/assignment`, {
            method: "PUT",
            headers: who.headers,
            body: JSON.stringify({
              week,
              employeeId: staff.employee.id,
              projectId: project.id,
              weeklyHours: 10,
              endDate: "2026-11-15",
            }),
          })
        ).status,
        403,
      )
      assert.equal(
        (
          await fetch(`${base}/workload/assignment/${assignment.id}`, {
            method: "DELETE",
            headers: who.headers,
          })
        ).status,
        403,
      )
    }
    assert.equal(
      (
        await fetch(`${base}/workload/capacity`, {
          method: "PUT",
          headers: heads[0].headers,
          body: JSON.stringify({
            week,
            employeeId: leave.employee.id,
            scheduledHours: 40,
            timeOffHours: 0,
          }),
        })
      ).status,
      404,
    )
    assert.equal(
      (await get(`/request-conversations/${conversation.id}`)).status,
      404,
    )
    for (const query of [
      "",
      "?week=2026-11-10",
      "?week=2026-02-30",
      "?week=bad",
      `?week=${week}&week=${week}`,
    ])
      assert.equal((await get(`/administrative-workload${query}`)).status, 400)
    assert.equal(
      await prisma.employee.count({ where: { userId: sa.user.id } }),
      0,
    )
    assert.equal(
      await prisma.department.count({ where: { headId: sa.user.id } }),
      0,
    )
    assert.equal(
      (
        await prisma.projectStaff.findUniqueOrThrow({
          where: { id: assignment.id },
        })
      ).weeklyHours,
      36,
    )
    assert.equal(
      (
        await prisma.workloadCapacity.findUniqueOrThrow({
          where: { employeeId_week: { employeeId: staff.employee.id, week } },
        })
      ).timeOffHours,
      8,
    )
    await prisma.user.update({
      where: { id: sa.user.id },
      data: { role: "ADMIN" },
    })
    assert.equal((await get(endpoint)).status, 403)
  },
)
