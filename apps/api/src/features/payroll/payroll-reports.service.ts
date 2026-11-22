import { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { fail } from "../../shared/http-error.js"
import { PAGE_SIZE, pageWindow } from "../../shared/query/pagination.js"
import {
  evaluateReconciliation,
  startsReviewCycle,
} from "./payroll-reconciliation.service.js"

export const reportColumns = {
  summary: [
    "Payroll period",
    "Approved runs",
    "Employees",
    "Gross pay",
    "Deductions",
    "Net pay",
  ],
  compensation: [
    "Payroll period",
    "Employees",
    "Base compensation",
    "Allowances",
    "Deductions",
    "Net pay",
  ],
  disbursements: [
    "Payroll period",
    "Employee ID",
    "Expected net pay",
    "Payout status",
    "Confirmation type",
    "Last attempt",
  ],
  reconciliation: [
    "Payroll period",
    "Exception",
    "Employee ID / Reference",
    "Detection",
    "Review status",
    "Last observed",
    "Recurrence",
  ],
} as const

export type ReportKind = keyof typeof reportColumns
const dataLimit = 10_000
const exportLimit = 5_000
const zero = new Prisma.Decimal(0)
const dollars = (amount: Prisma.Decimal | null) => amount?.toFixed(2) ?? ""
const payoutLabels = {
  SUCCEEDED: "Simulated confirmed",
  FAILED: "Failed",
  PENDING: "Pending",
  BLOCKED: "Blocked",
  NO_PAYMENT: "No payment required",
} as const
const detectionLabels = {
  AMOUNT_MISMATCH: "Amount mismatch",
  FAILED_PAYOUT: "Failed payout",
  MISSING_PAYOUT_RECORD: "Missing payout record",
  UNMATCHED_PAYOUT: "Unmatched payout",
} as Record<string, string>

export type ReportRow = {
  id: string
  targetId: string
  status: string
  cells: string[]
}

export function payrollReportFilters(query: Record<string, unknown>) {
  const {
    category = "summary",
    periods = "6",
    through = "",
    search = "",
    status = "",
  } = query
  if (typeof category !== "string" || !Object.hasOwn(reportColumns, category))
    fail(400, "Invalid report category")
  if (periods !== "3" && periods !== "6" && periods !== "12")
    fail(400, "Select 3, 6, or 12 payroll periods")
  if (
    typeof through !== "string" ||
    (through && !/^\d{4}-\d{2}-\d{2}$/.test(through))
  )
    fail(400, "Enter a valid reporting cutoff")
  const cutoff = through ? new Date(through + "T00:00:00Z") : null
  if (
    cutoff &&
    (Number.isNaN(cutoff.getTime()) ||
      cutoff.toISOString().slice(0, 10) !== through)
  )
    fail(400, "Enter a valid reporting cutoff")
  const statuses =
    category === "disbursements"
      ? Object.keys(payoutLabels)
      : category === "reconciliation"
        ? [
            "CURRENT",
            "HISTORICAL",
            "OPEN",
            "UNDER_REVIEW",
            "RESOLVED",
            "DISMISSED",
            "RECURRING",
          ]
        : []
  if (
    typeof status !== "string" ||
    (status && !statuses.includes(status)) ||
    typeof search !== "string" ||
    search.length > 200
  )
    fail(400, "Invalid report filter")
  return {
    kind: category as ReportKind,
    periods: Number(periods),
    cutoff,
    search: search.trim().toLowerCase(),
    status,
  }
}

export async function readPayrollReport(
  filters: ReturnType<typeof payrollReportFilters>,
  page: number,
  exporting = false,
  detailed = exporting,
) {
  return getPrisma()!.$transaction(
    async (tx) => {
      const periods = await tx.payrollPeriod.findMany({
        where: {
          run: { isNot: null },
          ...(filters.cutoff ? { endDate: { lte: filters.cutoff } } : {}),
        },
        take: filters.periods,
        orderBy: [{ startDate: "desc" }, { id: "desc" }],
        select: {
          cutoffLabel: true,
          startDate: true,
          endDate: true,
          run: { select: { id: true, status: true, calculationCount: true } },
        },
      })
      const approved = periods.flatMap(({ run }) =>
        run?.status === "APPROVED"
          ? [{ runId: run.id, revision: run.calculationCount }]
          : [],
      )
      const revisions = approved.length
        ? await tx.payrollRunCalculation.findMany({
            where: {
              OR: approved,
              status: "COMPLETE",
              approvalEvents: { some: { action: "PAYROLL_APPROVED" } },
              items: { some: {} },
            },
            select: {
              id: true,
              runId: true,
              revision: true,
              approvalEvents: {
                where: { action: "PAYROLL_APPROVED" },
                select: { createdAt: true },
                take: 1,
              },
              grossTotal: true,
              deductionsTotal: true,
              netTotal: true,
              disbursement: { select: { id: true } },
            },
          })
        : []
      const ids = revisions.map(({ id }) => id)
      const items = await tx.payrollRunItem.findMany({
        where: { calculationId: { in: ids } },
        select: {
          id: true,
          calculationId: true,
          employeeId: true,
          employeeNumberSnapshot: true,
          ...(detailed
            ? {
                employeeNameSnapshot: true,
                grossAmount: true,
                deductionsAmount: true,
              }
            : {}),
          netAmount: true,
          currency: true,
          status: true,
        },
        orderBy: { id: "asc" },
        take: dataLimit + 1,
      })
      const batchIds = revisions.flatMap(({ disbursement }) =>
        disbursement ? [disbursement.id] : [],
      )
      const payoutWhere =
        filters.kind === "reconciliation"
          ? {
              OR: [
                { batchId: { in: batchIds } },
                { payrollItem: { calculationId: { in: ids } } },
              ],
            }
          : { batchId: { in: batchIds } }
      const payouts = ["disbursements", "reconciliation"].includes(filters.kind)
        ? await tx.payrollDisbursementItem.findMany({
            where: payoutWhere,
            select: {
              id: true,
              batchId: true,
              payrollItemId: true,
              amount: true,
              payrollItem: { select: { calculationId: true } },
              attempt: { select: { id: true, outcome: true, createdAt: true } },
            },
            orderBy: { id: "asc" },
            take: dataLimit + 1,
          })
        : []
      const history =
        filters.kind === "reconciliation"
          ? await tx.payrollReconciliationException.findMany({
              where: { calculationId: { in: ids } },
              select: {
                calculationId: true,
                category: true,
                subjectId: true,
                status: true,
                observed: true,
                lastEvidence: true,
                lastObservedAt: true,
                firstDetectedAt: true,
                ...(detailed
                  ? {
                      decisions: {
                        orderBy: { version: "desc" },
                        take: 1,
                        select: { id: true },
                      },
                    }
                  : {}),
              },
              orderBy: [{ category: "asc" }, { subjectId: "asc" }],
              take: dataLimit + 1,
            })
          : []
      if (
        [items, payouts, history].some((records) => records.length > dataLimit)
      )
        fail(
          422,
          "This reporting scope is too large. Choose fewer periods or an earlier cutoff.",
        )
      const components =
        filters.kind === "compensation" ||
        (detailed && filters.kind === "summary")
          ? await tx.payrollRunItemComponent.groupBy({
              by: ["itemId", "componentType"],
              where: {
                item: { calculationId: { in: ids } },
                status: "CALCULATED",
                componentType: { in: ["BASE_EARNING", "ALLOWANCE"] },
                amount: { not: null },
              },
              _sum: { amount: true },
            })
          : []
      const byRun = new Map(
        revisions.map((revision) => [revision.runId, revision]),
      )
      const byItem = new Map(items.map((item) => [item.id, item]))
      const rows: ReportRow[] = []
      const details: ReportRow[] = []
      const approvedRows: ReportRow[] = []
      const employeeExport =
        detailed &&
        (filters.kind === "summary" || filters.kind === "compensation")
      const deductionLines = employeeExport
        ? await tx.payrollRunItemComponent.findMany({
            where: {
              item: { calculationId: { in: ids } },
              status: "CALCULATED",
              componentType: "DEDUCTION",
              amount: { not: null },
            },
            select: { itemId: true, name: true, amount: true },
            orderBy: [{ name: "asc" }, { id: "asc" }],
            take: dataLimit + 1,
          })
        : []
      if (deductionLines.length > dataLimit)
        fail(
          422,
          "Too many recorded deduction lines. Narrow the reporting scope.",
        )
      const deductionsByItem = new Map<string, string[]>()
      for (const line of deductionLines) {
        const itemLines = deductionsByItem.get(line.itemId) ?? []
        itemLines.push(line.name + ": " + dollars(line.amount))
        deductionsByItem.set(line.itemId, itemLines)
      }
      const componentAmounts = new Map(
        components.map((component) => [
          component.itemId + ":" + component.componentType,
          component._sum.amount,
        ]),
      )
      const trend: {
        id: string
        period: string
        gross: string
        deductions: string
        net: string
      }[] = []
      const employees = new Set<string>()
      let gross = zero,
        deductions = zero,
        net = zero,
        base = zero,
        allowances = zero
      let hasBase = false,
        hasAllowances = false
      const matches = (row: ReportRow) =>
        (!filters.status || row.status.split("|").includes(filters.status)) &&
        row.cells.some((cell) => cell.toLowerCase().includes(filters.search))
      for (const period of periods) {
        const run = period.run && byRun.get(period.run.id)
        if (!run) continue
        const label = period.cutoffLabel
        const obligations = items.filter(
          (item) => item.calculationId === run.id,
        )
        if (filters.kind === "summary" || filters.kind === "compensation") {
          const itemIds = new Set(obligations.map(({ id }) => id))
          const sums = components.filter((component) =>
            itemIds.has(component.itemId),
          )
          const total = (type: "BASE_EARNING" | "ALLOWANCE") => {
            const amounts = sums.filter(
              ({ componentType }) => componentType === type,
            )
            return amounts.length
              ? amounts.reduce(
                  (sum, value) => sum.plus(value._sum.amount ?? zero),
                  zero,
                )
              : null
          }
          const periodBase = total("BASE_EARNING")
          const periodAllowances = total("ALLOWANCE")
          const row = {
            id: run.id,
            targetId: run.runId,
            status: "",
            cells:
              filters.kind === "summary"
                ? [
                    label,
                    "1",
                    String(obligations.length),
                    dollars(run.grossTotal),
                    dollars(run.deductionsTotal),
                    dollars(run.netTotal),
                  ]
                : [
                    label,
                    String(obligations.length),
                    dollars(periodBase),
                    dollars(periodAllowances),
                    dollars(run.deductionsTotal),
                    dollars(run.netTotal),
                  ],
          }
          if (!matches(row)) continue
          rows.push(row)
          if (employeeExport) {
            const approvedAt =
              run.approvalEvents[0]?.createdAt.toISOString() ?? ""
            approvedRows.push({
              ...row,
              cells: [
                label,
                run.runId,
                run.id,
                String(run.revision),
                "Approved",
                approvedAt,
                String(obligations.length),
                dollars(run.grossTotal),
                dollars(run.deductionsTotal),
                dollars(run.netTotal),
              ],
            })
            if (details.length + obligations.length > exportLimit)
              fail(
                422,
                "Export exceeds 5,000 matching employee records. Narrow the filters.",
              )
            for (const item of obligations) {
              details.push({
                id: item.id,
                targetId: run.runId,
                status: "",
                cells: [
                  label,
                  run.runId,
                  run.id,
                  String(run.revision),
                  "Approved",
                  approvedAt,
                  item.employeeNumberSnapshot,
                  item.employeeNameSnapshot,
                  dollars(
                    componentAmounts.get(item.id + ":BASE_EARNING") ?? null,
                  ),
                  dollars(componentAmounts.get(item.id + ":ALLOWANCE") ?? null),
                  dollars(item.grossAmount),
                  (deductionsByItem.get(item.id) ?? []).join("; "),
                  dollars(item.deductionsAmount),
                  dollars(item.netAmount),
                ],
              })
            }
          }
          trend.push({
            id: run.id,
            period: label,
            gross: dollars(run.grossTotal),
            deductions: dollars(run.deductionsTotal),
            net: dollars(run.netTotal),
          })
          for (const item of obligations) employees.add(item.employeeId)
          gross = gross.plus(run.grossTotal)
          deductions = deductions.plus(run.deductionsTotal)
          net = net.plus(run.netTotal)
          hasBase ||= periodBase !== null
          hasAllowances ||= periodAllowances !== null
          base = base.plus(periodBase ?? zero)
          allowances = allowances.plus(periodAllowances ?? zero)
          continue
        }
        if (filters.kind === "disbursements") {
          if (!run.disbursement) continue
          for (const payout of payouts.filter(
            ({ batchId }) => batchId === run.disbursement?.id,
          )) {
            const item = byItem.get(payout.payrollItemId)
            if (item?.calculationId !== run.id) continue
            const status = payout.amount.isZero()
              ? "NO_PAYMENT"
              : (payout.attempt?.outcome ?? "BLOCKED")
            const row = {
              id: payout.id,
              targetId: payout.batchId,
              status,
              cells: [
                label,
                item.employeeNumberSnapshot,
                dollars(item.netAmount),
                payoutLabels[status],
                status === "SUCCEEDED" ? "Simulated" : "None",
                payout.attempt?.createdAt.toISOString() ?? "",
              ],
            }
            if (matches(row)) {
              rows.push(row)
              if (detailed)
                details.push({
                  ...row,
                  cells: [
                    label,
                    run.runId,
                    run.id,
                    item.employeeNumberSnapshot,
                    dollars(item.netAmount),
                    payout.id,
                    payout.batchId,
                    ...row.cells.slice(3),
                    payout.attempt?.id ?? "",
                  ],
                })
            }
          }
          continue
        }
        const evaluation = evaluateReconciliation(
          obligations.map((item) => {
            if (
              !item.netAmount ||
              item.netAmount.isNegative() ||
              item.status !== "CALCULATED" ||
              item.currency.trim() !== "PHP"
            )
              fail(
                409,
                "The approved snapshot contains invalid payable amounts",
              )
            return { id: item.id, amount: item.netAmount }
          }),
          payouts.filter(
            (payout) =>
              payout.batchId === run.disbursement?.id ||
              payout.payrollItem.calculationId === run.id,
          ),
          run.disbursement?.id,
        )
        const observed = history.filter(
          (entry) => entry.calculationId === run.id,
        )
        const key = (entry: { category: string; subjectId: string }) =>
          entry.category + ":" + entry.subjectId
        const stored = new Map(observed.map((entry) => [key(entry), entry]))
        const current = new Set(evaluation.exceptions.map(key))
        const add = (
          entry: { category: string; subjectId: string },
          employeeItem: string,
          active: boolean,
          recurring: boolean,
        ) => {
          const saved = stored.get(key(entry))
          const detection = active ? "CURRENT" : "HISTORICAL"
          const lifecycle = recurring ? "OPEN" : (saved?.status ?? "")
          const row = {
            id: run.id + ":" + key(entry),
            targetId: run.runId,
            status: [detection, lifecycle, recurring ? "RECURRING" : ""].join(
              "|",
            ),
            cells: [
              label,
              detectionLabels[entry.category] ?? entry.category,
              byItem.get(employeeItem)?.employeeNumberSnapshot ??
                entry.subjectId,
              active ? "Current" : "Historical",
              lifecycle ? lifecycle.replaceAll("_", " ") : "Unrecorded",
              saved?.lastObservedAt.toISOString() ?? "",
              recurring ? "Recurring" : "",
            ],
          }
          if (matches(row)) {
            rows.push(row)
            if (detailed)
              details.push({
                ...row,
                cells: [
                  label,
                  run.runId,
                  run.id,
                  entry.subjectId,
                  ...row.cells.slice(1, 5),
                  saved?.firstDetectedAt.toISOString() ?? "",
                  ...row.cells.slice(5),
                  saved?.decisions?.[0]?.id ?? "",
                ],
              })
          }
        }
        for (const entry of evaluation.exceptions) {
          const saved = stored.get(key(entry))
          add(
            entry,
            entry.payrollItemId,
            true,
            Boolean(saved && startsReviewCycle(saved, entry)),
          )
        }
        for (const entry of observed) {
          if (!current.has(key(entry))) {
            const evidence = entry.lastEvidence
            const itemId =
              evidence &&
              typeof evidence === "object" &&
              !Array.isArray(evidence) &&
              typeof evidence.payrollItemId === "string"
                ? evidence.payrollItemId
                : ""
            add(entry, itemId, false, false)
          }
        }
      }
      if (exporting && rows.length > exportLimit)
        fail(422, "CSV export exceeds 5,000 matching rows. Narrow the filters.")
      const count = (status: string) =>
        rows.filter((row) => row.status.split("|").includes(status)).length
      const metrics =
        filters.kind === "summary" || filters.kind === "compensation"
          ? [
              { label: "Approved gross", value: dollars(gross), money: true },
              { label: "Deductions", value: dollars(deductions), money: true },
              { label: "Approved net", value: dollars(net), money: true },
              { label: "Employees represented", value: String(employees.size) },
              ...(filters.kind === "summary"
                ? [{ label: "Approved runs", value: String(rows.length) }]
                : [
                    {
                      label: "Recorded base compensation",
                      value: hasBase ? dollars(base) : "",
                      money: true,
                    },
                    {
                      label: "Recorded allowances",
                      value: hasAllowances ? dollars(allowances) : "",
                      money: true,
                    },
                  ]),
            ]
          : filters.kind === "disbursements"
            ? [
                { label: "Payout records", value: String(rows.length) },
                { label: "Real confirmed", value: "0" },
                ...Object.entries(payoutLabels).map(([status, label]) => ({
                  label,
                  value: String(count(status)),
                })),
              ]
            : [
                {
                  label: "Current discrepancies",
                  value: String(count("CURRENT")),
                },
                {
                  label: "Open reviews",
                  value: String(count("OPEN") + count("UNDER_REVIEW")),
                },
                { label: "Resolved", value: String(count("RESOLVED")) },
                { label: "Dismissed", value: String(count("DISMISSED")) },
                {
                  label: "Recurring discrepancies",
                  value: String(count("RECURRING")),
                },
              ]
      const { skip, take } = pageWindow(page)
      return {
        columns: reportColumns[filters.kind],
        ...(detailed ? { exportData: { details, approvedRows } } : {}),
        rows: exporting ? rows : rows.slice(skip, skip + take),
        total: rows.length,
        page,
        pageSize: PAGE_SIZE,
        metrics,
        trend: trend.reverse(),
        scope: {
          periods: periods.length,
          from: periods.at(-1)?.startDate ?? null,
          to: periods[0]?.endDate ?? null,
        },
      }
    },
    { isolationLevel: "RepeatableRead" },
  )
}

export function payrollReportCsv(
  columns: readonly string[],
  rows: ReportRow[],
) {
  return (
    "\uFEFF" +
    [columns, ...rows.map(({ cells }) => cells)]
      .map((cells) =>
        cells
          .map((cell) => {
            const safe = /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(cell)
              ? "'" + cell
              : cell
            return '"' + safe.replaceAll('"', '""') + '"'
          })
          .join(","),
      )
      .join("\r\n") +
    "\r\n"
  )
}
