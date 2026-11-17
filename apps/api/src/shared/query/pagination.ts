/**
 * Page-number pagination and search helpers shared by every list endpoint.
 *
 * - `parsePage` is the one strict page parser (plain decimal, 1–100,000).
 * - `paginate` reads a page and its total in one RepeatableRead snapshot so
 *   `total` always agrees with the rows returned.
 * - `insensitive` builds the case-insensitive `OR` block for a search box.
 */
import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"

export const PAGE_SIZE = 10
export const MAX_PAGE = 100_000

/** `?page=`: absent → 1; otherwise a plain decimal integer 1–100,000, else null. */
export function parsePage(value: unknown): number | null {
  if (value === undefined) return 1
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null
  const page = Number(value)
  return Number.isSafeInteger(page) && page >= 1 && page <= MAX_PAGE
    ? page
    : null
}

export type PageWindow = { skip: number; take: number }

export function pageWindow(page: number, pageSize = PAGE_SIZE): PageWindow {
  return { skip: (page - 1) * pageSize, take: pageSize }
}

export type Page<Row> = {
  rows: Row[]
  total: number
  page: number
  pageSize: number
}

/**
 * Reads one page of rows and the matching total in a single RepeatableRead
 * snapshot. Pass `tx` when the caller already holds a RepeatableRead
 * transaction (e.g. it checks ownership first); otherwise both queries run
 * as one batched transaction.
 */
export async function paginate<Row>(
  page: number,
  query: {
    rows: (
      db: Prisma.TransactionClient,
      window: PageWindow,
    ) => Prisma.PrismaPromise<Row[]>
    count: (db: Prisma.TransactionClient) => Prisma.PrismaPromise<number>
  },
  {
    tx,
    pageSize = PAGE_SIZE,
  }: {
    tx?: Prisma.TransactionClient
    pageSize?: number
  } = {},
): Promise<Page<Row>> {
  const window = pageWindow(page, pageSize)
  if (tx) {
    const rows = await query.rows(tx, window)
    const total = await query.count(tx)
    return { rows, total, page, pageSize }
  }
  const prisma = getPrisma()!
  const [rows, total] = await prisma.$transaction(
    [query.rows(prisma, window), query.count(prisma)],
    { isolationLevel: "RepeatableRead" },
  )
  return { rows, total, page, pageSize }
}

export type InsensitiveFilter = { contains: string; mode: "insensitive" }

/** Keys of `Where` that accept a string `contains` filter. */
type TextField<Where> = {
  [Key in keyof Where]-?: InsensitiveFilter extends Where[Key] ? Key : never
}[keyof Where] &
  string

/** A text column of the model, or a relation filter built from the search. */
export type SearchField<Where> =
  TextField<Where> | ((filter: InsensitiveFilter) => Where)

/**
 * `{ OR: [...] }` matching `search` case-insensitively in any of `fields`,
 * or `{}` when the search is empty. Spread it into a `where`.
 */
export function insensitive<Where>(
  search: string,
  fields: readonly SearchField<Where>[],
): { OR?: Where[] } {
  if (!search) return {}
  const filter: InsensitiveFilter = { contains: search, mode: "insensitive" }
  return {
    OR: fields.map((field) =>
      typeof field === "function"
        ? field(filter)
        : ({ [field]: filter } as Where),
    ),
  }
}
