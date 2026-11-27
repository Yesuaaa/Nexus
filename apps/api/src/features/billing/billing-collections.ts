import { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { PAGE_SIZE, pageWindow } from "../../shared/query/pagination.js"
import { isSandboxWorkflowPayment } from "../request-workflow/workflow-payment.js"

type Collection = {
  id: string
  source: string
  amount: Prisma.Decimal
  currency: string
  clientName: string
  invoiceId: string | null
  invoiceNumber: string | null
  paidAt: Date | null
  reference: string | null
  status: string
  verifiedById: string | null
}
export async function listCollections(
  page: number,
  search: string,
  source: string,
) {
  const union = Prisma.sql`
    SELECT wp."id", 'COMMENCEMENT'::text AS "source", wp."amount", wp."currency", COALESCE(u."fullName", u."email") AS "clientName", i."id" AS "invoiceId", i."invoiceNumber", wp."verifiedAt" AS "paidAt", wp."reference", wp."status"::text AS "status", wp."verifiedById"
    FROM "WorkflowPayment" wp JOIN "ServiceRequest" r ON r."id" = wp."requestId" JOIN "User" u ON u."id" = r."clientId" LEFT JOIN "Invoice" i ON i."workflowPaymentId" = wp."id"
    UNION ALL
    SELECT p."id", 'INVOICE'::text AS "source", p."amount", i."currency", COALESCE(u."fullName", u."email") AS "clientName", i."id" AS "invoiceId", i."invoiceNumber", p."paidAt", p."reference", 'RECORDED'::text AS "status", NULL::text AS "verifiedById"
    FROM "InvoicePayment" p JOIN "Invoice" i ON i."id" = p."invoiceId" JOIN "User" u ON u."id" = i."clientId"
  `
  const filter = Prisma.sql`(${source} = '' OR "source" = ${source}) AND (${search} = '' OR strpos(lower(concat_ws(' ', "clientName", "invoiceNumber", "reference")), lower(${search})) > 0)`
  const { skip, take } = pageWindow(page)
  const prisma = getPrisma()!
  const [rows, counts] = await prisma.$transaction(
    [
      prisma.$queryRaw<
        Collection[]
      >`SELECT * FROM (${union}) AS collections WHERE ${filter} ORDER BY "paidAt" DESC NULLS LAST, "id" DESC LIMIT ${take} OFFSET ${skip}`,
      prisma.$queryRaw<
        { count: bigint }[]
      >`SELECT count(*) AS count FROM (${union}) AS collections WHERE ${filter}`,
    ],
    { isolationLevel: "RepeatableRead" },
  )
  return {
    rows: rows.map(({ verifiedById, ...row }) => ({
      ...row,
      amount: row.amount.toFixed(2),
      allocation: row.invoiceId ? "ALLOCATED" : "UNALLOCATED",
      sandbox:
        row.source === "COMMENCEMENT" &&
        isSandboxWorkflowPayment({ ...row, verifiedById }),
    })),
    total: Number(counts[0].count),
    page,
    pageSize: PAGE_SIZE,
  }
}
