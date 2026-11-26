import "dotenv/config"
import { disconnectPrisma, getPrisma } from "../../src/lib/db.js"
import { assertPhase2Target } from "./showcase-phase2-foundation.js"
import { assertShowcaseRealtimeDisabled } from "./showcase-realtime.js"
import { showcaseId, showcaseUuid } from "./showcase-plan.js"
import { seedFeaturedShowcase } from "./showcase-featured.js"

async function main() {
  const mode = process.argv[2] ?? "--dry-run"
  if (!["--dry-run", "--apply"].includes(mode) || process.argv.length > 3)
    throw new Error("Choose --dry-run or --apply")
  const target = assertPhase2Target(process.env)
  const email = process.env.SHOWCASE_HEAD_EMAIL
  if (!email)
    throw new Error("Set SHOWCASE_HEAD_EMAIL to the confirmed department head")
  const prisma = getPrisma()
  if (!prisma) throw new Error("Database configuration is required")
  try {
    const inventory = await prisma.$transaction(async (tx) => {
      const [current] = await tx.$queryRaw<
        { name: string }[]
      >`SELECT current_database() AS name`
      if (current?.name !== target.database)
        throw new Error("Connected database does not match confirmed target")
      await assertShowcaseRealtimeDisabled(tx)
      const department = await tx.department.findFirst({
        where: {
          head: {
            email,
            role: "STAFF",
            isActive: true,
            accountDeletedAt: null,
          },
        },
        select: { id: true, headId: true },
      })
      if (!department?.headId)
        throw new Error("The selected account is not an active department head")
      const employeeIds = Array.from({ length: 6 }, (_, index) =>
        showcaseId("employee", index),
      )
      const eligibleStaff = await tx.employee.count({
        where: {
          id: { in: employeeIds },
          departmentId: department.id,
          status: "ACTIVE",
          user: { role: "STAFF", isActive: true, accountDeletedAt: null },
        },
      })
      const service = await tx.service.findUnique({
        where: { name: "Showcase Retail Brand Design" },
        include: { departments: true, packages: true },
      })
      const eligibleService =
        !!service &&
        service.isActive &&
        !service.requiresConsultation &&
        !service.requiresAgreement &&
        !service.requiresPayment &&
        !service.requiresQuotationApproval &&
        service.packages.length === 0 &&
        service.departments.length === 1 &&
        service.departments[0].id === department.id
      const client = await tx.user.findUnique({
        where: { id: showcaseId("user", 22) },
        select: {
          email: true,
          role: true,
          isActive: true,
          accountDeletedAt: true,
        },
      })
      const existing = await tx.serviceRequest.findFirst({
        where: {
          clientId: showcaseId("user", 22),
          submissionKey: showcaseUuid("featured-request", 0),
        },
        select: {
          id: true,
          workflow: { select: { state: true } },
          project: { select: { id: true, name: true } },
        },
      })
      return {
        headId: department.headId,
        eligibleStaff,
        eligibleService,
        client: client?.email ?? null,
        eligibleClient:
          client?.role === "USER" &&
          client.isActive &&
          !client.accountDeletedAt,
        existing,
      }
    })
    if (
      inventory.eligibleStaff !== 6 ||
      !inventory.eligibleService ||
      !inventory.eligibleClient
    )
      throw new Error("Featured showcase prerequisites are incomplete")
    const result =
      mode === "--apply" ? await seedFeaturedShowcase(inventory.headId) : null
    console.log(
      JSON.stringify({
        database: target.database,
        head: email,
        mode,
        eligibleStaff: inventory.eligibleStaff,
        client: inventory.client,
        existing: inventory.existing,
        result,
      }),
    )
  } finally {
    await disconnectPrisma()
  }
}
main().catch(() => {
  console.error(
    "Featured showcase failed. Check prerequisites and the configured target.",
  )
  process.exitCode = 1
})
