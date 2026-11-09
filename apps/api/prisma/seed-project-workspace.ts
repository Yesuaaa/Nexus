import "dotenv/config"
import { getPrisma } from "../src/lib/db.js"
import { makeWorkPlan } from "../src/features/project-workspace/templates.js"
import type { Prisma } from "../src/generated/prisma/client.js"

const prisma = getPrisma()
if (!prisma) throw new Error("Database configuration is required")

try {
  const department = await prisma.department.findFirst({
    where: {
      name: "Advertising",
      head: { role: "STAFF", isActive: true, accountDeletedAt: null },
    },
    select: { id: true, headId: true },
  })
  if (!department?.headId)
    throw new Error("Advertising needs an active department head")
  const source = await prisma.project.findFirst({
    where: {
      request: { acceptedDepartmentId: department.id },
      client: { role: "USER", isActive: true, accountDeletedAt: null },
    },
    select: { clientId: true, request: { select: { serviceId: true } } },
  })
  if (!source?.request)
    throw new Error("An existing Advertising booking is required")
  const examples = [
    {
      key: "website",
      name: "Demo · Website Refresh",
      template: "website-development",
    },
    {
      key: "social",
      name: "Demo · Monthly Social Content",
      template: "social-media-management",
    },
    {
      key: "campaign",
      name: "Demo · Summer Campaign",
      template: "paid-ads-campaign",
    },
  ]
  for (const example of examples) {
    const groupId = `demo-workspace-${example.key}`
    const exists = await prisma.projectWorkspaceGroup.findUnique({
      where: { id: groupId },
      select: { id: true },
    })
    if (exists) {
      console.log(`Already seeded: ${example.name}`)
      continue
    }
    await prisma.$transaction(async (tx) => {
      const group = await tx.projectWorkspaceGroup.create({
        data: {
          id: groupId,
          name: example.name,
          structure: "SEPARATE",
          clientId: source.clientId,
          createdById: department.headId!,
        },
      })
      const request = await tx.serviceRequest.create({
        data: {
          id: `demo-workspace-request-${example.key}`,
          clientId: source.clientId,
          serviceId: source.request!.serviceId,
          title: example.name,
          description:
            "Sample workspace for UI review. This is not a live client booking.",
          acceptedDepartmentId: department.id,
          acceptedById: department.headId,
          acceptedAt: new Date(),
          workflow: { create: { state: "CONSULTATION" } },
        },
      })
      const plan = makeWorkPlan(example.template)
      const tasks = plan.phases.flatMap((phase) => phase.tasks)
      if (tasks[0]) tasks[0].status = "DONE"
      if (tasks[1]) tasks[1].status = "IN_PROGRESS"
      const project = await tx.project.create({
        data: {
          id: `demo-workspace-project-${example.key}`,
          name: example.name,
          clientId: source.clientId,
          requestId: request.id,
          workspaceGroupId: group.id,
          status: "PLANNED",
          templateKey: example.template,
          description:
            "Illustrative work plan with sample task progress. Staffing and service activation still require the department head's normal approval workflow.",
          workPlan: plan as Prisma.InputJsonValue,
          milestones: {
            create: [
              { title: "Review project brief", displayOrder: 0 },
              { title: "Deliver approved work", displayOrder: 1 },
            ],
          },
        },
      })
      await tx.workflowEvent.create({
        data: {
          requestId: request.id,
          actorId: department.headId,
          type: "WORKSPACE_CREATED",
          summary:
            "Created a demonstration workspace with sample template tasks.",
          entityId: project.id,
          internal: true,
        },
      })
    })
    console.log(`Seeded: ${example.name}`)
  }
} finally {
  await prisma.$disconnect()
}
