import { randomUUID } from "node:crypto"
import { issueSession } from "../../src/features/auth/auth.service.js"
import type { PrismaClient, Role } from "../../src/generated/prisma/client.js"

export async function seedPg018(prisma: PrismaClient) {
  async function actor(label: string, role: Role) {
    const user = await prisma.user.create({
      data: {
        email: `pg018-${label}@example.test`,
        fullName: `Calendar ${label}`,
        passwordHash: "synthetic-only",
        role,
      },
    })
    return { user, token: (await issueSession(user)).token }
  }
  const a = await actor("a", "USER"),
    b = await actor("b", "USER"),
    head = await actor("head", "STAFF"),
    staff = await actor("staff", "STAFF"),
    other = await actor("other", "STAFF"),
    admin = await actor("admin", "ADMIN")
  const department = await prisma.department.create({
    data: { name: "Calendar Design", headId: head.user.id },
  })
  const otherDepartment = await prisma.department.create({
    data: { name: "Calendar Other" },
  })
  const employee = await prisma.employee.create({
    data: {
      employeeId: "PG018-STAFF",
      fullName: "Calendar Staff",
      userId: staff.user.id,
      departmentId: department.id,
    },
  })
  const otherEmployee = await prisma.employee.create({
    data: {
      employeeId: "PG018-OTHER",
      fullName: "Calendar Other",
      userId: other.user.id,
      departmentId: otherDepartment.id,
    },
  })
  const service = await prisma.service.create({
    data: { name: "Calendar service", description: "Synthetic" },
  })
  async function clientRecords(clientId: string, label: string) {
    const booking = await prisma.serviceRequest.create({
      data: {
        clientId,
        serviceId: service.id,
        title: `Calendar booking ${label}`,
        acceptedDepartmentId: department.id,
        workflow: { create: {} },
      },
    })
    const consultation = await prisma.workflowConsultation.create({
      data: {
        requestId: booking.id,
        startsAt: new Date("2030-02-03T03:00:00Z"),
        endsAt: new Date("2030-02-03T04:00:00Z"),
        location: `https://example.test/${label}`,
      },
    })
    const conversation = await prisma.requestConversation.create({
      data: { clientId, departmentId: department.id },
    })
    const meeting = await prisma.conversationMeeting.create({
      data: {
        conversationId: conversation.id,
        clientActionId: randomUUID(),
        startsAt: consultation.startsAt,
        endsAt: consultation.endsAt,
        notes: "Private meeting note",
        location: `https://example.test/meeting-${label}`,
      },
    })
    const project = await prisma.project.create({
      data: {
        clientId,
        requestId: booking.id,
        name: `Calendar project ${label}`,
        startDate: consultation.startsAt,
        status: "IN_PROGRESS",
        staff: {
          create: { employeeId: employee.id, approvedById: head.user.id },
        },
        workPlan: {
          phases: [
            {
              id: "phase",
              title: "Delivery",
              tasks: [
                {
                  id: "due",
                  title: `Deadline ${label}`,
                  role: "Designer",
                  status: "DONE",
                  dueDate: "2030-02-03",
                  employeeId: employee.id,
                },
                {
                  id: "undated",
                  title: "Undated hidden task",
                  role: "Designer",
                  status: "NOT_STARTED",
                  employeeId: employee.id,
                },
              ],
            },
          ],
        },
        milestones: {
          create: [
            {
              title: `Shared milestone ${label}`,
              sentToClientAt: consultation.startsAt,
            },
            { title: `Private milestone ${label}` },
          ],
        },
      },
      include: { milestones: true },
    })
    return { booking, consultation, conversation, meeting, project }
  }
  const own = await clientRecords(a.user.id, "A"),
    foreign = await clientRecords(b.user.id, "B")
  return {
    a,
    b,
    head,
    staff,
    other,
    admin,
    department,
    otherDepartment,
    employee,
    otherEmployee,
    own,
    foreign,
  }
}

export async function calendarSnapshot(prisma: PrismaClient) {
  const orderBy = { id: "asc" } as const
  return {
    requests: await prisma.serviceRequest.findMany({ orderBy }),
    workflows: await prisma.requestWorkflow.findMany({
      orderBy: { requestId: "asc" },
    }),
    consultations: await prisma.workflowConsultation.findMany({ orderBy }),
    meetings: await prisma.conversationMeeting.findMany({ orderBy }),
    projects: await prisma.project.findMany({ orderBy }),
    milestones: await prisma.projectMilestone.findMany({ orderBy }),
    leaves: await prisma.leaveRequest.findMany({ orderBy }),
  }
}
