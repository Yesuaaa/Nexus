import { createHash } from "node:crypto"
import { getPrisma } from "../../src/lib/db.js"
import {
  uploadProjectDeliverable,
  reviewProjectDeliverable,
  sendProjectDeliverableToClient,
} from "../../src/features/project-workspace/project-workspace.service.js"
import { assertPhase2Target } from "./showcase-phase2-foundation.js"
import { assertShowcaseRealtimeDisabled } from "./showcase-realtime.js"
import { showcaseId, showcaseUuid } from "./showcase-plan.js"

const examples = [
  {
    title: "Campaign strategy document",
    name: "showcase-campaign-strategy.txt",
    body: "Fictional showcase document\n\nCampaign strategy: define the audience, align creative messaging, and review campaign outcomes with the client.\n",
    final: "SENT_TO_CLIENT",
  },
  {
    title: "Audience research report",
    name: "showcase-audience-research.txt",
    body: "Fictional showcase document\n\nAudience research: summarize proposed customer segments and questions to validate during campaign planning.\n",
    final: "APPROVED",
  },
  {
    title: "Creative concept presentation",
    name: "showcase-creative-concepts.txt",
    body: "Fictional showcase document\n\nCreative concepts: describe visual directions and draft messages for internal review.\n",
    final: "IN_REVIEW",
  },
] as const

/** Uses the supported upload and review workflow for real, labeled demo files. */
export async function seedFeaturedDeliverables(
  headId: string,
  workspaceId: string,
  projectId: string,
) {
  const target = assertPhase2Target(process.env)
  const prisma = getPrisma()
  if (!prisma) throw new Error("Database configuration is required")
  await prisma.$transaction(async (tx) => {
    const [current] = await tx.$queryRaw<
      { name: string }[]
    >`SELECT current_database() AS name`
    if (current?.name !== target.database)
      throw new Error("Connected database does not match confirmed target")
    await assertShowcaseRealtimeDisabled(tx)
  })
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      clientId: showcaseId("user", 22),
      status: "IN_PROGRESS",
      request: {
        submissionKey: showcaseUuid("featured-request", 0),
        acceptedDepartment: {
          headId,
          head: { isActive: true, role: "STAFF", accountDeletedAt: null },
        },
        workflow: { state: "ACTIVE_PROJECT" },
      },
    },
    include: {
      client: {
        select: {
          email: true,
          role: true,
          isActive: true,
          accountDeletedAt: true,
        },
      },
      milestones: {
        orderBy: { displayOrder: "asc" },
        include: { workflowFile: true },
      },
      staff: { include: { employee: { include: { user: true } } } },
    },
  })
  if (
    !project ||
    workspaceId !== `ungrouped-project:${project.id}` ||
    project.workspaceGroupId !== null ||
    project.milestones.length !== 6 ||
    project.client.email !== "client1@showcase.invalid" ||
    project.client.role !== "USER" ||
    !project.client.isActive ||
    project.client.accountDeletedAt
  )
    throw new Error("The expected featured showcase project is required")
  const actorId = showcaseId("user", 2)
  const actor = project.staff.find(
    (member) => member.employeeId === showcaseId("employee", 0),
  )?.employee
  if (
    !actor ||
    actor.user?.id !== actorId ||
    actor.user.email !== "team1@showcase.invalid" ||
    !actor.user.isActive ||
    actor.user.accountDeletedAt ||
    actor.status !== "ACTIVE"
  )
    throw new Error("The expected fictional contributor is unavailable")
  for (const [index, example] of examples.entries()) {
    const milestone = project.milestones[index]
    if (!milestone || milestone.title !== example.title)
      throw new Error(
        "The featured deliverables changed; refusing to overwrite them",
      )
    const bytes = Buffer.from(example.body, "utf8")
    const uploadId = showcaseUuid("featured-deliverable-upload", index)
    const expectedHash = createHash("sha256").update(bytes).digest("hex")
    if (
      milestone.workflowFile &&
      (milestone.workflowFile.uploadId !== uploadId ||
        milestone.workflowFile.uploaderId !== actorId ||
        milestone.workflowFile.sha256 !== expectedHash ||
        milestone.workflowFile.name !== example.name)
    )
      throw new Error(
        "A deliverable contains a different file; refusing to overwrite it",
      )
    if (!milestone.workflowFile && milestone.deliveryStatus !== "NOT_SUBMITTED")
      throw new Error(
        "A deliverable has unexpected state; refusing to change it",
      )
    if (
      milestone.workflowFile &&
      !["IN_REVIEW", "APPROVED", "SENT_TO_CLIENT"].includes(
        milestone.deliveryStatus,
      )
    )
      throw new Error(
        "A deliverable has unexpected state; refusing to change it",
      )
  }
  const counts = { uploaded: 0, approved: 0, sent: 0, skipped: 0 }
  for (const [index, example] of examples.entries()) {
    const milestone = project.milestones[index]!
    let state = milestone.deliveryStatus
    if (state === "NOT_SUBMITTED") {
      await uploadProjectDeliverable(
        actorId,
        workspaceId,
        projectId,
        milestone.id,
        {
          uploadId: showcaseUuid("featured-deliverable-upload", index),
          name: example.name,
          mimeType: "text/plain",
          content: Buffer.from(example.body, "utf8").toString("base64"),
          note: "Fictional showcase material for review.",
        },
      )
      counts.uploaded++
      state = "IN_REVIEW"
    }
    if (state === "IN_REVIEW" && example.final !== "IN_REVIEW") {
      await reviewProjectDeliverable(
        headId,
        workspaceId,
        projectId,
        milestone.id,
        "approve",
      )
      counts.approved++
      state = "APPROVED"
    }
    if (state === "APPROVED" && example.final === "SENT_TO_CLIENT") {
      await sendProjectDeliverableToClient(
        headId,
        workspaceId,
        projectId,
        milestone.id,
      )
      counts.sent++
      state = "SENT_TO_CLIENT"
    }
    if (milestone.deliveryStatus === state) counts.skipped++
  }
  return counts
}
