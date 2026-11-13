import { getPrisma } from "../../lib/db.js"
import {
  consultationCalendarWhere,
  meetingCalendarWhere,
} from "./calendar.queries.js"

export async function listClientCalendar(clientId: string) {
  const prisma = getPrisma()!
  const [consultations, meetings, milestones] = await Promise.all([
    prisma.workflowConsultation.findMany({
      where: consultationCalendarWhere({
        scope: { kind: "CLIENT", userId: clientId },
      }),
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        location: true,
        status: true,
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
      where: meetingCalendarWhere({
        scope: { kind: "CLIENT", userId: clientId },
      }),
      select: {
        id: true,
        conversationId: true,
        proposedStartsAt: true,
        status: true,
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
        completedAt: true,
        project: { select: { id: true, name: true } },
      },
    }),
  ])

  return [
    ...consultations.map(
      ({ id, startsAt, endsAt, location, status, workflow: { request } }) => ({
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
        completed: status === "COMPLETED",
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
        status,
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
        completed: status === "COMPLETED",
        href: `/messages?request=${encodeURIComponent(conversationId)}`,
      }),
    ),
    ...milestones.flatMap(
      ({ id, title, sentToClientAt, completedAt, project }) =>
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
                completed: Boolean(completedAt),
                href: `/projects/${encodeURIComponent(project.id)}`,
              },
            ]
          : [],
    ),
  ]
}
