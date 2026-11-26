import type { PrismaClient } from "../../src/generated/prisma/client.js"
import { organizations, plannedCounts, showcaseId } from "./showcase-plan.js"
import { assertShowcaseRealtimeDisabled } from "./showcase-realtime.js"

const ids = (kind: string, count: number) =>
  Array.from({ length: count }, (_, index) => showcaseId(kind, index))
const owned: Record<string, { column: string; ids: string[] }> = {
  User: { column: "id", ids: ids("user", plannedCounts.accounts) },
  Employee: { column: "id", ids: ids("employee", 20) },
  EmployeeCompensation: { column: "id", ids: ids("compensation", 20) },
  ServiceRequest: { column: "id", ids: ids("request", plannedCounts.requests) },
  RequestConversation: {
    column: "id",
    ids: ids("conversation", plannedCounts.conversations),
  },
  InternalConversation: {
    column: "id",
    ids: ids("internal-conversation", plannedCounts.internalConversations),
  },
  InternalMessage: {
    column: "id",
    ids: Array.from({ length: plannedCounts.internalConversations }, (_, i) =>
      ids(`internal-message-${i}`, 2),
    ).flat(),
  },
  InternalConversationParticipant: {
    column: "__pair",
    ids: Array.from({ length: plannedCounts.internalConversations }, (_, i) =>
      [showcaseId("user", i * 2 + 2), showcaseId("user", i * 2 + 3)].map(
        (user) => `${showcaseId("internal-conversation", i)}:${user}`,
      ),
    ).flat(),
  },
  ServiceRequestMessage: {
    column: "id",
    ids: [
      ...ids("request-message-client", plannedCounts.conversations),
      ...ids("request-message-head", plannedCounts.conversations),
    ],
  },
  RequestWorkflow: {
    column: "requestId",
    ids: ids("request", plannedCounts.projects),
  },
  ProjectWorkspaceGroup: {
    column: "id",
    ids: ids("workspace", plannedCounts.projects),
  },
  Project: { column: "id", ids: ids("project", plannedCounts.projects) },
  ProjectStaff: {
    column: "id",
    ids: Array.from({ length: plannedCounts.projects }, (_, i) =>
      ids(`project-staff-${i}`, 2),
    ).flat(),
  },
  ProjectMilestone: {
    column: "id",
    ids: Array.from({ length: plannedCounts.projects }, (_, i) =>
      ids(`milestone-${i}`, 3),
    ).flat(),
  },
  WorkflowConsultation: {
    column: "id",
    ids: ids("consultation", plannedCounts.projects),
  },
  ProjectMessage: {
    column: "id",
    ids: [
      ...ids("message", plannedCounts.projects),
      ...ids("client-message", plannedCounts.projects),
    ],
  },
  Invoice: { column: "id", ids: ids("invoice", plannedCounts.invoices) },
  InvoicePayment: {
    column: "id",
    ids: Array.from({ length: 24 }, (_, index) =>
      showcaseId("payment", index + 6),
    ),
  },
  Expense: { column: "id", ids: ids("expense", plannedCounts.expenses) },
  ServiceInquiry: {
    column: "id",
    ids: ids("inquiry", plannedCounts.inquiries),
  },
  ServicePackage: { column: "id", ids: ids("package", plannedCounts.packages) },
}
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
type ForeignKey = {
  schema: string
  child: string
  parent: string
  childColumns: string[]
  parentColumns: string[]
}

