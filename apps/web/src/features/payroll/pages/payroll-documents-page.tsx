"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Eye, Pencil, Trash2 } from "lucide-react"
import { PageHeader, PageHeaderButton } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { FiguresRow, Section } from "@/components/ui/overview-panel"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import {
  DataTableErrorRow,
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
  ResponsiveDataTableRow,
} from "@/components/ui/responsive-data-table"
import {
  SidePanel,
  SidePanelBody,
  SidePanelHeader,
  useSidePanel,
} from "@/components/ui/side-panel"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { Form } from "@/components/ui/form"
import { FormTextarea } from "@/components/ui/form-input"
import { FilterSelect, filterBarClass } from "@/components/ui/filter-select"
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal"
import { Pill } from "@/components/ui/pill"
import { SearchField } from "@/components/ui/search-field"
import { TableSearchStatus } from "@/components/ui/table-search-status"
import {
  RowActionLabel,
  RowActionsMenu,
} from "@/components/ui/row-actions-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  TablePaginationFooter,
  pageRange,
} from "@/components/ui/table-pagination-footer"
import {
  apiRequest,
  downloadAuthenticatedFile,
} from "@/features/auth/api/auth-api"
import { canManagePayroll } from "@/features/auth/model/permissions"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { errorMessage } from "@/lib/error-message"
import { formatDateTime, humanizeEnum } from "@/lib/format"
import { sileo } from "@/lib/toast"
import { useAsyncResource } from "@/lib/use-async-resource"
import { listPayrollRuns, type PayrollRun } from "../api/payroll-runs-api"

type Page<T> = { rows: T[]; page: number; pageSize: number; total: number }
type Payslip = {
  id: string
  reference: string
  employeeName: string
  employeeNumber: string
  gross: string
  deductions: string
  net: string
  currency: string
  revision: number
  calculationId: string
  generatedAt: string
  generatedBy: string
  publishedAt: string | null
  publishedBy: string | null
  period: {
    cutoffLabel: string
    startDate: string
    endDate: string
    configuration: { frequency: string }
  }
  lines: { name: string; componentType: string; amount: string }[]
}
type Request = {
  id: string
  type: string
  status: string
  createdAt: string
  updatedAt: string
  withdrawnAt: string | null
  withdrawnBy: string | null
  needsFinancialCorrection: boolean
  employee: { fullName: string; employeeId: string }
  payslip: { id: string; reference: string } | null
  messages: { id: string; isAdmin: boolean; body: string; createdAt: string }[]
  activity?: {
    id: string
    action: string
    actorRoleAtTime: string
    changedFields: string[]
    createdAt: string
    changes: {
      activity?: string
      type?: { before: string; after: string }
      description?: { before: string; after: string }
      payslipId?: { before: string | null; after: string | null }
      requestStatus?: { before: string; after: string }
    }
  }[]
}

const requestTypes = [
  { value: "MISSING_PAYSLIP", label: "Missing payslip" },
  { value: "PAYSLIP_CORRECTION", label: "Payslip correction" },
  { value: "PAYROLL_DISCREPANCY", label: "Payroll discrepancy" },
  { value: "MISSING_SALARY_PAYMENT", label: "Missing salary payment report" },
]
const relatedPayslipTypes = new Set([
  "PAYSLIP_CORRECTION",
  "PAYROLL_DISCREPANCY",
  "MISSING_SALARY_PAYMENT",
])
const requestStatuses = ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"].map(
  (value) => ({ value, label: humanizeEnum(value) }),
)
const timestamp = (value: string) => formatDateTime(value, "Asia/Manila")
const money = (slip: Payslip, amount: string) => slip.currency + " " + amount

const staffPayslipGrid =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,.8fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3"
const staffRequestGrid =
  "grid grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3"
const staffTableRow =
  "min-h-[58px] border-b border-[#eceef1] bg-background px-4 py-3 text-xs text-foreground last:border-b-0 @max-[900px]:grid-cols-2 @max-[900px]:[&>*:last-child]:col-span-2"

function PayrollSidePanel({
  title,
  description,
  onClose,
  busy,
  children,
}: {
  title: string
  description: string
  onClose: () => void
  busy?: boolean
  children: ReactNode
}) {
  const panel = useSidePanel(onClose)
  return (
    <SidePanel open={panel.open} onOpenChange={panel.onOpenChange} busy={busy}>
      <SidePanelHeader title={title} description={description} />
      <SidePanelBody>{children}</SidePanelBody>
    </SidePanel>
  )
}

function PayrollRecordDetail({
  sidePanel,
  title,
  description,
  onClose,
  busy,
  children,
  footer,
}: {
  sidePanel: boolean
  title: string
  description: string
  onClose: () => void
  busy?: boolean
  children: ReactNode
  footer?: ReactNode
}) {
  if (sidePanel)
    return (
      <PayrollSidePanel
        title={title}
        description={description}
        onClose={onClose}
        busy={busy}
      >
        {children}
      </PayrollSidePanel>
    )
  return (
    <Modal
      open
      size="lg"
      busy={busy}
      onClose={onClose}
      className={footer ? "flex flex-col overflow-hidden" : undefined}
    >
      <ModalHeader
        title={title}
        description={description}
        closeDisabled={busy}
      />
      <ModalBody
        className={footer ? "min-h-0 flex-1 overflow-y-auto" : undefined}
      >
        {children}
      </ModalBody>
      {footer}
    </Modal>
  )
}

