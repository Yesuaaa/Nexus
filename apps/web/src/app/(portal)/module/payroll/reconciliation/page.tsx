"use client"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { FormTextarea } from "@/components/ui/form-input"

import { Suspense, useState, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import { Eye } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterSelect, filterBarClass } from "@/components/ui/filter-select"
import { Pill } from "@/components/ui/pill"
import {
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
  ResponsiveDataTableRow,
} from "@/components/ui/responsive-data-table"
import { SearchField } from "@/components/ui/search-field"
import {
  DetailItem,
  DetailList,
  SidePanel,
  SidePanelBody,
  SidePanelButton,
  SidePanelError,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelSection,
} from "@/components/ui/side-panel"
import {
  pageRange,
  TablePaginationFooter,
} from "@/components/ui/table-pagination-footer"
import { useTableSearchQuery } from "@/components/ui/use-table-search-query"
import { apiRequest } from "@/features/auth/api/auth-api"
import { canManagePayroll } from "@/features/auth/model/permissions"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { listPayrollRuns } from "@/features/payroll/api/payroll-runs-api"
import { formatPayrollMoney } from "@/features/payroll/model/money"
import { errorMessage } from "@/lib/error-message"
import { formatDateTime, humanizeEnum } from "@/lib/format"
import { sileo } from "@/lib/toast"
import { useAsyncResource } from "@/lib/use-async-resource"

type Amounts = {
  approved: string
  allocated: string
  simulatedConfirmed: string
  realPaid: string
  pending: string
  failed: string
  unresolved: string
}

type Exception = {
  category: string
  subjectId: string
  payrollItemId: string
  employeeName?: string
  employeeNumber?: string
  payoutId: string | null
  batchId: string | null
  attemptId: string | null
  expected: string | null
  observed: string | null
  difference: string | null
  observation: string
  lifecycle: string | null
  version?: number | null
  recurring?: boolean
  firstDetectedAt: string | null
  lastObservedAt: string | null
}

type Employee = {
  payrollItemId: string
  employeeName: string
  employeeNumber: string
  status: string
  amounts: Amounts
  payoutId: string | null
  attempt: { id: string; outcome: string; createdAt: string } | null
  discrepancies: Exception[]
}

type Page<T> = { rows: T[]; total: number; page: number; pageSize: number }
type Result = {
  period: string
  revision: number
  status: string
  approval: { id: string }
  batch: { id: string; status: string } | null
  amounts: Amounts
  employees: Page<Employee>
  exceptions: Page<Exception>
}

const amountLabels: Record<keyof Amounts, string> = {
  approved: "Approved Net Pay",
  allocated: "Allocated",
  simulatedConfirmed: "Simulated Confirmed",
  realPaid: "Real Confirmed Paid",
  pending: "Pending",
  failed: "Failed",
  unresolved: "Unresolved",
}
const categories = [
  "AMOUNT_MISMATCH",
  "MISSING_PAYOUT_RECORD",
  "FAILED_PAYOUT",
  "UNMATCHED_PAYOUT",
]
const categoryDescription: Record<string, string> = {
  AMOUNT_MISMATCH:
    "The confirmed simulator amount differs from approved net pay.",
  MISSING_PAYOUT_RECORD:
    "The prepared batch has no matching payout record for this obligation.",
  FAILED_PAYOUT: "The simulator recorded a failed payout.",
  UNMATCHED_PAYOUT:
    "The payout could not be linked to an obligation in the expected batch.",
}
const label = (value: string) =>
  value === "SUCCEEDED" ? "Simulated Success" : humanizeEnum(value)
const options = (values: string[], placeholder: string) => [
  { value: "", label: placeholder },
  ...values.map((value) => ({ value, label: label(value) })),
]
const date = (value: string | null) =>
  value ? formatDateTime(value, "Asia/Manila") : "—"

function AmountDetails({ amounts }: { amounts: Amounts }) {
  return (
    <DetailList>
      {(Object.keys(amountLabels) as (keyof Amounts)[]).map((key) => (
        <DetailItem key={key} label={amountLabels[key]}>
          {formatPayrollMoney(amounts[key])}
        </DetailItem>
      ))}
    </DetailList>
  )
}