/** Reject deletion if any record outside the exact fixture set references a fixture. */
export async function cleanupShowcase(prisma: PrismaClient) {
  return prisma.$transaction(
    async (tx) => {
      await assertShowcaseRealtimeDisabled(tx)
      const accounts = await tx.user.findMany({
        where: { id: { in: owned.User.ids } },
        select: { id: true, email: true, role: true },
      })
      if (!accounts.length) return { removed: false, clients: 0 }
      if (
        accounts.length !== plannedCounts.accounts ||
        accounts.some((row) => {
          const index = owned.User.ids.indexOf(row.id)
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
          "Showcase account ownership cannot be verified; refusing cleanup",
        )
      const keys = await tx.$queryRaw<ForeignKey[]>`
      SELECT ns.nspname::text AS "schema", child.relname::text AS "child", parent.relname::text AS "parent", array_agg(ca.attname::text ORDER BY k.ord) AS "childColumns", array_agg(pa.attname::text ORDER BY k.ord) AS "parentColumns"
      FROM pg_constraint fk
      JOIN pg_class child ON child.oid = fk.conrelid
      JOIN pg_namespace ns ON ns.oid = child.relnamespace
      JOIN pg_class parent ON parent.oid = fk.confrelid
      JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
      JOIN unnest(fk.conkey, fk.confkey) WITH ORDINALITY AS k(childnum, parentnum, ord) ON true
      JOIN pg_attribute ca ON ca.attrelid = child.oid AND ca.attnum = k.childnum
      JOIN pg_attribute pa ON pa.attrelid = parent.oid AND pa.attnum = k.parentnum
      WHERE fk.contype = 'f' AND parent_ns.nspname = 'public'
      GROUP BY fk.oid, ns.nspname, child.relname, parent.relname`
      for (const key of keys) {
        const parent = owned[key.parent]
        if (!parent) continue
        const child = key.schema === "public" ? owned[key.child] : undefined
        const join = key.childColumns
          .map(
            (column, index) =>
              `c.${quote(column)} = p.${quote(key.parentColumns[index])}`,
          )
          .join(" AND ")
        const ownerExpression =
          child?.column === "__pair"
            ? `(c."conversationId" || ':' || c."userId")`
            : `c.${quote(child?.column || "id")}`
        const external = child
          ? `AND NOT (${ownerExpression} = ANY($2::text[]))`
          : ""
        const query = `SELECT EXISTS (SELECT 1 FROM ${quote(key.schema)}.${quote(key.child)} c JOIN "public".${quote(key.parent)} p ON ${join} WHERE p.${quote(parent.column)} = ANY($1::text[]) ${external}) AS found`
        const result = child
          ? await tx.$queryRawUnsafe<{ found: boolean }[]>(
              query,
              parent.ids,
              child.ids,
            )
          : await tx.$queryRawUnsafe<{ found: boolean }[]>(query, parent.ids)
        if (result[0]?.found)
          throw new Error(
            `Cannot clean showcase data: ${key.child} contains records outside the fixture that reference ${key.parent}`,
          )
      }
      await tx.invoicePayment.deleteMany({
        where: { id: { in: owned.InvoicePayment.ids } },
      })
      await tx.expense.deleteMany({ where: { id: { in: owned.Expense.ids } } })
      await tx.serviceInquiry.deleteMany({
        where: { id: { in: owned.ServiceInquiry.ids } },
      })
      await tx.invoice.deleteMany({ where: { id: { in: owned.Invoice.ids } } })
      await tx.projectMessage.deleteMany({
        where: { id: { in: owned.ProjectMessage.ids } },
      })
      await tx.projectStaff.deleteMany({
        where: { id: { in: owned.ProjectStaff.ids } },
      })
      await tx.projectMilestone.deleteMany({
        where: { id: { in: owned.ProjectMilestone.ids } },
      })
      await tx.project.deleteMany({ where: { id: { in: owned.Project.ids } } })
      await tx.projectWorkspaceGroup.deleteMany({
        where: { id: { in: owned.ProjectWorkspaceGroup.ids } },
      })
      await tx.workflowConsultation.deleteMany({
        where: { id: { in: owned.WorkflowConsultation.ids } },
      })
      await tx.serviceRequestMessage.deleteMany({
        where: { id: { in: owned.ServiceRequestMessage.ids } },
      })
      await tx.internalMessage.deleteMany({
        where: { id: { in: owned.InternalMessage.ids } },
      })
      await tx.internalConversationParticipant.deleteMany({
        where: { conversationId: { in: owned.InternalConversation.ids } },
      })
      await tx.internalConversation.deleteMany({
        where: { id: { in: owned.InternalConversation.ids } },
      })
      await tx.requestWorkflow.deleteMany({
        where: { requestId: { in: owned.RequestWorkflow.ids } },
      })
      await tx.serviceRequest.deleteMany({
        where: { id: { in: owned.ServiceRequest.ids } },
      })
      await tx.requestConversation.deleteMany({
        where: { id: { in: owned.RequestConversation.ids } },
      })
      await tx.servicePackage.deleteMany({
        where: { id: { in: owned.ServicePackage.ids } },
      })
      await tx.employeeCompensation.deleteMany({
        where: { id: { in: owned.EmployeeCompensation.ids } },
      })
      await tx.employee.deleteMany({
        where: { id: { in: owned.Employee.ids } },
      })
      await tx.user.deleteMany({ where: { id: { in: owned.User.ids } } })
      return { removed: true, clients: organizations.length }
    },
    { isolationLevel: "Serializable", timeout: 120000 },
  )
}
