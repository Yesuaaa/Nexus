import type { PrismaClient } from "../../src/generated/prisma/client.js"
import { hashPassword } from "../../src/features/auth/auth.password.js"
import {
  assertShowcasePassword,
  assertShowcaseTarget,
} from "./showcase-plan.js"
import { assertShowcaseRealtimeDisabled } from "./showcase-realtime.js"

export function assertPhase2Target(env: NodeJS.ProcessEnv) {
  const target = assertShowcaseTarget(env)
  if (
    target.database !== "nexus_showcase" &&
    !(target.database === "nexus_dev" && env.SHOWCASE_ALLOW_DEV === "true")
  )
    throw new Error(
      "Phase 2 requires the separate local nexus_showcase database",
    )
  if (env.SHOWCASE_CONFIRM_TARGET !== target.database)
    throw new Error("Set SHOWCASE_CONFIRM_TARGET to the exact database name")
  return target
}

/** Prepare the fictional department needed by the existing Phase 1 seed. */
export async function bootstrapShowcase(
  prisma: PrismaClient,
  password: string,
) {
  assertShowcasePassword(password)
  const passwordHash = await hashPassword(password)
  return prisma.$transaction(async (tx) => {
    await assertShowcaseRealtimeDisabled(tx)
    const counts = await Promise.all([
      tx.user.count(),
      tx.department.count(),
      tx.service.count(),
    ])
    if (counts.some(Boolean))
      throw new Error(
        "Showcase bootstrap requires an empty user, department, and service catalog",
      )
    await tx.user.create({
      data: {
        id: "showcase-bootstrap-head",
        email: "head@showcase.invalid",
        fullName: "Showcase Studio Head",
        role: "STAFF",
        passwordHash,
      },
    })
    await tx.department.create({
      data: {
        id: "showcase-bootstrap-department",
        name: "Showcase Studio",
        headId: "showcase-bootstrap-head",
      },
    })
    await tx.service.create({
      data: {
        id: "showcase-bootstrap-service",
        name: "Digital Project Delivery",
        description: "Fictional showcase project delivery service.",
        requiresAgreement: false,
        requiresPayment: false,
        departments: { connect: { id: "showcase-bootstrap-department" } },
      },
    })
  })
}
