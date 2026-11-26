import type { Prisma, PrismaClient } from "../../src/generated/prisma/client.js"
import { createHash } from "node:crypto"
import { hashPassword } from "../../src/features/auth/auth.password.js"
import { makeWorkPlan } from "../../src/features/project-workspace/templates.js"
import { assertShowcaseRealtimeDisabled } from "./showcase-realtime.js"
import {
  organizations,
  plannedCounts,
  SHOWCASE_PREFIX,
  showcaseId,
  showcaseUuid,
} from "./showcase-plan.js"

const day = 86400000
const atDay = (anchor: Date, offset: number) =>
  new Date(
    Date.UTC(
      anchor.getUTCFullYear(),
      anchor.getUTCMonth(),
      anchor.getUTCDate() + offset,
    ),
  )
const fictionalStaff = [
  "Mara Villanueva",
  "Paolo Rivera",
  "Celina Santos",
  "Adrian Castillo",
  "Lea Mendoza",
  "Rafael Lim",
  "Nina Flores",
  "Enzo Cruz",
  "Sofia Ramos",
  "Daniel Reyes",
  "Bianca Torres",
  "Miguel Garcia",
  "Alina Bautista",
  "Luis Navarro",
  "Paula Dizon",
  "Marco Flores",
  "Janelle Rivera",
  "Carlo Mendoza",
  "Elena Tan",
  "Tomas Aquino",
]
const positions = [
  "Digital Studio Lead",
  "Project Coordinator",
  "Designer",
  "Web Developer",
]
const clientFor = (index: number) =>
  index < 4 ? 0 : index % organizations.length
const userId = (index: number) => showcaseId("user", index)
const employeeId = (index: number) => showcaseId("employee", index)
const requestId = (index: number) => showcaseId("request", index)
const projectId = (index: number) => showcaseId("project", index)