function Details({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="rowAction"
      size={null}
      aria-label={name}
      onClick={onClick}
    >
      <Eye size={15} aria-hidden="true" />
    </Button>
  )
}

function InvestigationTable({
  title,
  columns,
  grid,
  rows,
  loading,
  empty,
  pagination,
  onPageChange,
}: {
  title: string
  columns: string[]
  grid: string
  rows: { id: string; cells: ReactNode[] }[]
  loading: boolean
  empty: string
  pagination?: Page<unknown>
  onPageChange: (page: number) => void
}) {
  const align = (column: string) =>
    column === "Details"
      ? "text-center"
      : ["Approved Net", "Allocated", "Expected", "Observed"].includes(column)
        ? "text-right tabular-nums"
        : ""
  return (
    <>
      <ResponsiveDataTable
        label={title}
        aria-busy={loading}
        className="overflow-x-auto"
      >
        <ResponsiveDataTableHeader rowClassName={grid}>
          {columns.map((column) => (
            <ResponsiveDataTableColumnHeader
              key={column}
              className={align(column)}
            >
              {column}
            </ResponsiveDataTableColumnHeader>
          ))}
        </ResponsiveDataTableHeader>
        <ResponsiveDataTableBody>
          {loading ? (
            <DataTableSkeletonRows
              label={title}
              rows={3}
              rowClassName={grid}
              cellClassNames={columns.map(align)}
            />
          ) : (
            rows.map((row) => (
              <ResponsiveDataTableRow
                key={row.id}
                variant="directory"
                className={grid}
              >
                {row.cells.map((cell, index) => (
                  <ResponsiveDataTableCell
                    key={columns[index]}
                    className={align(columns[index]!)}
                  >
                    {cell}
                  </ResponsiveDataTableCell>
                ))}
              </ResponsiveDataTableRow>
            ))
          )}
        </ResponsiveDataTableBody>
      </ResponsiveDataTable>
      {!loading && rows.length === 0 && <EmptyState title={empty} size="sm" />}
      {pagination && !loading && pagination.total > pagination.pageSize && (
        <TablePaginationFooter
          {...pageRange(pagination.page, pagination.pageSize, pagination.total)}
          page={pagination.page}
          total={pagination.total}
          totalPages={Math.ceil(pagination.total / pagination.pageSize)}
          label={title + " pages"}
          onPageChange={onPageChange}
        />
      )}
    </>
  )
}

function ExceptionEvidence({ entry }: { entry: Exception }) {
  return (
    <>
      <p className="m-0 text-sm">{categoryDescription[entry.category]}</p>
      <DetailList>
        <DetailItem label="Observation">{label(entry.observation)}</DetailItem>
        {entry.lifecycle && (
          <DetailItem label="Lifecycle">
            <Pill tone="neutral">{label(entry.lifecycle)}</Pill>
          </DetailItem>
        )}
        <DetailItem label="Employee or record">
          {entry.employeeName ?? entry.payrollItemId}
        </DetailItem>
        <DetailItem label="Expected">
          {formatPayrollMoney(entry.expected)}
        </DetailItem>
        <DetailItem label="Observed">
          {formatPayrollMoney(entry.observed)}
        </DetailItem>
        <DetailItem label="Difference">
          {entry.difference?.startsWith("-")
            ? "−" + formatPayrollMoney(entry.difference.slice(1))
            : formatPayrollMoney(entry.difference)}
        </DetailItem>
        <DetailItem label="First detected">
          {date(entry.firstDetectedAt)}
        </DetailItem>
        <DetailItem label="Last observed">
          {date(entry.lastObservedAt)}
        </DetailItem>
        {entry.batchId && (
          <DetailItem label="Batch">{entry.batchId}</DetailItem>
        )}
        {entry.payoutId && (
          <DetailItem label="Payout record">{entry.payoutId}</DetailItem>
        )}
        {entry.attemptId && (
          <DetailItem label="Simulator attempt">{entry.attemptId}</DetailItem>
        )}
      </DetailList>
    </>
  )
}

