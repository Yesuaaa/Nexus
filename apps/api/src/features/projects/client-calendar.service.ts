import { getPrisma } from "../../lib/db.js"

export async function listClientCalendar(clientId: string) {
  const prisma = getPrisma()!
  const [consultations, meetings, milestones] = await Promise.all([
    prisma.workflowConsultation.findMany({
      where: {
        status: { not: "CANCELLED" },
        workflow: { request: { clientId, status: { not: "CANCELLED" } } },
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        location: true,
        workflow: {
          select: {
            request: {
              select: {
                id: true,
                referenceNumber: true,
                service: { select: { name: true } },
                acceptedDepartment: {
                  select: { head: { select: { fullName: true } } },
                },
              },
            },
          },
        },
      },
    }),
    prisma.conversationMeeting.findMany({
      where: { status: { not: "CANCELLED" }, conversation: { clientId } },
      select: {
        id: true,
        conversationId: true,
        proposedStartsAt: true,
        startsAt: true,
        endsAt: true,
        location: true,
        bookings: {
          where: { booking: { clientId } },
          select: {
            booking: {
              select: { service: { select: { name: true } } },
            },
          },
        },
      },
    }),
    prisma.projectMilestone.findMany({
      where: {
        sentToClientAt: { not: null },
        project: { clientId, startDate: { not: null } },
      },
      select: {
        id: true,
        title: true,
        sentToClientAt: true,
        project: { select: { id: true, name: true } },
      },
    }),
  ])

  return [
    ...consultations.map(
      ({ id, startsAt, endsAt, location, workflow: { request } }) => ({
        id: `consultation-${id}`,
        type: "consultation",
        title: `${request.service.name} consultation`,
        context: request.referenceNumber
          ? `Booking · ${request.referenceNumber}`
          : "Service booking",
        startsAt,
        endsAt,
        location,
        staff: request.acceptedDepartment?.head?.fullName ?? null,
        pending: false,
        href: `/messages?request=${encodeURIComponent(request.id)}`,
      }),
    ),
    ...meetings.map(
      ({
        id,
        conversationId,
        startsAt,
        endsAt,
        location,
        bookings,
        proposedStartsAt,
      }) => ({
        id: `meeting-${id}`,
        type: "meeting",
        title: "Service meeting",
        context:
          [
            ...new Set(bookings.map(({ booking }) => booking.service.name)),
          ].join(", ") || "Service conversation",
        startsAt,
        endsAt,
        location,
        staff: null,
        pending: Boolean(proposedStartsAt),
        href: `/messages?request=${encodeURIComponent(conversationId)}`,
      }),
    ),
    ...milestones.flatMap(({ id, title, sentToClientAt, project }) =>
      sentToClientAt
        ? [
            {
              id: `milestone-${id}`,
              type: "milestone",
              title,
              context: `${project.name} · Shared deliverable`,
              startsAt: sentToClientAt,
              endsAt: null,
              location: null,
              staff: null,
              pending: false,
              href: `/projects/${encodeURIComponent(project.id)}`,
            },
          ]
        : [],
    ),
  ]
}
