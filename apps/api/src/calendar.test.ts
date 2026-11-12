import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { issueSession } from "./features/auth/auth.service.js"
import { listInternalCalendar } from "./features/projects/calendar.service.js"
import type { Role } from "./generated/prisma/client.js"
import { startPgliteApp } from "./test/pglite-app.js"

test(
  "calendar aggregates existing records with current role, assignment and head boundaries",
  { timeout: 120_000 },
  async (t) => {
    const { prisma: database, origin } = await startPgliteApp(t)
    const base = origin
    async function user(name: string, role: Role) {
      return database.user.create({
        data: {
          email: `${name}@example.com`,
          fullName: name,
          passwordHash: "test-only",
          role,
        },
      })
    }
    const head = await user("Head", "STAFF")
    const staff = await user("Staff", "STAFF")
    const teammate = await user("Teammate", "STAFF")
    const outsider = await user("Outsider", "STAFF")
    const admin = await user("Admin", "ADMIN")
    const superadmin = await user("Superadmin", "SUPERADMIN")
    const client = await user("Client", "USER")
    const otherClient = await user("OtherClient", "USER")
    const department = await database.department.create({
      data: { name: "Design", headId: head.id },
    })
    const otherDepartment = await database.department.create({
      data: { name: "Other", headId: outsider.id },
    })
    const unassignedDepartment = await database.department.create({
      data: { name: "Unassigned" },
    })
    const employee = await database.employee.create({
      data: {
        employeeId: "CAL-1",
        fullName: "Staff",
        userId: staff.id,
        departmentId: department.id,
      },
    })
    const teammateEmployee = await database.employee.create({
      data: {
        employeeId: "CAL-2",
        fullName: "Teammate",
        userId: teammate.id,
        departmentId: department.id,
      },
    })
    const service = await database.service.create({
      data: { name: "Design", description: "Design" },
    })
    async function request(clientId: string, departmentId: string) {
      return database.serviceRequest.create({
        data: {
          clientId,
          serviceId: service.id,
          title: "Design request",
          acceptedDepartmentId: departmentId,
          workflow: { create: {} },
        },
      })
    }
    const booking = await request(client.id, department.id)
    const otherBooking = await request(otherClient.id, otherDepartment.id)
    const unassignedBooking = await request(client.id, unassignedDepartment.id)
    const scheduled = await database.workflowConsultation.create({
      data: {
        requestId: booking.id,
        startsAt: new Date("2030-02-03T01:00:00Z"),
        endsAt: new Date("2030-02-03T02:00:00Z"),
        location: "https://example.com/meet",
      },
    })
    await database.workflowConsultation.create({
      data: {
        requestId: otherBooking.id,
        startsAt: scheduled.startsAt,
        endsAt: scheduled.endsAt,
        location: "private",
      },
    })
    const unassignedConsultation = await database.workflowConsultation.create({
      data: {
        requestId: unassignedBooking.id,
        startsAt: scheduled.startsAt,
        endsAt: scheduled.endsAt,
        location: "private",
      },
    })
    await database.workflowConsultation.create({
      data: {
        requestId: booking.id,
        startsAt: scheduled.startsAt,
        endsAt: scheduled.endsAt,
        location: "cancelled",
        status: "CANCELLED",
      },
    })
    const conversation = await database.requestConversation.create({
      data: { clientId: client.id, departmentId: department.id },
    })
    const meeting = await database.conversationMeeting.create({
      data: {
        conversationId: conversation.id,
        clientActionId: randomUUID(),
        startsAt: scheduled.startsAt,
        endsAt: scheduled.endsAt,
        notes: "",
        location: "https://example.com/meeting",
      },
    })
    const project = await database.project.create({
      data: {
        clientId: client.id,
        name: "Brand project",
        requestId: booking.id,
        startDate: scheduled.startsAt,
        status: "IN_PROGRESS",
        staff: {
          create: [employee, teammateEmployee].map((item) => ({
            employeeId: item.id,
            approvedById: head.id,
          })),
        },
        workPlan: {
          phases: [
            {
              id: "phase",
              title: "Delivery",
              tasks: [
                {
                  id: "own",
                  title: "My deadline",
                  role: "Designer",
                  status: "NOT_STARTED",
                  employeeId: employee.id,
                  dueDate: "2030-02-03",
                },
                {
                  id: "team",
                  title: "Team deadline",
                  role: "Designer",
                  status: "DONE",
                  employeeId: teammateEmployee.id,
                  dueDate: "2030-02-02",
                },
                {
                  id: "undated",
                  title: "Undated",
                  role: "Designer",
                  status: "NOT_STARTED",
                  employeeId: employee.id,
                },
              ],
            },
          ],
        },
        milestones: {
          create: {
            title: "Shared delivery",
            sentToClientAt: scheduled.startsAt,
          },
        },
      },
    })
    await database.project.create({
      data: {
        clientId: otherClient.id,
        name: "Private project",
        requestId: otherBooking.id,
        workPlan: {
          phases: [
            {
              id: "private",
              title: "Private",
              tasks: [
                {
                  id: "private",
                  title: "Private deadline",
                  role: "Designer",
                  status: "NOT_STARTED",
                  dueDate: "2030-02-03",
                },
              ],
            },
          ],
        },
      },
    })
    const mine = await listInternalCalendar(staff.id, "mine")
    assert.equal(mine.canViewTeam, false)
    assert.deepEqual(
      mine.events
        .filter((event) => event.type === "task")
        .map((event) => event.title),
      ["My deadline"],
    )
    assert.equal(
      mine.events
        .find((event) => event.type === "task")
        ?.startsAt.toISOString(),
      "2030-02-02T16:00:00.000Z",
    )
    assert.equal(
      mine.events.some(
        (event) =>
          event.type === "consultation" || event.title === "Private deadline",
      ),
      false,
    )
    await assert.rejects(
      listInternalCalendar(staff.id, "team"),
      /Team calendar access/,
    )
    await database.projectStaff.update({
      where: {
        projectId_employeeId: {
          projectId: project.id,
          employeeId: employee.id,
        },
      },
      data: { isTeamLead: true },
    })
    const team = await listInternalCalendar(staff.id, "team")
    assert.equal(team.canViewTeam, true)
    assert.equal(
      team.events.find((event) => event.title === "Team deadline")?.completed,
      true,
    )
    assert.equal(
      team.events.some((event) => event.title === "Private deadline"),
      false,
    )
    const headCalendar = await listInternalCalendar(head.id, "team")
    assert.equal(
      headCalendar.events.some(
        (event) => event.id === `consultation-${scheduled.id}`,
      ),
      true,
    )
    assert.equal(
      headCalendar.events.some((event) => event.id === `meeting-${meeting.id}`),
      true,
    )
    assert.equal(
      headCalendar.events.filter((event) => event.type === "task").length,
      2,
    )
    for (const person of [admin, superadmin]) {
      const organization = await listInternalCalendar(person.id, undefined)
      assert.equal(organization.organization, true)
      assert.equal(
        organization.events.some((event) => event.title === "Private deadline"),
        true,
      )
      assert.equal(
        organization.events.find(
          (event) => event.id === `consultation-${unassignedConsultation.id}`,
        )?.unassigned,
        true,
      )
      assert.equal(
        organization.events.every(
          (event) => event.href === null && event.location === null,
        ),
        true,
      )
      assert.equal(
        organization.events.filter((event) => event.type === "consultation")
          .length,
        3,
      )
    }
    await assert.rejects(
      listInternalCalendar(client.id, "team"),
      /Internal calendar access/,
    )
    await assert.rejects(
      listInternalCalendar(staff.id, "other"),
      /valid calendar scope/,
    )
    await database.department.update({
      where: { id: department.id },
      data: { headId: null },
    })
    const formerHead = await listInternalCalendar(head.id, "mine")
    assert.equal(formerHead.events.length, 0)
    await assert.rejects(
      listInternalCalendar(head.id, "team"),
      /Team calendar access/,
    )
    assert.equal((await fetch(`${base}/api/projects/calendar`)).status, 401)
    const token = (await issueSession(client)).token
    const clientResponse = await fetch(
      `${base}/api/projects/calendar?scope=team`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    assert.equal(clientResponse.status, 200)
    const clientEvents = (await clientResponse.json()) as {
      id: string
      completed: boolean
    }[]
    assert.equal(
      clientEvents.some((event) => event.id === `consultation-${scheduled.id}`),
      true,
    )
    assert.equal(
      clientEvents.find((event) => event.id === `consultation-${scheduled.id}`)
        ?.completed,
      false,
    )
    assert.equal(
      clientEvents.some((event) => event.id.startsWith("task-")),
      false,
    )
    await database.user.update({
      where: { id: staff.id },
      data: { isActive: false },
    })
    await assert.rejects(
      listInternalCalendar(staff.id, "mine"),
      /Internal calendar access/,
    )
  },
)
