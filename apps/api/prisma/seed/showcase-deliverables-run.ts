import "dotenv/config"
import { getPrisma, disconnectPrisma } from "../../src/lib/db.js"
import { assertPhase2Target } from "./showcase-phase2-foundation.js"
import { assertShowcaseRealtimeDisabled } from "./showcase-realtime.js"
import { showcaseId, showcaseUuid } from "./showcase-plan.js"
import { seedFeaturedDeliverables } from "./showcase-deliverables.js"

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
      const project = await tx.project.findFirst({
        where: {
          clientId: showcaseId("user", 22),
          status: "IN_PROGRESS",
          request: {
            submissionKey: showcaseUuid("featured-request", 0),
            acceptedDepartment: {
              head: {
                email,
                role: "STAFF",
                isActive: true,
                accountDeletedAt: null,
              },
            },
            workflow: { state: "ACTIVE_PROJECT" },
          },
        },
        select: {
          id: true,
          workspaceGroupId: true,
          request: {
            select: { acceptedDepartment: { select: { headId: true } } },
          },
          milestones: {
            orderBy: { displayOrder: "asc" },
            select: { title: true, deliveryStatus: true, workflowFileId: true },
          },
        },
      })
      if (
        !project ||
        project.workspaceGroupId ||
        !project.request?.acceptedDepartment?.headId
      )
        throw new Error("The featured showcase project is unavailable")
      return {
        projectId: project.id,
        headId: project.request.acceptedDepartment.headId,
        deliverables: project.milestones,
      }
    })
    const workspaceId = `ungrouped-project:${inventory.projectId}`
    const result =
      mode === "--apply"
        ? await seedFeaturedDeliverables(
            inventory.headId,
            workspaceId,
            inventory.projectId,
          )
        : null
    console.log(
      JSON.stringify({
        database: target.database,
        mode,
        workspaceId,
        deliverables: inventory.deliverables.map(
          ({ title, deliveryStatus, workflowFileId }) => ({
            title,
            status: deliveryStatus,
            hasFile: !!workflowFileId,
          }),
        ),
        result,
      }),
    )
  } finally {
    await disconnectPrisma()
  }
}
main().catch(() => {
  console.error(
    "Showcase deliverables failed. Check project state and the configured target.",
  )
  process.exitCode = 1
})