export default function ReconciliationPage() {
  return (
    <Suspense fallback={<p role="status">Loading reconciliation…</p>}>
      <ReconciliationDashboard />
    </Suspense>
  )
}

const reviewActions: Record<string, readonly string[]> = {
  OPEN: ["START_REVIEW", "RESOLVE", "DISMISS"],
  UNDER_REVIEW: ["RESOLVE", "DISMISS", "ASSESS", "RETURN_TO_QUEUE"],
  RESOLVED: ["REOPEN"],
  DISMISSED: ["REOPEN"],
}
const decisionLabels: Record<string, string> = {
  START_REVIEW: "Start Review",
  RESOLVE: "Resolve",
  DISMISS: "Dismiss",
  ASSESS: "Record Assessment",
  RETURN_TO_QUEUE: "Return to Queue",
  REOPEN: "Reopen",
}
const decisionClassifications: Record<string, string[]> = {
  RESOLVE: ["INVESTIGATION_CONCLUDED", "FURTHER_ACTION_REQUIRED"],
  DISMISS: ["INVALID_OBSERVATION", "EXPECTED_CONDITION"],
}
const correctiveActions = [
  "RETRY_REQUIRED",
  "PROVIDER_INVESTIGATION",
  "MANUAL_VERIFICATION",
  "INCORRECT_PAYOUT_INFORMATION",
  "AMOUNT_REVIEW",
  "NO_ACTION_REQUIRED",
]

type Decision = {
  id: string
  actorId: string
  actorName?: string | null
  batchId?: string | null
  payoutId?: string | null
  attemptId?: string | null
  action: string
  previous: string
  next: string
  reason: string
  classification: string | null
  assessment: string | null
  createdAt: string
}

