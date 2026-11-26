import { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { lockRows } from "../../shared/db/locks.js"
import { fail } from "../../shared/http-error.js"
import { isRecordId } from "../../shared/validation.js"
import { paginate } from "../../shared/query/pagination.js"
import { writeServiceLog } from "../service-operation-logs/log-writer.js"
import { amount, optionalText, paymentDate } from "./billing-writes.js"

function parseExpense(input: Record<string, unknown>) {
  const description = optionalText(input.description, "description", 1000)
  const category = optionalText(input.category, "category", 100)
  if (!description || !category)
    fail(400, "Description and category are required")
  return {
    description,
    category,
    amount: amount(input.amount),
    expenseDate: paymentDate(input.expenseDate, "expense date"),
    vendor: optionalText(input.vendor, "vendor", 300),
    reference: optionalText(input.reference, "reference", 300),
    note: optionalText(input.note, "note", 2000),
  }
}
export async function listExpenses(
  page: number,
  search: string,
  category: string,
  from: string,
  to: string,
) {
  const start = from ? paymentDate(from, "start date") : undefined
  const end = to ? paymentDate(to, "end date") : undefined
  if (start && end && start > end) fail(400, "Invalid date range")
  const where: Prisma.ExpenseWhereInput = {
    ...(category
      ? { category: { equals: category, mode: "insensitive" } }
      : {}),
    ...(start || end ? { expenseDate: { gte: start, lte: end } } : {}),
    ...(search
      ? {
          OR: [
            { description: { contains: search, mode: "insensitive" } },
            { vendor: { contains: search, mode: "insensitive" } },
            { reference: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  }
  const result = await paginate(page, {
    rows: (db, window) =>
      db.expense.findMany({
        where,
        ...window,
        orderBy: [{ expenseDate: "desc" }, { id: "desc" }],
        include: { createdBy: { select: { fullName: true, email: true } } },
      }),
    count: (db) => db.expense.count({ where }),
  })
  return {
    ...result,
    rows: result.rows.map((row) => ({ ...row, amount: row.amount.toFixed(2) })),
  }
}
export async function createExpense(
  actorId: string,
  input: Record<string, unknown>,
) {
  const data = parseExpense(input)
  return getPrisma()!.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: { ...data, createdById: actorId },
    })
    await writeServiceLog(
      tx,
      "EXPENSE_CREATED",
      expense.id,
      undefined,
      actorId,
      undefined,
      {
        targetLabel: expense.description,
        changes: [
          {
            field: "Amount",
            before: null,
            after: `PHP ${expense.amount.toFixed(2)}`,
          },
          { field: "Category", before: null, after: expense.category },
        ],
      },
    )
    return expense
  })
}
export async function editExpense(
  id: string,
  actorId: string,
  input: Record<string, unknown>,
) {
  if (
    !isRecordId(id) ||
    !Number.isSafeInteger(input.version) ||
    (input.version as number) < 0
  )
    fail(400, "Invalid expense reference or version")
  const data = parseExpense(input)
  return getPrisma()!.$transaction(async (tx) => {
    await lockRows(tx, "Expense", id)
    const current = await tx.expense.findUnique({ where: { id } })
    if (!current) fail(404, "Expense not found")
    if (current.version !== input.version)
      fail(409, "Expense changed; refresh and retry")
    const expense = await tx.expense.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    })
    await writeServiceLog(
      tx,
      "EXPENSE_EDITED",
      id,
      undefined,
      actorId,
      undefined,
      {
        targetLabel: expense.description,
        changes: [
          {
            field: "Amount",
            before: `PHP ${current.amount.toFixed(2)}`,
            after: `PHP ${expense.amount.toFixed(2)}`,
          },
          {
            field: "Category",
            before: current.category,
            after: expense.category,
          },
        ],
      },
    )
    return expense
  })
}
export async function deleteExpense(id: string, actorId: string) {
  if (!isRecordId(id)) fail(400, "Invalid expense reference")
  await getPrisma()!.$transaction(async (tx) => {
    await lockRows(tx, "Expense", id)
    const current = await tx.expense.findUnique({ where: { id } })
    if (!current) fail(404, "Expense not found")
    await tx.expense.delete({ where: { id } })
    await writeServiceLog(
      tx,
      "EXPENSE_DELETED",
      id,
      undefined,
      actorId,
      undefined,
      {
        targetLabel: current.description,
        changes: [
          {
            field: "Amount",
            before: `PHP ${current.amount.toFixed(2)}`,
            after: null,
          },
          { field: "Category", before: current.category, after: null },
        ],
      },
    )
  })
}
