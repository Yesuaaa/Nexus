import { issueSession } from "../../src/features/auth/auth.service.js"
import type { PrismaClient } from "../../src/generated/prisma/client.js"

export async function seedPg017(prisma: PrismaClient) {
  const users = await Promise.all(
    ["a", "b"].map((label) =>
      prisma.user.create({
        data: {
          email: `pg017-${label}@example.test`,
          fullName: `PG017 Client ${label}`,
          role: "USER",
          passwordHash: "synthetic-test-only",
        },
      }),
    ),
  )
  const a = users[0]!,
    b = users[1]!
  const service = await prisma.service.create({
    data: {
      name: "PG017 synthetic service",
      description: "Isolated booking fixture",
    },
  })
  const bookings = []
  for (const [index, user] of [a, b].entries())
    bookings.push(
      await prisma.serviceRequest.create({
        data: {
          id: `pg017-booking-${index}`,
          clientId: user.id,
          serviceId: service.id,
          referenceNumber: `PG017-REF-${index}`,
          title: `PG017 request ${index}`,
          projectGoals: `Private synthetic goals ${index}`,
          projectRequirements: "Synthetic requirements",
          expectedTimeline: "Four weeks",
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
      }),
    )
  return {
    a: { user: a, token: (await issueSession(a)).token },
    b: { user: b, token: (await issueSession(b)).token },
    service,
    own: bookings[0]!,
    foreign: bookings[1]!,
  }
}