function ExceptionInvestigation({
  entry,
  path,
  manage,
  onRefresh,
}: {
  entry: Exception
  path: string
  manage: boolean
  onRefresh: () => void
}) {
  const [action, setAction] = useState("")
  const [reason, setReason] = useState("")
  const [selection, setSelection] = useState("")
  const [requestId, setRequestId] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const history = useAsyncResource(
    (signal) =>
      apiRequest<{ decisions: Decision[] }>(
        path +
          "/exceptions/" +
          encodeURIComponent(entry.category) +
          "/" +
          encodeURIComponent(entry.subjectId) +
          "/decisions",
        { signal },
      ),
    [path, entry.category, entry.subjectId],
    { enabled: Boolean(entry.firstDetectedAt) },
  )
  const requiredChoices =
    action === "ASSESS" ? correctiveActions : decisionClassifications[action]
  const allowed = reviewActions[entry.lifecycle ?? ""] ?? []

  async function submit() {
    if (saving || entry.version == null) return
    if (reason.trim().length < 5 || (requiredChoices && !selection)) {
      setError(
        "Enter at least 5 characters and select a classification or assessment when required.",
      )
      return
    }
    setSaving(true)
    setError("")
    try {
      await apiRequest(path + "/decisions", {
        method: "POST",
        body: JSON.stringify({
          category: entry.category,
          subjectId: entry.subjectId,
          version: entry.version,
          requestId,
          action,
          reason,
          ...(action === "ASSESS"
            ? { assessment: selection }
            : requiredChoices
              ? { classification: selection }
              : {}),
        }),
      })
      sileo.success({ title: "Exception decision recorded" })
      onRefresh()
    } catch (cause) {
      const message = errorMessage(cause, "Could not record this decision")
      setError(message)
      sileo.error({ title: message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <SidePanelSection title="Investigation">
      {entry.recurring && (
        <Alert>
          This discrepancy has recurred. Record observations to start a new
          review cycle.
        </Alert>
      )}
      {entry.observation === "CURRENT" && (
        <Alert>
          The evaluator still detects this discrepancy. Review decisions do not
          confirm payment.
        </Alert>
      )}
      {manage && entry.version == null && !entry.recurring && (
        <p className="m-0 text-xs text-muted-foreground">
          Record observations to review the latest evidence.
        </p>
      )}
      {manage && entry.version != null && (
        <div className="flex flex-wrap gap-2">
          {allowed.map((next) => (
            <Button
              type="button"
              key={next}
              variant="outline"
              onClick={() => {
                setAction(next)
                setRequestId(crypto.randomUUID())
                setReason("")
                setSelection("")
                setError("")
              }}
            >
              {decisionLabels[next]}
            </Button>
          ))}
        </div>
      )}
      <SidePanelSection title="Decision history">
        {history.loading ? (
          <p role="status" className="m-0 text-xs">
            Loading decisions…
          </p>
        ) : history.error ? (
          <SidePanelError message={history.error} onRetry={history.retry} />
        ) : history.data?.decisions.length ? (
          <ol className="m-0 grid list-none gap-3 p-0">
            {history.data.decisions.map((decision) => (
              <li key={decision.id}>
                <DetailList>
                  <DetailItem label="Decision">
                    {decisionLabels[decision.action]}
                  </DetailItem>
                  <DetailItem label="Review state">
                    {label(decision.previous)} → {label(decision.next)}
                  </DetailItem>
                  <DetailItem label="Recorded">
                    {date(decision.createdAt)}
                  </DetailItem>
                  <DetailItem label="Administrator">
                    {decision.actorName ?? decision.actorId}
                  </DetailItem>
                  <DetailItem label="Reason">
                    <span className="whitespace-pre-wrap">
                      {decision.reason}
                    </span>
                  </DetailItem>
                  {decision.classification && (
                    <DetailItem label="Classification">
                      {label(decision.classification)}
                    </DetailItem>
                  )}
                  {decision.attemptId && (
                    <DetailItem label="Simulator attempt">
                      {decision.attemptId}
                    </DetailItem>
                  )}
                  {decision.payoutId && (
                    <DetailItem label="Payout record">
                      {decision.payoutId}
                    </DetailItem>
                  )}
                  {decision.batchId && (
                    <DetailItem label="Batch">{decision.batchId}</DetailItem>
                  )}
                  {decision.assessment && (
                    <DetailItem label="Corrective action">
                      {label(decision.assessment)}
                    </DetailItem>
                  )}
                </DetailList>
              </li>
            ))}
          </ol>
        ) : (
          <p className="m-0 text-xs text-muted-foreground">
            No administrative decisions recorded.
          </p>
        )}
      </SidePanelSection>
      {action && (
        <ConfirmationDialog
          title={decisionLabels[action]!}
          description="This records an administrative decision. Approved pay and payout outcomes remain unchanged."
          confirmLabel="Confirm decision"
          pendingLabel="Recording…"
          pending={saving}
          destructive={false}
          error={error}
          onClose={() => setAction("")}
          onConfirm={submit}
        >
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1.5 text-sm">
              Reason
              <FormTextarea
                required
                minLength={5}
                maxLength={500}
                value={reason}
                disabled={saving}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            {requiredChoices && (
              <FilterSelect
                fitOptions
                label={
                  action === "ASSESS" ? "Corrective action" : "Classification"
                }
                value={selection}
                onChange={setSelection}
                disabled={saving}
                options={options(requiredChoices, "Select an option")}
              />
            )}
            {error && (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={onRefresh}
              >
                Reload evidence
              </Button>
            )}
          </div>
        </ConfirmationDialog>
      )}
    </SidePanelSection>
  )
}

function ReconciliationDashboard() {
  const params = useSearchParams()
  const manage = canManagePayroll(usePortalAccount())
  const runId = params.get("run") ?? ""
  const [runPage, setRunPage] = useState(1)
  const [runSearch, setRunSearch] = useState("")
  const { query: runQuery, pending: runPending } =
    useTableSearchQuery(runSearch)
  const [search, setSearch] = useState("")
  const { query, pending } = useTableSearchQuery(search)
  const [payoutStatus, setPayoutStatus] = useState("")
  const [category, setCategory] = useState("")
  const [observation, setObservation] = useState("")
  const [page, setPage] = useState(1)
  const [exceptionPage, setExceptionPage] = useState(1)
  const [selected, setSelected] = useState<
    { employee: Employee } | { exception: Exception } | null
  >(null)
  const [recording, setRecording] = useState(false)
  const runs = useAsyncResource(
    (signal) =>
      listPayrollRuns({
        page: runPage,
        search: runQuery,
        status: "APPROVED",
        signal,
      }),
    [runPage, runQuery],
  )
  const path =
    "/api/payroll/runs/" + encodeURIComponent(runId) + "/reconciliation"
  const resource = useAsyncResource(
    (signal) =>
      apiRequest<Result>(
        path +
          "?" +
          new URLSearchParams({
            page: String(page),
            exceptionPage: String(exceptionPage),
            search: query,
            payoutStatus,
            category,
            observation,
          }),
        { signal },
      ),
    [runId, page, exceptionPage, query, payoutStatus, category, observation],
    { enabled: Boolean(runId) },
  )
  const data =
    runId && !resource.loading && !resource.error ? resource.data : undefined
  const eligible = (runs.data?.rows ?? []).filter(
    (run) => run.status === "APPROVED" && run.latestCalculation,
  )
  const runOptions = eligible.map((run) => ({
    value: run.id,
    label:
      run.period.cutoffLabel + " · Revision " + run.latestCalculation!.revision,
  }))
  if (runId && !runOptions.some(({ value }) => value === runId)) {
    runOptions.unshift({
      value: runId,
      label: data
        ? data.period + " · Revision " + data.revision
        : "Linked payroll run",
    })
  }

  async function record() {
    setRecording(true)
    try {
      await apiRequest(path + "/observations", { method: "POST" })
      sileo.success({ title: "Reconciliation observations recorded" })
      resource.retry()
    } catch (error) {
      sileo.error({
        title: errorMessage(error, "Could not record observations"),
      })
    } finally {
      setRecording(false)
    }
  }

  return (
    <main
      className={`${contentClass} min-w-0 p-[clamp(16px,2.1vw,32px)]`}
      aria-label="Reconciliation"
    >
      <PageHeader
        headingId="reconciliation-heading"
        title="Reconciliation"
        description="Review approved payroll amounts, payout outcomes, and discrepancies."
      />
      <div className="mt-[18px] grid min-w-0 gap-5 max-[767px]:mt-[14px]">
        <div className={filterBarClass}>
          <SearchField
            label="Search approved periods"
            placeholder="Search payroll period…"
            value={runSearch}
            onChange={(event) => {
              setRunSearch(event.target.value)
              setRunPage(1)
            }}
          />
          <FilterSelect
            fitOptions
            label="Approved payroll run"
            value={runId}
            options={[
              { value: "", label: "Select approved run" },
              ...runOptions,
            ]}
            onChange={(value) => {
              setPage(1)
              setExceptionPage(1)
              setSelected(null)
              const url = new URL(window.location.href)
              if (value) url.searchParams.set("run", value)
              else url.searchParams.delete("run")
              window.history.replaceState(null, "", url)
            }}
          />
          {runs.data && runs.data.total > runs.data.pageSize && (
            <TablePaginationFooter
              {...pageRange(runPage, runs.data.pageSize, runs.data.total)}
              page={runPage}
              total={runs.data.total}
              totalPages={Math.ceil(runs.data.total / runs.data.pageSize)}
              label="Approved run options"
              onPageChange={setRunPage}
            />
          )}
        </div>
        {runs.error && (
          <SidePanelError message={runs.error} onRetry={runs.retry} />
        )}
        {!runs.loading && !runPending && !runs.error && !eligible.length && (
          <EmptyState
            title={
              runQuery
                ? "No matching approved runs"
                : "No approved payroll runs"
            }
            size="sm"
          />
        )}
        {resource.error && (
          <SidePanelError message={resource.error} onRetry={resource.retry} />
        )}
        {runId && !resource.error && (
          <>
            <SidePanelSection
              title="Reconciliation Summary"
              action={
                manage &&
                data && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={recording}
                    onClick={record}
                  >
                    {recording ? "Recording…" : "Record observations"}
                  </Button>
                )
              }
            >
              {data && <AmountDetails amounts={data.amounts} />}
              {data && !data.batch && (
                <Alert>No disbursement records yet.</Alert>
              )}
              {data && (
                <p className="m-0 text-xs">
                  Local simulator confirmations account for simulated outcomes
                  only. Real confirmed paid is reported separately.
                </p>
              )}
            </SidePanelSection>
            <SidePanelSection title="Employee Reconciliation">
              <div className={filterBarClass}>
                <SearchField
                  label="Search employees"
                  placeholder="Search employee name or ID…"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setPage(1)
                  }}
                />
                <FilterSelect
                  fitOptions
                  label="Payout status"
                  value={payoutStatus}
                  onChange={(value) => {
                    setPayoutStatus(value)
                    setPage(1)
                  }}
                  options={options(
                    [
                      "NOT_STARTED",
                      "PENDING",
                      "SUCCEEDED",
                      "FAILED",
                      "MATCHED",
                      "EXCEPTION",
                    ],
                    "All payout statuses",
                  )}
                />
              </div>
              <InvestigationTable
                title="Employee reconciliation"
                columns={[
                  "Employee",
                  "Approved Net",
                  "Allocated",
                  "Payout Status",
                  "Discrepancy",
                  "Details",
                ]}
                grid="grid min-w-[700px] grid-cols-[minmax(144px,1.35fr)_minmax(106px,1fr)_minmax(106px,1fr)_minmax(120px,1fr)_minmax(105px,1fr)_56px] items-center gap-2 px-4 py-3 text-xs"
                loading={resource.loading || pending}
                pagination={data?.employees}
                onPageChange={setPage}
                empty={
                  search || payoutStatus
                    ? "No matching employees"
                    : "No employee reconciliation records"
                }
                rows={(data?.employees.rows ?? []).map((employee) => ({
                  id: employee.payrollItemId,
                  cells: [
                    <div key="identity">
                      <strong>{employee.employeeName}</strong>
                      <div className="text-muted-foreground">
                        {employee.employeeNumber}
                      </div>
                    </div>,
                    formatPayrollMoney(employee.amounts.approved),
                    formatPayrollMoney(employee.amounts.allocated),
                    <Pill key="status" tone="neutral">
                      {label(employee.attempt?.outcome ?? employee.status)}
                    </Pill>,
                    employee.discrepancies.length || "—",
                    <Details
                      key="details"
                      name={"View reconciliation for " + employee.employeeName}
                      onClick={() => setSelected({ employee })}
                    />,
                  ],
                }))}
              />
            </SidePanelSection>
            <SidePanelSection title="Exceptions">
              <div className={filterBarClass}>
                <FilterSelect
                  fitOptions
                  label="Exception category"
                  value={category}
                  onChange={(value) => {
                    setCategory(value)
                    setExceptionPage(1)
                  }}
                  options={options(categories, "All categories")}
                />
                <FilterSelect
                  fitOptions
                  label="Observation state"
                  value={observation}
                  onChange={(value) => {
                    setObservation(value)
                    setExceptionPage(1)
                  }}
                  options={options(
                    ["CURRENT", "HISTORICAL"],
                    "Current and historical",
                  )}
                />
              </div>
              <InvestigationTable
                title="Exceptions"
                columns={[
                  "Exception",
                  "Employee / Record",
                  "Expected",
                  "Observed",
                  "Detection / Review",
                  "Last Observed",
                  "Details",
                ]}
                grid="grid min-w-[800px] grid-cols-[minmax(114px,1.2fr)_minmax(110px,1.2fr)_minmax(95px,1fr)_minmax(95px,1fr)_minmax(80px,.8fr)_minmax(110px,1fr)_56px] items-center gap-2 px-4 py-3 text-xs"
                loading={resource.loading}
                pagination={data?.exceptions}
                onPageChange={setExceptionPage}
                empty={
                  category
                    ? "No matching exceptions"
                    : observation === "HISTORICAL"
                      ? "No persisted exception history"
                      : "No reconciliation discrepancies"
                }
                rows={(data?.exceptions.rows ?? []).map((entry) => ({
                  id: entry.category + ":" + entry.subjectId,
                  cells: [
                    label(entry.category),
                    <span key="record" className="break-all">
                      {entry.employeeName ?? entry.subjectId}
                    </span>,
                    formatPayrollMoney(entry.expected),
                    formatPayrollMoney(entry.observed),
                    <div key="state" className="grid justify-items-start gap-1">
                      <Pill
                        tone={
                          entry.observation === "CURRENT"
                            ? "warning"
                            : "neutral"
                        }
                      >
                        {label(entry.observation)}
                      </Pill>
                      <span>
                        {entry.lifecycle
                          ? label(entry.lifecycle)
                          : "Unrecorded"}
                      </span>
                    </div>,
                    date(entry.lastObservedAt),
                    <Details
                      key="details"
                      name={
                        "View " +
                        label(entry.category) +
                        " for " +
                        (entry.employeeName ?? entry.subjectId)
                      }
                      onClick={() => setSelected({ exception: entry })}
                    />,
                  ],
                }))}
              />
            </SidePanelSection>
          </>
        )}
        {selected && data && (
          <SidePanel
            open
            onOpenChange={(open) => {
              if (!open) setSelected(null)
            }}
          >
            <SidePanelHeader
              title={
                "employee" in selected
                  ? "Employee Reconciliation"
                  : "Exception Details"
              }
              description={
                ("employee" in selected
                  ? selected.employee.employeeName
                  : label(selected.exception.category)) +
                " · " +
                data.period
              }
              wrapDescription
            />
            <SidePanelBody>
              <SidePanelSection title="Approved revision">
                <DetailList>
                  <DetailItem label="Payroll period">{data.period}</DetailItem>
                  <DetailItem label="Payroll run">{runId}</DetailItem>
                  <DetailItem label="Revision">{data.revision}</DetailItem>
                  <DetailItem label="Approval event">
                    {data.approval.id}
                  </DetailItem>
                </DetailList>
              </SidePanelSection>
              {"employee" in selected ? (
                <>
                  <SidePanelSection title="Employee overview">
                    <DetailList>
                      <DetailItem label="Employee">
                        {selected.employee.employeeName}
                      </DetailItem>
                      <DetailItem label="Employee identifier">
                        {selected.employee.employeeNumber}
                      </DetailItem>
                      <DetailItem label="Reconciliation status">
                        {label(selected.employee.status)}
                      </DetailItem>
                    </DetailList>
                    <AmountDetails amounts={selected.employee.amounts} />
                  </SidePanelSection>
                  <SidePanelSection title="Payout evidence">
                    <DetailList>
                      <DetailItem label="Batch">{data.batch?.id}</DetailItem>
                      <DetailItem label="Payout record">
                        {selected.employee.payoutId}
                      </DetailItem>
                      {selected.employee.attempt && (
                        <>
                          <DetailItem label="Simulator outcome">
                            {label(selected.employee.attempt.outcome)}
                          </DetailItem>
                          <DetailItem label="Simulator attempt">
                            {selected.employee.attempt.id}
                          </DetailItem>
                          <DetailItem label="Recorded at">
                            {date(selected.employee.attempt.createdAt)}
                          </DetailItem>
                        </>
                      )}
                    </DetailList>
                  </SidePanelSection>
                  <SidePanelSection title="Current discrepancies">
                    {selected.employee.discrepancies.length ? (
                      selected.employee.discrepancies.map((entry) => (
                        <SidePanelSection
                          key={entry.category + entry.subjectId}
                          title={label(entry.category)}
                        >
                          <ExceptionEvidence entry={entry} />
                        </SidePanelSection>
                      ))
                    ) : (
                      <p className="m-0 text-xs">No current discrepancies.</p>
                    )}
                  </SidePanelSection>
                </>
              ) : (
                <SidePanelSection title={label(selected.exception.category)}>
                  <ExceptionEvidence entry={selected.exception} />
                  <ExceptionInvestigation
                    entry={selected.exception}
                    path={path}
                    manage={manage}
                    onRefresh={() => {
                      setSelected(null)
                      resource.retry()
                    }}
                  />
                </SidePanelSection>
              )}
            </SidePanelBody>
            <SidePanelFooter>
              <SidePanelButton
                variant="secondary"
                onClick={() => setSelected(null)}
              >
                Close
              </SidePanelButton>
            </SidePanelFooter>
          </SidePanel>
        )}
      </div>
    </main>
  )
}