function RecordTable({
  headings,
  children,
  loading,
  empty,
  responsive,
}: {
  headings: string[]
  children: ReactNode
  loading: boolean
  empty: boolean
  responsive?: {
    label: string
    grid: string
    emptyMessage: string
    error: string
    retry: () => void
  }
}) {
  if (responsive)
    return (
      <ResponsiveDataTable label={responsive.label} aria-busy={loading}>
        <ResponsiveDataTableHeader
          className="@max-[900px]:sr-only"
          rowClassName={responsive.grid}
        >
          {headings.map((heading) => (
            <ResponsiveDataTableColumnHeader key={heading}>
              {heading}
            </ResponsiveDataTableColumnHeader>
          ))}
        </ResponsiveDataTableHeader>
        <ResponsiveDataTableBody>
          {loading ? (
            <DataTableSkeletonRows
              label={responsive.label}
              rowClassName={responsive.grid + " " + staffTableRow}
              cellClassNames={headings.map(() => "")}
              rows={3}
            />
          ) : responsive.error ? (
            <DataTableErrorRow
              message={responsive.error}
              onRetry={responsive.retry}
              colSpan={headings.length}
            />
          ) : empty ? (
            <ResponsiveDataTableRow>
              <ResponsiveDataTableCell
                aria-colspan={headings.length}
                className="grid min-h-[90px] place-content-center p-6 text-center text-xs text-[#65718a]"
              >
                <span role="status">{responsive.emptyMessage}</span>
              </ResponsiveDataTableCell>
            </ResponsiveDataTableRow>
          ) : (
            children
          )}
        </ResponsiveDataTableBody>
      </ResponsiveDataTable>
    )
  return (
    <div className="overflow-x-auto">
      <Table aria-busy={loading}>
        <TableHeader>
          <TableRow>
            {headings.map((heading) => (
              <TableHead key={heading}>{heading}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading || empty ? (
            <TableRow>
              <TableCell colSpan={headings.length} role="status">
                {loading ? "Loading…" : "No records to show."}
              </TableCell>
            </TableRow>
          ) : (
            children
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function PayrollPageSection({
  title,
  staff,
  children,
}: {
  title: string
  staff: boolean
  children: ReactNode
}) {
  if (staff) return <Section title={title}>{children}</Section>

  return (
    <section aria-label={title} className="grid min-w-0 gap-2">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Pages({
  result,
  label,
  onPageChange,
}: {
  result: Page<unknown> | null | undefined
  label: string
  onPageChange: (page: number) => void
}) {
  if (!result) return null
  const { page, pageSize, total } = result
  return (
    <TablePaginationFooter
      {...pageRange(page, pageSize, total)}
      page={page}
      total={total}
      totalPages={Math.ceil(total / pageSize)}
      label={label}
      onPageChange={onPageChange}
    />
  )
}

export function PayrollDocumentsPage({ staff = false }: { staff?: boolean }) {
  const account = usePortalAccount()
  const manage = !staff && canManagePayroll(account)
  const base = staff ? "/api/staff/my-payroll" : "/api/payroll"
  const [slipPage, setSlipPage] = useState(1)
  const [requestPage, setRequestPage] = useState(1)
  const [runPage, setRunPage] = useState(1)
  const [runSearch, setRunSearch] = useState("")
  const [search, setSearch] = useState("")
  const [publication, setPublication] = useState("")
  const [requestStatus, setRequestStatus] = useState("")
  const [requestType, setRequestType] = useState("")
  const [requestSearch, setRequestSearch] = useState("")
  const requestQuery = requestSearch.trim()
  const [settledRequestQuery, setSettledRequestQuery] = useState(requestQuery)
  const requestSearchPending = requestQuery !== settledRequestQuery
  const [refresh, setRefresh] = useState(0)
  const [slip, setSlip] = useState<Payslip | null>(null)
  const [selected, setSelected] = useState<Request | null>(null)
  const [create, setCreate] = useState(false)
  const [editing, setEditing] = useState(false)
  const [withdrawal, setWithdrawal] = useState<Request | null>(null)
  const [withdrawalError, setWithdrawalError] = useState("")
  const [type, setType] = useState("")
  const [related, setRelated] = useState("")
  const [body, setBody] = useState("")
  const [bodyTouched, setBodyTouched] = useState(false)
  const [status, setStatus] = useState("")
  const [correction, setCorrection] = useState<boolean | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [confirm, setConfirm] = useState<{
    action: "generate" | "publish"
    run: PayrollRun
  } | null>(null)
  useEffect(() => {
    if (!requestSearchPending) return
    const timer = window.setTimeout(
      () => setSettledRequestQuery(requestQuery),
      200,
    )
    return () => window.clearTimeout(timer)
  }, [requestQuery, requestSearchPending])
  const overview = useAsyncResource(
    (signal) =>
      apiRequest<{
        linked: boolean
        latestPayslip: Payslip | null
        recentRequests: Request[]
        openConcernCount: number
      }>(base, { signal }),
    [base, refresh],
    { enabled: staff, fallbackError: "Couldn't load My Payroll." },
  )
  const slips = useAsyncResource(
    (signal) =>
      apiRequest<Page<Payslip>>(
        base +
          "/payslips?" +
          new URLSearchParams({
            page: String(slipPage),
            search,
            status: publication,
          }),
        { signal },
      ),
    [base, slipPage, search, publication, refresh],
    { fallbackError: "Couldn't load payslips." },
  )
  const relatedPayslips = useAsyncResource(
    async (signal) => {
      const getPage = (page: number) =>
        apiRequest<Page<Payslip>>(
          base + "/payslips?" + new URLSearchParams({ page: String(page) }),
          { signal },
        )
      const first = await getPage(1)
      const totalPages =
        first.pageSize > 0 ? Math.ceil(first.total / first.pageSize) : 1
      if (totalPages <= 1) return first.rows
      const remaining = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
          getPage(index + 2),
        ),
      )
      return first.rows.concat(...remaining.map((page) => page.rows))
    },
    [base, refresh],
    {
      enabled: staff && create && relatedPayslipTypes.has(type),
      fallbackError: "Couldn't load your published payslips.",
      initialData: [] as Payslip[],
    },
  )
  const requests = useAsyncResource(
    (signal) =>
      apiRequest<Page<Request>>(
        base +
          "/requests?" +
          new URLSearchParams({
            page: String(requestPage),
            status: requestStatus,
            type: requestType,
            search: settledRequestQuery,
          }),
        { signal },
      ),
    [
      base,
      requestPage,
      requestStatus,
      requestType,
      settledRequestQuery,
      refresh,
    ],
    {
      enabled: !requestSearchPending,
      fallbackError: staff
        ? "Couldn't load payroll concerns."
        : "Couldn't load payroll requests.",
    },
  )
  const requestDetail = useAsyncResource(
    (signal) =>
      apiRequest<Request>(
        base + "/requests/" + encodeURIComponent(selected!.id),
        { signal },
      ),
    [base, selected?.id, refresh],
    {
      enabled: Boolean(selected),
      fallbackError: "Couldn't load payroll concern details.",
    },
  )
  const runs = useAsyncResource(
    (signal) =>
      listPayrollRuns({
        page: runPage,
        search: runSearch,
        status: "APPROVED",
        signal,
      }),
    [runPage, runSearch, refresh],
    { enabled: manage, fallbackError: "Couldn't load approved runs." },
  )

  function resetForm() {
    setError("")
    setBody("")
    setBodyTouched(false)
    setType("")
    setRelated("")
    setStatus("")
    setCorrection(undefined)
    setEditing(false)
  }

  async function mutate(path: string, data?: object, method = "POST") {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      const result = await apiRequest<
        Request | { changed: number; total: number }
      >(base + path, {
        method,
        ...(data ? { body: JSON.stringify(data) } : {}),
      })
      if ("messages" in result && selected) setSelected(result)
      if ("changed" in result)
        sileo.success({
          title:
            confirm?.action === "publish"
              ? "Payslips published"
              : "Payslips generated",
          description: result.changed + " updated · " + result.total + " total",
        })
      else
        sileo.success({
          title: editing
            ? "Payroll concern updated"
            : create
              ? staff
                ? "Payroll concern submitted"
                : "Payroll request submitted"
              : staff
                ? "Payroll concern updated"
                : "Payroll request updated",
        })
      setCreate(false)
      setConfirm(null)
      resetForm()
      setRefresh((value) => value + 1)
    } catch (cause) {
      setError(errorMessage(cause, "Couldn't save the payroll change."))
    } finally {
      setBusy(false)
    }
  }

  async function withdrawConcern() {
    if (!withdrawal || busy) return
    setBusy(true)
    setWithdrawalError("")
    try {
      await apiRequest(
        base + "/requests/" + encodeURIComponent(withdrawal.id),
        {
          method: "DELETE",
        },
      )
      sileo.success({ title: "Payroll concern deleted" })
      setWithdrawal(null)
      setRefresh((value) => value + 1)
    } catch (cause) {
      setWithdrawalError(errorMessage(cause, "Couldn't delete the concern."))
    } finally {
      setBusy(false)
    }
  }

  async function download(row: Payslip) {
    try {
      await downloadAuthenticatedFile(
        base + "/payslips/" + encodeURIComponent(row.id) + "/download",
        row.reference + ".pdf",
      )
    } catch {
      sileo.error({ title: "Couldn't download the payslip" })
    }
  }

  const openRequest =
    selected?.status === "OPEN" || selected?.status === "IN_REVIEW"
  const transitions = (
    selected?.status === "OPEN"
      ? ["IN_REVIEW", "CLOSED"]
      : ["RESOLVED", "CLOSED"]
  ).map((value) => ({ value, label: humanizeEnum(value) }))
  const trimmedConcernBody = body.trim()
  const concernTypeValid = requestTypes.some((option) => option.value === type)
  const concernBodyValid =
    trimmedConcernBody.length >= 5 && trimmedConcernBody.length <= 2000
  const concernFormValid = concernTypeValid && concernBodyValid && !busy
  const concernBodyError =
    bodyTouched && !concernBodyValid
      ? trimmedConcernBody.length === 0
        ? "Enter a description."
        : trimmedConcernBody.length < 5
          ? "Enter at least 5 non-whitespace characters."
          : "Enter no more than 2,000 characters."
      : ""

  const RecordRow = staff ? ResponsiveDataTableRow : TableRow
  const RecordCell = staff ? ResponsiveDataTableCell : TableCell
  const emptyPayslips = Boolean(
    staff &&
    slips.data &&
    slips.data.total === 0 &&
    !slips.loading &&
    !slips.error,
  )
  const emptyConcerns = Boolean(
    staff &&
    requests.data &&
    requests.data.total === 0 &&
    !requests.loading &&
    !requestSearchPending &&
    !requests.error,
  )
  const selectedDetails =
    requestDetail.data?.id === selected?.id ? requestDetail.data : selected
  const concernFiltersActive = Boolean(
    requestQuery || requestStatus || requestType,
  )
  const startRequest = () => {
    setSelected(null)
    resetForm()
    setCreate(true)
  }
  const startEdit = (row: Request) => {
    const originalDescription = row.messages.find((entry) => !entry.isAdmin)
    resetForm()
    setSelected(row)
    setType(row.type)
    setRelated(row.payslip?.id ?? "")
    setBody(originalDescription?.body ?? "")
    setCreate(true)
    setEditing(true)
  }
  const bodyContent = (
    <>
      {overview.error && <Alert>{overview.error}</Alert>}
      {staff && overview.data && !overview.data.linked && (
        <Alert>Your Staff account has no linked employee record.</Alert>
      )}
      {manage && (
        <section aria-label="Approved runs" className="grid min-w-0 gap-2">
          <h2 className="font-semibold">Approved runs</h2>
          <SearchField
            label="Search approved runs"
            value={runSearch}
            onChange={(value) => {
              setRunSearch(value.target.value)
              setRunPage(1)
            }}
            placeholder="Search payroll period…"
          />
          {runs.error && <Alert>{runs.error}</Alert>}
          <RecordTable
            headings={["Payroll period", "Approved revision", "Actions"]}
            loading={runs.loading}
            empty={!runs.data?.rows.length}
          >
            {runs.data?.rows.map((run) => (
              <TableRow key={run.id}>
                <TableCell>{run.period.cutoffLabel}</TableCell>
                <TableCell>{run.latestCalculation?.revision}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        resetForm()
                        setConfirm({ action: "generate", run })
                      }}
                    >
                      Generate payslips
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        resetForm()
                        setConfirm({ action: "publish", run })
                      }}
                    >
                      Publish payslips
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </RecordTable>
          <Pages
            result={runs.data}
            label="Approved run pages"
            onPageChange={setRunPage}
          />
        </section>
      )}
      <PayrollPageSection
        title={staff ? "My payslips" : "Payslips"}
        staff={staff}
      >
        <div className="grid min-w-0 gap-2">
          {!staff && (
            <div className="flex flex-wrap gap-2">
              <SearchField
                label="Search payslips"
                value={search}
                onChange={(value) => {
                  setSearch(value.target.value)
                  setSlipPage(1)
                }}
                placeholder="Search employee, period or reference…"
              />
              <FilterSelect
                label="Publication status"
                value={publication}
                onChange={(value) => {
                  setPublication(value)
                  setSlipPage(1)
                }}
                options={[
                  { value: "", label: "All payslips" },
                  { value: "generated", label: "Unpublished" },
                  { value: "published", label: "Published" },
                ]}
              />
            </div>
          )}
          {!staff && slips.error && <Alert>{slips.error}</Alert>}
          {emptyPayslips ? (
            <EmptyState
              title="No payslips available"
              description="Your published payslips will appear here once they're available."
              size="md"
              role="status"
            />
          ) : (
            <RecordTable
              headings={[
                "Payroll period",
                ...(!staff ? ["Employee", "Revision"] : []),
                "Reference",
                "Net pay",
                "Publication",
                "Actions",
              ]}
              responsive={
                staff
                  ? {
                      label: "My payslips",
                      grid: staffPayslipGrid,
                      emptyMessage: "No payslips available.",
                      error: slips.error,
                      retry: slips.retry,
                    }
                  : undefined
              }
              loading={slips.loading}
              empty={!slips.data?.rows.length}
            >
              {slips.data?.rows.map((row) => (
                <RecordRow
                  key={row.id}
                  className={
                    staff ? staffPayslipGrid + " " + staffTableRow : undefined
                  }
                >
                  <RecordCell>
                    {staff && (
                      <span className="mr-1.5 hidden text-[#738096] @max-[900px]:inline">
                        Payroll period
                      </span>
                    )}
                    {row.period.cutoffLabel}
                  </RecordCell>
                  {!staff && (
                    <>
                      <RecordCell>{row.employeeName}</RecordCell>
                      <RecordCell>{row.revision}</RecordCell>
                    </>
                  )}
                  <RecordCell className={staff ? "break-all" : undefined}>
                    {staff && (
                      <span className="mr-1.5 hidden text-[#738096] @max-[900px]:inline">
                        Reference
                      </span>
                    )}
                    {row.reference}
                  </RecordCell>
                  <RecordCell>
                    {staff && (
                      <span className="mr-1.5 hidden text-[#738096] @max-[900px]:inline">
                        Net pay
                      </span>
                    )}
                    {money(row, row.net)}
                  </RecordCell>
                  <RecordCell>
                    {staff && (
                      <span className="mr-1.5 hidden text-[#738096] @max-[900px]:inline">
                        Publication
                      </span>
                    )}
                    {row.publishedAt ? (
                      timestamp(row.publishedAt)
                    ) : (
                      <Pill tone="neutral">Generated</Pill>
                    )}
                  </RecordCell>
                  <RecordCell
                    className={
                      staff ? "flex flex-wrap items-center gap-2" : undefined
                    }
                  >
                    {staff && (
                      <span className="mr-1.5 hidden text-[#738096] @max-[900px]:inline">
                        Actions
                      </span>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSlip(row)}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void download(row)}
                      >
                        Download PDF
                      </Button>
                    </div>
                  </RecordCell>
                </RecordRow>
              ))}
            </RecordTable>
          )}
          <Pages
            result={staff && !slips.data?.total ? null : slips.data}
            label="Payslip pages"
            onPageChange={setSlipPage}
          />
        </div>
      </PayrollPageSection>
      <PayrollPageSection
        title={staff ? "Payroll Concerns" : "Payroll requests"}
        staff={staff}
      >
        <div className="grid min-w-0 gap-2">
          <div className={staff ? filterBarClass : "flex flex-wrap gap-2"}>
            {staff && (
              <SearchField
                label="Search payroll concerns"
                placeholder="Search concerns…"
                value={requestSearch}
                maxLength={100}
                onChange={(event) => {
                  setRequestSearch(event.target.value)
                  setRequestPage(1)
                }}
              />
            )}
            <FilterSelect
              label={staff ? "Concern status" : "Request status"}
              value={requestStatus}
              onChange={(value) => {
                setRequestStatus(value)
                setRequestPage(1)
              }}
              options={[
                { value: "", label: "All statuses" },
                ...requestStatuses,
              ]}
            />
            <FilterSelect
              label={staff ? "Concern type" : "Request type"}
              value={requestType}
              onChange={(value) => {
                setRequestType(value)
                setRequestPage(1)
              }}
              options={[{ value: "", label: "All types" }, ...requestTypes]}
            />
          </div>
          {staff && (
            <TableSearchStatus
              active={
                requestSearchPending ||
                (requests.loading && Boolean(requestQuery))
              }
              label="payroll concerns"
            />
          )}
          {!staff && requests.error && <Alert>{requests.error}</Alert>}
          {emptyConcerns ? (
            <EmptyState
              title={
                concernFiltersActive
                  ? "No concerns match those filters"
                  : "No payroll concerns"
              }
              description={
                concernFiltersActive
                  ? "Try changing your search, concern type, or status."
                  : "You haven't raised any payroll concerns yet."
              }
              size="md"
              role="status"
            />
          ) : (
            <RecordTable
              headings={[
                ...(!staff ? ["Employee"] : []),
                staff ? "Concern type" : "Type",
                "Status",
                staff ? "Date created" : "Created",
                "Actions",
              ]}
              responsive={
                staff
                  ? {
                      label: "Payroll concerns",
                      grid: staffRequestGrid,
                      emptyMessage: concernFiltersActive
                        ? "No concerns match your search or filters."
                        : "No payroll concerns.",
                      error: requests.error,
                      retry: requests.retry,
                    }
                  : undefined
              }
              loading={requests.loading || requestSearchPending}
              empty={!requests.data?.rows.length}
            >
              {requests.data?.rows.map((row) => (
                <RecordRow
                  key={row.id}
                  className={
                    staff ? staffRequestGrid + " " + staffTableRow : undefined
                  }
                >
                  {!staff && <RecordCell>{row.employee.fullName}</RecordCell>}
                  <RecordCell>
                    {staff && (
                      <span className="mr-1.5 hidden text-[#738096] @max-[900px]:inline">
                        Concern type
                      </span>
                    )}
                    {humanizeEnum(row.type)}
                  </RecordCell>
                  <RecordCell>
                    {staff && (
                      <span className="mr-1.5 hidden text-[#738096] @max-[900px]:inline">
                        Status
                      </span>
                    )}
                    <Pill tone="neutral">{humanizeEnum(row.status)}</Pill>
                  </RecordCell>
                  <RecordCell>
                    {staff && (
                      <span className="mr-1.5 hidden text-[#738096] @max-[900px]:inline">
                        Date created
                      </span>
                    )}
                    {timestamp(row.createdAt)}
                  </RecordCell>
                  <RecordCell
                    className={
                      staff ? "flex flex-wrap items-center gap-2" : undefined
                    }
                  >
                    {staff ? (
                      <>
                        <span className="mr-1.5 hidden text-[#738096] @max-[900px]:inline">
                          Actions
                        </span>
                        <RowActionsMenu
                          triggerLabel={`Actions for payroll concern ${row.id}`}
                          menuLabel={`Payroll concern actions for ${row.id}`}
                          items={[
                            {
                              action: "view",
                              label: (
                                <RowActionLabel icon={Eye}>
                                  View concern
                                </RowActionLabel>
                              ),
                            },
                            ...(row.status === "OPEN"
                              ? [
                                  {
                                    action: "edit" as const,
                                    label: (
                                      <RowActionLabel icon={Pencil}>
                                        Edit concern
                                      </RowActionLabel>
                                    ),
                                  },
                                  {
                                    action: "delete" as const,
                                    label: (
                                      <RowActionLabel icon={Trash2}>
                                        Delete concern
                                      </RowActionLabel>
                                    ),
                                    className:
                                      "text-destructive focus:text-destructive",
                                  },
                                ]
                              : []),
                          ]}
                          onAction={(action) => {
                            if (action === "view") {
                              resetForm()
                              setCreate(false)
                              setSelected(row)
                            } else if (action === "edit") {
                              startEdit(row)
                            } else {
                              setWithdrawalError("")
                              setWithdrawal(row)
                            }
                          }}
                        />
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          resetForm()
                          setCreate(false)
                          setSelected(row)
                        }}
                      >
                        View request
                      </Button>
                    )}
                  </RecordCell>
                </RecordRow>
              ))}
            </RecordTable>
          )}
          <Pages
            result={
              staff && (!requests.data?.total || requestSearchPending)
                ? null
                : requests.data
            }
            label={staff ? "Payroll concern pages" : "Payroll request pages"}
            onPageChange={setRequestPage}
          />
        </div>
      </PayrollPageSection>
      {confirm && (
        <ConfirmationDialog
          title={
            confirm.action === "generate"
              ? "Generate payslips?"
              : "Publish payslips?"
          }
          subject={confirm.run.period.cutoffLabel}
          description={
            confirm.action === "generate"
              ? "Create private PDFs from the approved calculation."
              : "Make generated payslips available to their employees."
          }
          confirmLabel={confirm.action === "generate" ? "Generate" : "Publish"}
          pendingLabel="Saving…"
          pending={busy}
          destructive={false}
          error={error}
          onClose={() => setConfirm(null)}
          onConfirm={() =>
            void mutate(
              "/runs/" +
                encodeURIComponent(confirm.run.id) +
                "/" +
                confirm.action +
                "-payslips",
            )
          }
        />
      )}
      {withdrawal && (
        <ConfirmationDialog
          title="Delete concern?"
          subject={humanizeEnum(withdrawal.type)}
          description="Are you sure you want to delete this payroll concern? This action will remove it from your active concerns."
          confirmLabel="Delete concern"
          pendingLabel="Deleting…"
          pending={busy}
          destructive
          error={withdrawalError}
          onClose={() => {
            if (!busy) {
              setWithdrawal(null)
              setWithdrawalError("")
            }
          }}
          onConfirm={() => void withdrawConcern()}
        />
      )}
      {slip && (
        <PayrollRecordDetail
          sidePanel={staff}
          title="Payslip details"
          description={slip.reference}
          onClose={() => setSlip(null)}
        >
          <div
            className={staff ? "grid gap-2 text-sm" : "grid gap-2 p-4 text-sm"}
          >
            <p>
              EXP Digital Solutions · {slip.employeeName} ({slip.employeeNumber}
              )
            </p>
            <p>
              {slip.period.cutoffLabel} ·{" "}
              {humanizeEnum(slip.period.configuration.frequency)} · Revision{" "}
              {slip.revision}
            </p>
            <p>
              Generated {timestamp(slip.generatedAt)}
              {!staff && " by " + slip.generatedBy}
            </p>
            <p>
              {slip.publishedAt
                ? "Published " +
                  timestamp(slip.publishedAt) +
                  (!staff ? " by " + slip.publishedBy : "")
                : "Awaiting publication"}
            </p>
            {slip.lines.map((line, index) => (
              <p key={index}>
                {humanizeEnum(line.componentType)} · {line.name} ·{" "}
                {money(slip, line.amount)}
              </p>
            ))}
            <p>
              Gross {money(slip, slip.gross)} · Deductions{" "}
              {money(slip, slip.deductions)} · Net {money(slip, slip.net)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void download(slip)}>
                Download PDF
              </Button>
              {staff && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    resetForm()
                    setRelated(slip.id)
                    setSlip(null)
                    setCreate(true)
                  }}
                >
                  Raise a concern about this payslip
                </Button>
              )}
            </div>
          </div>
        </PayrollRecordDetail>
      )}
      {(create || selected) && (
        <PayrollRecordDetail
          sidePanel={staff && !create}
          title={
            create
              ? editing
                ? "Edit concern"
                : staff
                  ? "Raise a concern"
                  : "New payroll request"
              : staff
                ? "Concern details"
                : humanizeEnum(selected!.type)
          }
          description={
            staff
              ? create
                ? editing
                  ? "Update the concern type, description, or related payslip."
                  : "Report missing payslips, salary discrepancies, or other payroll-related concerns."
                : "Your concern and Admin responses."
              : "Payroll request and responses."
          }
          footer={
            staff && create ? (
              <ModalFooter className="justify-end max-[560px]:grid max-[560px]:grid-cols-2">
                <Button
                  type="button"
                  size="modal"
                  variant="brandOutline"
                  className="max-[560px]:w-full"
                  disabled={busy}
                  onClick={() => {
                    setCreate(false)
                    setSelected(null)
                    resetForm()
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="payroll-concern-form"
                  size="modal"
                  variant="brand"
                  className="max-[560px]:w-full"
                  disabled={!concernFormValid}
                >
                  {busy
                    ? editing
                      ? "Saving…"
                      : "Submitting…"
                    : editing
                      ? "Save changes"
                      : "Submit concern"}
                </Button>
              </ModalFooter>
            ) : undefined
          }
          busy={busy}
          onClose={() => {
            setCreate(false)
            setSelected(null)
            resetForm()
          }}
        >
          <div
            className={
              staff && !create
                ? "grid gap-3"
                : staff && create
                  ? "grid gap-3"
                  : "grid gap-3 p-4"
            }
          >
            {selectedDetails && !create && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="neutral">
                    {humanizeEnum(selectedDetails.status)}
                  </Pill>
                  {selectedDetails.withdrawnAt && (
                    <Pill tone="warning">Withdrawn</Pill>
                  )}
                </div>
                <p>Concern type · {humanizeEnum(selectedDetails.type)}</p>
                <p>Submitted · {timestamp(selectedDetails.createdAt)}</p>
                {selectedDetails.withdrawnAt && (
                  <p>Withdrawn · {timestamp(selectedDetails.withdrawnAt)}</p>
                )}
                {selectedDetails.needsFinancialCorrection && (
                  <Pill tone="warning">Financial correction needed</Pill>
                )}
                {selectedDetails.payslip && (
                  <p className="break-all">
                    Payslip {selectedDetails.payslip.reference}
                  </p>
                )}
                {requestDetail.error && <Alert>{requestDetail.error}</Alert>}
                {requestDetail.loading && (
                  <p role="status" className="text-xs text-[#65718a]">
                    Loading concern history…
                  </p>
                )}
                {selectedDetails.messages.map((entry) => (
                  <div className="grid gap-1 border-b pb-2" key={entry.id}>
                    <p className="text-xs">
                      {entry.isAdmin ? "Payroll Admin" : "Employee"} ·{" "}
                      {timestamp(entry.createdAt)}
                    </p>
                    <p className="whitespace-pre-wrap break-words">
                      {entry.body}
                    </p>
                  </div>
                ))}
                {selectedDetails.activity?.length ? (
                  <section
                    className="grid gap-2 pt-1"
                    aria-label="Activity history"
                  >
                    <h3 className="text-sm font-semibold">Activity history</h3>
                    {selectedDetails.activity.map((entry) => {
                      const activityName = entry.changes.activity
                      const labels: Record<string, string> = {
                        REQUEST_CREATED: "Concern submitted",
                        REQUEST_EDITED: "Concern edited",
                        REQUEST_WITHDRAWN: "Concern deleted",
                        REQUEST_UPDATED: "Payroll updated the concern",
                        REQUEST_MESSAGE: "Employee added a message",
                      }
                      const summaries = [
                        entry.changes.type &&
                          `Type changed from ${humanizeEnum(entry.changes.type.before)} to ${humanizeEnum(entry.changes.type.after)}`,
                        entry.changes.description && "Description updated",
                        entry.changes.payslipId && "Related payslip updated",
                        entry.changes.requestStatus &&
                          `Status changed from ${humanizeEnum(entry.changes.requestStatus.before)} to ${humanizeEnum(entry.changes.requestStatus.after)}`,
                      ].filter(Boolean)
                      return (
                        <div
                          className="grid gap-1 border-b pb-2 text-xs last:border-b-0"
                          key={entry.id}
                        >
                          <p className="font-medium">
                            {labels[activityName ?? ""] ??
                              humanizeEnum(entry.action)}
                          </p>
                          <p className="text-[#738096]">
                            {humanizeEnum(entry.actorRoleAtTime)} ·{" "}
                            {timestamp(entry.createdAt)}
                          </p>
                          {summaries.map((summary) => (
                            <p key={summary}>{summary}</p>
                          ))}
                        </div>
                      )
                    })}
                  </section>
                ) : null}
              </>
            )}
            {(create || (openRequest && (staff || manage))) && (
              <Form
                id={staff && create ? "payroll-concern-form" : undefined}
                onSubmit={(event) => {
                  event.preventDefault()
                  if (create && staff) {
                    setBodyTouched(true)
                    if (!concernTypeValid) {
                      setError("Select a concern type.")
                      return
                    }
                    if (!concernBodyValid) return
                  }
                  if (create && !type) {
                    setError(
                      staff
                        ? "Select a concern type."
                        : "Select a payroll request type.",
                    )
                    return
                  }
                  if (create && editing)
                    void mutate(
                      "/requests/" + selected!.id,
                      {
                        type,
                        description: trimmedConcernBody,
                        payslipId: related || null,
                      },
                      "PATCH",
                    )
                  else if (create)
                    void mutate("/requests", {
                      type,
                      description: staff ? trimmedConcernBody : body,
                      payslipId: related || undefined,
                    })
                  else if (staff)
                    void mutate("/requests/" + selected!.id + "/messages", {
                      message: body,
                    })
                  else
                    void mutate(
                      "/requests/" + selected!.id,
                      {
                        status: status || undefined,
                        message: body,
                        needsFinancialCorrection: correction,
                      },
                      "PATCH",
                    )
                }}
              >
                <div className="grid gap-3">
                  {create &&
                    (staff ? (
                      <label className="grid gap-2 text-sm">
                        Concern type
                        <FilterSelect
                          label="Concern type"
                          value={type}
                          triggerClassName="h-11 text-sm"
                          onChange={(value) => {
                            setType(value)
                            if (!relatedPayslipTypes.has(value)) setRelated("")
                          }}
                          options={[
                            { value: "", label: "Select a concern type" },
                            ...requestTypes,
                          ]}
                        />
                      </label>
                    ) : (
                      <FilterSelect
                        label="Request type"
                        value={type}
                        onChange={setType}
                        options={[
                          { value: "", label: "Select a request type" },
                          ...requestTypes,
                        ]}
                      />
                    ))}
                  {create && related && !staff && (
                    <p>
                      This {staff ? "concern" : "request"} is linked to the
                      selected payslip.
                    </p>
                  )}
                  {create && staff && relatedPayslipTypes.has(type) && (
                    <div className="grid gap-2 text-sm">
                      <span>Related payslip</span>
                      {relatedPayslips.loading ? (
                        <p role="status" className="text-xs text-[#65718a]">
                          Loading your published payslips…
                        </p>
                      ) : relatedPayslips.error ? (
                        <div className="grid gap-2">
                          <Alert>{relatedPayslips.error}</Alert>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={relatedPayslips.retry}
                            >
                              Retry
                            </Button>
                            {related && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setRelated("")}
                              >
                                Remove linked payslip
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : relatedPayslips.data?.length ? (
                        <FilterSelect
                          label="Related payslip"
                          value={related}
                          triggerClassName="h-11 text-sm"
                          onChange={setRelated}
                          options={[
                            { value: "", label: "No related payslip" },
                            ...relatedPayslips.data.map((payslip) => ({
                              value: payslip.id,
                              label: `${payslip.period.cutoffLabel} — ${payslip.reference}`,
                            })),
                          ]}
                        />
                      ) : (
                        <EmptyState
                          title="No published payslips"
                          description="You can still submit this concern without linking a payslip."
                          size="sm"
                          role="status"
                        />
                      )}
                    </div>
                  )}
                  {create && type === "MISSING_SALARY_PAYMENT" && (
                    <p>
                      Tell Payroll which pay period is missing and what you
                      expected to receive.
                    </p>
                  )}
                  {manage && openRequest && (
                    <FilterSelect
                      label="Update status"
                      value={status}
                      onChange={setStatus}
                      options={[
                        { value: "", label: "Keep current status" },
                        ...transitions,
                      ]}
                    />
                  )}
                  {manage &&
                    selected &&
                    ["PAYSLIP_CORRECTION", "PAYROLL_DISCREPANCY"].includes(
                      selected.type,
                    ) && (
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={
                            correction ?? selected.needsFinancialCorrection
                          }
                          onChange={(event) =>
                            setCorrection(event.target.checked)
                          }
                        />
                        Flag for future financial correction
                      </label>
                    )}
                  <label className="grid gap-2 text-sm">
                    {create
                      ? staff
                        ? "Describe your concern"
                        : "Description"
                      : "Response or resolution notes"}
                    <FormTextarea
                      required
                      aria-invalid={
                        staff && create && Boolean(concernBodyError)
                      }
                      aria-describedby={
                        staff && create && concernBodyError
                          ? "concern-description-error"
                          : undefined
                      }
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                      onBlur={() => {
                        if (staff && create) setBodyTouched(true)
                      }}
                    />
                    {staff && create && concernBodyError && (
                      <span
                        id="concern-description-error"
                        role="alert"
                        className="text-[11px] leading-5 text-[#bc3649]"
                      >
                        {concernBodyError}
                      </span>
                    )}
                  </label>
                  {error && <Alert>{error}</Alert>}
                  {!(staff && create) && (
                    <div>
                      <Button type="submit" disabled={busy}>
                        {busy
                          ? "Saving…"
                          : create
                            ? "Submit request"
                            : "Save response"}
                      </Button>
                    </div>
                  )}
                </div>
              </Form>
            )}
          </div>
        </PayrollRecordDetail>
      )}
    </>
  )

  if (staff)
    return (
      <main
        className={
          contentClass + " grid min-w-0 gap-6 p-[clamp(16px,2.1vw,32px)]"
        }
      >
        <PageHeader
          headingId="my-payroll-heading"
          title="My Payroll"
          description="View your payslips, payroll history, and salary-related concerns."
          actions={
            overview.data?.linked ? (
              <PageHeaderButton onClick={startRequest}>
                Raise a concern
              </PageHeaderButton>
            ) : undefined
          }
        />
        <Section title="Payroll summary">
          <FiguresRow
            items={[
              {
                label: "Latest Net Pay",
                value:
                  overview.data?.linked && overview.data.latestPayslip
                    ? money(
                        overview.data.latestPayslip,
                        overview.data.latestPayslip.net,
                      )
                    : "—",
              },
              {
                label: "Latest Payroll Period",
                value:
                  overview.data?.linked && overview.data.latestPayslip
                    ? overview.data.latestPayslip.period.cutoffLabel
                    : "—",
              },
              {
                label: "Open Concerns",
                value: overview.data?.linked
                  ? String(overview.data.openConcernCount)
                  : "—",
              },
            ]}
            loading={overview.loading}
            label="My payroll overview"
          />
        </Section>
        <div className="grid min-w-0 gap-6">{bodyContent}</div>
      </main>
    )

  return (
    <main
      className={
        contentClass + " grid min-w-0 gap-6 p-[clamp(16px,2.1vw,32px)]"
      }
    >
      <PageHeader
        headingId="payroll-documents-heading"
        title="Payslips & Payroll History"
        description="Manage approved payroll records, employee payslips, and publication history."
        actions={!manage ? <Pill tone="neutral">Read only</Pill> : undefined}
      />
      {bodyContent}
    </main>
  )
}