export async function seedShowcase(
  prisma: PrismaClient,
  password: string,
  now = new Date(),
) {
  const passwordHash = await hashPassword(password)
  return prisma.$transaction(
    async (tx) => {
      await assertShowcaseRealtimeDisabled(tx)
      const schema = await tx.$queryRaw<
        { inquiries: string | null }[]
      >`SELECT to_regclass('public."ServiceInquiry"')::text AS inquiries`
      if (!schema[0]?.inquiries)
        throw new Error(
          "The local database is missing the service inquiry migration; apply the repository migrations only after explicit approval",
        )
      const existing = await tx.user.findMany({
        where: { id: { startsWith: SHOWCASE_PREFIX } },
        select: { id: true, email: true, role: true },
      })
      if (existing.length) {
        const expected = Array.from(
          { length: plannedCounts.accounts },
          (_, index) => userId(index),
        )
        if (
          existing.length !== expected.length ||
          existing.some((row) => {
            const index = expected.indexOf(row.id)
            const email =
              index === 0
                ? "oversight@showcase.invalid"
                : index === 1
                  ? "operations@showcase.invalid"
                  : index < 22
                    ? `team${index - 1}@showcase.invalid`
                    : `client${index - 21}@showcase.invalid`
            const role =
              index === 0
                ? "SUPERADMIN"
                : index === 1
                  ? "ADMIN"
                  : index < 22
                    ? "STAFF"
                    : "USER"
            return index < 0 || row.email !== email || row.role !== role
          })
        )
          throw new Error(
            "Showcase identifiers are already in use; refusing to overwrite records",
          )
        const actual = await Promise.all([
          tx.employee.count({ where: { id: { startsWith: SHOWCASE_PREFIX } } }),
          tx.serviceRequest.count({
            where: { id: { startsWith: SHOWCASE_PREFIX } },
          }),
          tx.project.count({ where: { id: { startsWith: SHOWCASE_PREFIX } } }),
          tx.invoice.count({ where: { id: { startsWith: SHOWCASE_PREFIX } } }),
          tx.invoicePayment.count({
            where: { id: { startsWith: SHOWCASE_PREFIX } },
          }),
          tx.expense.count({ where: { id: { startsWith: SHOWCASE_PREFIX } } }),
          tx.serviceInquiry.count({
            where: { id: { startsWith: SHOWCASE_PREFIX } },
          }),
          tx.servicePackage.count({
            where: { id: { startsWith: SHOWCASE_PREFIX } },
          }),
          tx.requestConversation.count({
            where: { id: { startsWith: SHOWCASE_PREFIX } },
          }),
          tx.serviceRequestMessage.count({
            where: { id: { startsWith: SHOWCASE_PREFIX } },
          }),
          tx.internalConversation.count({
            where: { id: { startsWith: SHOWCASE_PREFIX } },
          }),
          tx.internalMessage.count({
            where: { id: { startsWith: SHOWCASE_PREFIX } },
          }),
        ])
        if (
          actual.some(
            (count, index) =>
              count !==
              [
                plannedCounts.employees,
                plannedCounts.requests,
                plannedCounts.projects,
                plannedCounts.invoices,
                plannedCounts.payments,
                plannedCounts.expenses,
                plannedCounts.inquiries,
                plannedCounts.packages,
                plannedCounts.conversations,
                plannedCounts.requestMessages,
                plannedCounts.internalConversations,
                plannedCounts.internalMessages,
              ][index],
          )
        )
          throw new Error(
            "The showcase dataset is incomplete or modified; refusing to overwrite records",
          )
        return { created: false, counts: plannedCounts }
      }
      const department = await tx.department.findFirst({
        where: {
          head: { role: "STAFF", isActive: true, accountDeletedAt: null },
          services: { some: { isActive: true } },
        },
        select: {
          id: true,
          headId: true,
          services: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              requiresConsultation: true,
              requiresAgreement: true,
              requiresPayment: true,
              requiresQuotationApproval: true,
            },
            orderBy: { name: "asc" },
          },
        },
        orderBy: { name: "asc" },
      })
      if (!department?.headId || !department.services.length)
        throw new Error(
          "An existing department with an active staff head and assigned active service is required",
        )
      const services = department.services
      const adminId = userId(1)
      const staffId = (index: number) => userId(index + 2)
      const clientId = (index: number) => userId(index + 22)
      const deptId = department.id
      const headId = department.headId
      const packageNames = [
        "Foundation",
        "Growth",
        "Momentum",
        "Creative Launch",
        "Digital Presence",
        "Campaign Essentials",
        "Brand Essentials",
        "Audience Growth",
        "Content Studio",
        "Performance Review",
        "Market Discovery",
        "Conversion Focus",
        "Business Starter",
        "Customer Experience",
        "Strategic Planning",
        "Monthly Partnership",
        "Digital Refresh",
        "Launch Support",
      ]
      for (let i = 0; i < plannedCounts.packages; i++) {
        await tx.servicePackage.create({
          data: {
            id: showcaseId("package", i),
            serviceId: services[i % services.length].id,
            name: packageNames[i],
            description:
              "A focused engagement with planning, production and review.",
            includedFeatures: [
              "Project discovery",
              "Delivery planning",
              "Progress review",
            ],
            pricingModel: "FIXED",
            currency: "PHP",
            amount: (12500 + i * 1250).toFixed(2),
            displayOrder: i,
            isPricingPublic: true,
          },
        })
      }
      await tx.user.create({
        data: {
          id: userId(0),
          email: "oversight@showcase.invalid",
          fullName: "Isabel Navarro",
          role: "SUPERADMIN",
          passwordHash,
        },
      })
      await tx.user.create({
        data: {
          id: adminId,
          email: "operations@showcase.invalid",
          fullName: "Gabriel Tan",
          role: "ADMIN",
          passwordHash,
        },
      })
      for (let i = 0; i < fictionalStaff.length; i++) {
        await tx.user.create({
          data: {
            id: staffId(i),
            email: `team${i + 1}@showcase.invalid`,
            fullName: fictionalStaff[i],
            role: "STAFF",
            passwordHash,
            departmentId: deptId,
          },
        })
        await tx.employee.create({
          data: {
            id: employeeId(i),
            employeeId: `SHOWCASE-${String(i + 1).padStart(3, "0")}`,
            userId: staffId(i),
            fullName: fictionalStaff[i],
            email: `team${i + 1}@showcase.invalid`,
            position: positions[i % positions.length],
            departmentId: deptId,
            startDate: atDay(now, -365),
          },
        })
        await tx.employeeCompensation.create({
          data: {
            id: showcaseId("compensation", i),
            employeeId: employeeId(i),
            payType: "MONTHLY",
            baseRate: ["48000.00", "36000.00", "32000.00", "40000.00"][i % 4],
            currency: "PHP",
            effectiveFrom: atDay(now, -365),
            createdById: adminId,
            changeReason: "Fictional showcase compensation",
          },
        })
      }
      for (let i = 0; i < organizations.length; i++)
        await tx.user.create({
          data: {
            id: clientId(i),
            email: `client${i + 1}@showcase.invalid`,
            fullName: organizations[i],
            role: "USER",
            passwordHash,
          },
        })
      for (let i = 0; i < plannedCounts.internalConversations; i++) {
        const participants = [staffId(i * 2), staffId(i * 2 + 1)].sort()
        const conversationId = showcaseId("internal-conversation", i)
        await tx.internalConversation.create({
          data: {
            id: conversationId,
            participantKey: participants.join(":"),
            participantOneId: participants[0],
            participantTwoId: participants[1],
            participants: {
              create: participants.map((userId, index) => ({
                userId,
                readAt: index === 0 ? atDay(now, -1) : null,
              })),
            },
            createdAt: atDay(now, -12 + i),
            updatedAt: atDay(now, -i),
          },
        })
        for (let j = 0; j < 2; j++)
          await tx.internalMessage.create({
            data: {
              id: showcaseId(`internal-message-${i}`, j),
              conversationId,
              senderId: participants[j],
              clientMessageId: showcaseUuid(`internal-message-${i}`, j),
              body: [
                "The project brief is ready for the team review.",
                "Thanks, I will prepare the next steps before our meeting.",
              ][j],
              createdAt: atDay(now, -i - 1 + j),
            },
          })
      }
      for (let i = 0; i < organizations.length; i++) {
        await tx.requestConversation.create({
          data: {
            id: showcaseId("conversation", i),
            clientId: clientId(i),
            departmentId: deptId,
            createdAt: atDay(now, -28 + i),
            updatedAt: atDay(now, -i),
          },
        })
        await tx.serviceRequestMessage.create({
          data: {
            id: showcaseId("request-message-client", i),
            conversationId: showcaseId("conversation", i),
            senderId: clientId(i),
            clientMessageId: showcaseUuid("request-message-client", i),
            body: "Could you share the next steps and expected timing for our project?",
            createdAt: atDay(now, -i - 2),
          },
        })
        await tx.serviceRequestMessage.create({
          data: {
            id: showcaseId("request-message-head", i),
            conversationId: showcaseId("conversation", i),
            senderId: headId,
            clientMessageId: showcaseUuid("request-message-head", i),
            body: "We are reviewing the brief and will walk through the timeline with you shortly.",
            createdAt: atDay(now, -i - 1),
          },
        })
      }
      for (let i = 0; i < plannedCounts.requests; i++) {
        const client = clientId(clientFor(i)),
          service = services[(i % plannedCounts.packages) % services.length]
        const projectName = `${service.name} · ${["Strategy", "Launch", "Growth", "Review"][i % 4]}`
        const created = atDay(now, -(i * 4 + 5))
        const project = i < plannedCounts.projects
        await tx.serviceRequest.create({
          data: {
            id: requestId(i),
            referenceNumber: `SC-REQ-${String(i + 1).padStart(4, "0")}`,
            clientId: client,
            serviceId: service.id,
            packageId: showcaseId("package", i % plannedCounts.packages),
            packageName: packageNames[i % plannedCounts.packages],
            pricingModel: "FIXED",
            currency: "PHP",
            conversationId: showcaseId("conversation", clientFor(i)),
            title: `${organizations[clientFor(i)]} · ${projectName}`,
            description: `Planning and delivery for ${service.name.toLowerCase()}.`,
            status: project ? "UNDER_REVIEW" : "SUBMITTED",
            ...(project
              ? {
                  acceptedDepartmentId: deptId,
                  acceptedById: headId,
                  acceptedAt: created,
                }
              : {}),
            createdAt: created,
            ...(project
              ? {
                  workflow: {
                    create: {
                      state: "CONSULTATION",
                      consultationRequired: service.requiresConsultation,
                      agreementRequired: service.requiresAgreement,
                      paymentRequired: service.requiresPayment,
                      quotationApprovalRequired:
                        service.requiresQuotationApproval,
                    },
                  },
                }
              : {}),
          },
        })
        if (project) {
          const serviceName = service.name.toLowerCase()
          const templateKey = serviceName.includes("social")
            ? "social-media-management"
            : serviceName.includes("advertis") || serviceName.includes("ads")
              ? "paid-ads-campaign"
              : serviceName.includes("website") || serviceName.includes("web ")
                ? "website-development"
                : serviceName.includes("seo") ||
                    serviceName.includes("search engine")
                  ? "seo-campaign"
                  : serviceName.includes("design") ||
                      serviceName.includes("brand")
                    ? "graphic-design"
                    : "blank-custom"
          const plan = makeWorkPlan(templateKey)
          if (templateKey === "blank-custom")
            plan.phases.forEach((phase, phaseIndex) => {
              phase.tasks = [
                "Review client requirements",
                "Prepare project materials",
              ].map((title, taskIndex) => ({
                id: showcaseUuid(`fallback-${i}-${phaseIndex}`, taskIndex),
                title,
                role: "Project team",
                status: "NOT_STARTED",
              }))
            })
          plan.phases.forEach((phase, phaseIndex) => {
            phase.id = showcaseUuid(`phase-${i}`, phaseIndex)
            phase.tasks.forEach((task, taskIndex) => {
              task.id = showcaseUuid(`task-${i}-${phaseIndex}`, taskIndex)
              task.status =
                phaseIndex === 0
                  ? "DONE"
                  : phaseIndex === 1
                    ? "IN_PROGRESS"
                    : "NOT_STARTED"
              task.employeeId = employeeId((phaseIndex + taskIndex) % 4)
            })
          })
          await tx.projectWorkspaceGroup.create({
            data: {
              id: showcaseId("workspace", i),
              name: projectName,
              structure: "SEPARATE",
              clientId: client,
              createdById: headId,
              createdAt: created,
            },
          })
          await tx.project.create({
            data: {
              id: projectId(i),
              clientId: client,
              requestId: requestId(i),
              workspaceGroupId: showcaseId("workspace", i),
              name: projectName,
              description:
                "Coordinated planning and delivery for a fictional client engagement.",
              status: "PLANNED",
              templateKey,
              workPlan: plan as Prisma.InputJsonValue,
              createdAt: created,
            },
          })
          for (let j = 0; j < 2; j++)
            await tx.projectStaff.create({
              data: {
                id: showcaseId(`project-staff-${i}`, j),
                projectId: projectId(i),
                employeeId: employeeId(j),
                approvedById: headId,
                isTeamLead: j === 0,
              },
            })
          for (let j = 0; j < 3; j++)
            await tx.projectMilestone.create({
              data: {
                id: showcaseId(`milestone-${i}`, j),
                projectId: projectId(i),
                title: [
                  "Confirm project brief",
                  "Review initial concepts",
                  "Prepare final handover",
                ][j],
                displayOrder: j,
              },
            })
          await tx.workflowConsultation.create({
            data: {
              id: showcaseId("consultation", i),
              requestId: requestId(i),
              startsAt: atDay(now, 3 + i),
              endsAt: new Date(atDay(now, 3 + i).getTime() + 3600000),
              location: "Online meeting",
              notes: "Review the brief and agree next steps.",
            },
          })
          await tx.projectMessage.create({
            data: {
              id: showcaseId("message", i),
              projectId: projectId(i),
              senderId: staffId(0),
              clientMessageId: showcaseUuid("message", i),
              body: "The initial brief is ready for review. We will share the next steps at our consultation.",
              createdAt: atDay(now, -i),
            },
          })
          await tx.projectMessage.create({
            data: {
              id: showcaseId("client-message", i),
              projectId: projectId(i),
              senderId: client,
              clientMessageId: showcaseUuid("client-message", i),
              body: "Thank you. We will review the brief and bring our feedback to the meeting.",
              createdAt: atDay(now, -i),
            },
          })
        }
        const issue = atDay(now, -((i % 6) * 30 + 10)),
          due = new Date(issue.getTime() + 30 * day)
        const total = (25000 + (i % 8) * 5500).toFixed(2)
        const status = i < 3 ? "DRAFT" : i < 6 ? "CANCELLED" : "ISSUED"
        await tx.invoice.create({
          data: {
            id: showcaseId("invoice", i),
            invoiceNumber: `SC-INV-${String(i + 1).padStart(5, "0")}`,
            clientId: client,
            requestId: requestId(i),
            projectId: project ? projectId(i) : null,
            description: `${service.name} services`,
            total,
            currency: "PHP",
            status,
            issueDate: issue,
            dueDate: due,
            createdById: adminId,
            ...(status === "ISSUED"
              ? {
                  issuedAt: issue,
                  issuedSnapshot: {
                    invoiceNumber: `SC-INV-${String(i + 1).padStart(5, "0")}`,
                    clientId: client,
                    clientName: organizations[clientFor(i)],
                    clientEmail: `client${clientFor(i) + 1}@showcase.invalid`,
                    requestId: requestId(i),
                    requestTitle: `${organizations[clientFor(i)]} · ${projectName}`,
                    serviceName: service.name,
                    projectId: project ? projectId(i) : null,
                    projectName: project ? projectName : null,
                    description: `${service.name} services`,
                    total,
                    currency: "PHP",
                    issueDate: issue.toISOString(),
                    dueDate: due.toISOString(),
                    paymentTerms: "Payment due within 30 days.",
                  },
                }
              : {}),
          },
        })
        if (i >= 6 && i < 30)
          await tx.invoicePayment.create({
            data: {
              id: showcaseId("payment", i),
              invoiceId: showcaseId("invoice", i),
              amount: (Number(total) * (i % 3 === 0 ? 1 : 0.5)).toFixed(2),
              paidAt: new Date(issue.getTime() + 10 * day),
              reference: `SC-PAY-${String(i + 1).padStart(5, "0")}`,
              note: "Fictional offline payment for showcase use.",
              createdById: adminId,
              idempotencyKey: showcaseUuid("payment", i),
            },
          })
      }
      for (let i = 0; i < plannedCounts.expenses; i++)
        await tx.expense.create({
          data: {
            id: showcaseId("expense", i),
            description: [
              "Creative production",
              "Software subscription",
              "Campaign placement",
              "Cloud hosting",
              "Project supplies",
              "Research tools",
            ][i % 6],
            category: [
              "Production",
              "Software",
              "Advertising",
              "Hosting",
              "Operations",
              "Research",
            ][i % 6],
            amount: (1200 + i * 315).toFixed(2),
            expenseDate: atDay(now, -(i % 6) * 30 - 3),
            vendor: "Fictional supplier",
            reference: `SC-EXP-${String(i + 1).padStart(4, "0")}`,
            createdById: adminId,
          },
        })
      for (let i = 0; i < plannedCounts.inquiries; i++) {
        await tx.serviceInquiry.create({
          data: {
            id: showcaseId("inquiry", i),
            serviceId: services[i % services.length].id,
            fullName: [
              "Amelia Flores",
              "Lucas Rivera",
              "Sofia Reyes",
              "Gabriela Ramos",
              "Miguel Santos",
              "Elena Cruz",
              "Ramon Lim",
              "Bianca Torres",
              "Daniel Tan",
            ][i],
            email: `inquiry${i + 1}@showcase.invalid`,
            contactNumber: "+639170000000",
            subject: "Exploring digital services",
            message:
              "We are planning a new project and would appreciate a conversation about scope and timing.",
            submissionKey: showcaseUuid("inquiry", i),
            fingerprint: createHash("sha256")
              .update(showcaseId("inquiry", i))
              .digest("hex"),
            status: i % 3 === 0 ? "CONTACTED" : "PENDING",
            ...(i % 3 === 0
              ? { reviewedById: adminId, reviewedAt: atDay(now, -i) }
              : {}),
            createdAt: atDay(now, -i * 3),
          },
        })
      }
      return { created: true, counts: plannedCounts }
    },
    { isolationLevel: "Serializable", timeout: 120000 },
  )
}
