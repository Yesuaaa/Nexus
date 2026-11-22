import {
  payrollReportWorkbook,
  type PayrollSheet,
} from "./payroll-report-workbook.js"
import {
  payrollReportCsv,
  type payrollReportFilters,
  type readPayrollReport,
} from "./payroll-reports.service.js"

export function serializePayrollExport(
  filters: ReturnType<typeof payrollReportFilters>,
  report: Awaited<ReturnType<typeof readPayrollReport>>,
  format: "csv" | "xlsx",
) {
  const { details = [], approvedRows = [] } = report.exportData ?? {}
  const employeeColumns = [
    "Payroll period",
    "Run reference",
    "Approved calculation",
    "Revision",
    "Approval status",
    "Approved at",
    "Employee ID",
    "Employee name",
    "Base compensation",
    "Allowances",
    "Gross pay",
    "Recorded deductions",
    "Total deductions",
    "Net pay",
  ]
  const employeeSheet = (name: string): PayrollSheet => ({
    name,
    columns: employeeColumns,
    rows: details,
    currency: new Set([8, 9, 10, 12, 13]),
    numeric: new Set([3]),
  })
  const sheets: Record<typeof filters.kind, PayrollSheet> = {
    summary: employeeSheet("Employee Payroll Details"),
    compensation: employeeSheet("Compensation & Deductions"),
    disbursements: {
      name: "Disbursements",
      columns: [
        "Payroll period",
        "Run reference",
        "Approved calculation",
        "Employee ID",
        "Expected net pay",
        "Payout reference",
        "Batch reference",
        "Payout status",
        "Confirmation type",
        "Last attempt",
        "Attempt reference",
      ],
      rows: details,
      currency: new Set([4]),
    },
    reconciliation: {
      name: "Reconciliation",
      columns: [
        "Payroll period",
        "Run reference",
        "Approved calculation",
        "Exception reference",
        "Exception",
        "Employee ID / Reference",
        "Detection",
        "Review status",
        "First observed",
        "Last observed",
        "Recurrence",
        "Latest decision reference",
      ],
      rows: details,
    },
  }
  const detail = sheets[filters.kind]
  const scope =
    report.scope.from && report.scope.to
      ? report.scope.from.toISOString().slice(0, 10) +
        "-to-" +
        report.scope.to.toISOString().slice(0, 10)
      : "latest-" + filters.periods + "-periods"
  const filename =
    "converyn-payroll-" + filters.kind + "-" + scope + "." + format
  if (format === "csv") {
    return {
      filename,
      type: "text/csv; charset=utf-8",
      content: payrollReportCsv(detail.columns, detail.rows),
    }
  }
  const summary: PayrollSheet = {
    name: "Summary",
    columns: ["Metric", "Value"],
    rows: report.metrics.map((metric, index) => ({
      id: String(index),
      targetId: "",
      status: "",
      cells: [metric.label, metric.value],
    })),
    numeric: new Set([1]),
  }
  const approved: PayrollSheet = {
    name: "Approved Payroll",
    columns: [
      "Payroll period",
      "Run reference",
      "Approved calculation",
      "Revision",
      "Approval status",
      "Approved at",
      "Employees",
      "Gross pay",
      "Deductions",
      "Net pay",
    ],
    rows: approvedRows,
    currency: new Set([7, 8, 9]),
    numeric: new Set([3, 6]),
  }
  const workbook = payrollReportWorkbook(
    [
      summary,
      ...(approved.rows.length ? [approved] : []),
      ...(detail.rows.length ? [detail] : []),
    ],
    [
      "Category: " + detail.name,
      "Scope: " + scope + " • Latest " + filters.periods + " periods with runs",
      "Cutoff: " +
        (filters.cutoff?.toISOString().slice(0, 10) ?? "None") +
        " • Status: " +
        (filters.status || "All"),
      "Search: " + (filters.search || "None"),
      "Generated (UTC): " + new Date().toISOString(),
    ],
  )
  return {
    filename,
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    content: workbook,
  }
}
