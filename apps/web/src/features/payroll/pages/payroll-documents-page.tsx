"use client"

import { useEffect, useState, type ReactNode } from "react"
import {
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Eye,
  ArrowLeft,
  Pencil,
  RefreshCw,
  Trash2,
  WalletCards,
} from "lucide-react"
import { PageHeader, PageHeaderButton } from "@/components/layout/page-header"
import { ManagementViewToggle } from "@/components/layout/management-view-toggle"
import { contentClass } from "@/components/layout/styles"
import { FiguresRow, Section } from "@/components/ui/overview-panel"
import {
  DataTableSkeletonRows,
  TableSkeletonBody,
} from "@/components/ui/data-table-skeleton"
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
  SidePanelButton,
  SidePanelError,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelSection,
  DetailItem,
  DetailList,
  useSidePanel,
} from "@/components/ui/side-panel"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { Form } from "@/components/ui/form"
import { FormTextarea } from "@/components/ui/form-input"
import {
  FilterSelect,
  filterBarClass,
  filterGridClass,
} from "@/components/ui/filter-select"
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal"
import { Pill } from "@/components/ui/pill"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTableSearchQuery } from "@/components/ui/use-table-search-query"
import { MemberRowSkeleton } from "@/components/ui/panel-loading"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
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
  apiStreamRequest,
  downloadAuthenticatedFile,
} from "@/features/auth/api/auth-api"
import { canManagePayroll } from "@/features/auth/model/permissions"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { errorMessage } from "@/lib/error-message"
import { formatDateTime, humanizeEnum } from "@/lib/format"
import { sileo } from "@/lib/toast"
import { useAsyncResource } from "@/lib/use-async-resource"
import { getPayrollPreferences } from "../api/payroll-api"
import { cn } from "@/lib/utils"
import { formatPayrollMoney } from "../model/money"
import { formatPayrollDate } from "../model/period-format"
import {
  getPayrollRun,
  listPayrollRunItems,
  listPayrollRuns,
  type PayrollRun,
  type PayrollRunItem,
} from "../api/payroll-runs-api"

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
const payrollHistoryViews = [
  { value: "payslips", label: "Payslips", icon: WalletCards },
  { value: "runs", label: "Approved Runs", icon: CheckCircle2 },
  { value: "requests", label: "Payroll Requests", icon: ClipboardList },
] as const
type PayslipLifecycleStatus =
  | "NOT_GENERATED"
  | "PARTIALLY_GENERATED"
  | "GENERATED"
  | "PARTIALLY_PUBLISHED"
  | "PUBLISHED"

function payslipStatusLabel(status: PayslipLifecycleStatus) {
  return status === "NOT_GENERATED"
    ? "Not generated"
    : status === "PARTIALLY_GENERATED"
      ? "Partially generated"
      : status === "GENERATED"
        ? "Generated"
        : status === "PARTIALLY_PUBLISHED"
          ? "Partially published"
          : "Published"
}

function payslipStatusTone(status: PayslipLifecycleStatus) {
  return status === "PUBLISHED"
    ? "success"
    : status === "GENERATED"
      ? "info"
      : status === "NOT_GENERATED"
        ? "neutral"
        : "warning"
}
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
  preventClose = false,
  onPreventClose,
  children,
  footer,
}: {
  title: string
  description: string
  onClose: () => void
  busy?: boolean
  preventClose?: boolean
  onPreventClose?: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const panel = useSidePanel(onClose)
  function handleOpenChange(open: boolean) {
    if (!open && preventClose) {
      onPreventClose?.()
      return
    }
    panel.onOpenChange(open)
  }
  return (
    <SidePanel open={panel.open} onOpenChange={handleOpenChange} busy={busy}>
      <SidePanelHeader title={title} description={description} />
      <SidePanelBody>{children}</SidePanelBody>
      {footer}
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
  preventClose,
  onPreventClose,
}: {
  sidePanel: boolean
  title: string
  description: string
  onClose: () => void
  busy?: boolean
  children: ReactNode
  footer?: ReactNode
  preventClose?: boolean
  onPreventClose?: () => void
}) {
  if (sidePanel)
    return (
      <PayrollSidePanel
        title={title}
        description={description}
        onClose={onClose}
        busy={busy}
        preventClose={preventClose}
        onPreventClose={onPreventClose}
        footer={footer}
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
  alignments,
  columnClassNames,
  tableClassName,
  responsive,
}: {
  headings: string[]
  children: ReactNode
  loading: boolean
  empty: boolean
  alignments?: Record<string, "center" | "right">
  columnClassNames?: Record<string, string>
  tableClassName?: string
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
    <Table
      className={cn(
        "[&_tbody_tr]:h-12 [&_tbody_td]:px-4 [&_tbody_td]:py-3",
        tableClassName,
      )}
      aria-busy={loading}
    >
      <TableHeader className="bg-[#e8eef2]">
        <TableRow className="hover:bg-[#e8eef2]">
          {headings.map((heading) => (
            <TableHead
              key={heading}
              className={cn(
                alignments?.[heading] === "right"
                  ? "text-right"
                  : alignments?.[heading] === "center"
                    ? "text-center"
                    : undefined,
                columnClassNames?.[heading],
              )}
            >
              {heading}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      {loading ? (
        <TableSkeletonBody
          label={headings[0] ?? "payroll records"}
          columns={headings.length}
          rows={3}
        />
      ) : (
        <TableBody>
          {empty ? (
            <TableRow>
              <TableCell colSpan={headings.length} className="p-0">
                <EmptyState
                  title="No records to show."
                  size="sm"
                  role="status"
                />
              </TableCell>
            </TableRow>
          ) : (
            children
          )}
        </TableBody>
      )}
    </Table>
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

  return <section aria-label={title}>{children}</section>
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

function usePayslipPreview(payslipId: string, generatedAt: string) {
  const [preview, setPreview] = useState({
    key: "",
    url: "",
    error: "",
  })
  const previewKey = payslipId + ":" + generatedAt
  const previewLoading = Boolean(payslipId && preview.key !== previewKey)
  const previewUrl = preview.key === previewKey ? preview.url : ""
  const previewError = preview.key === previewKey ? preview.error : ""
  useEffect(() => {
    let active = true
    let url = ""
    if (!payslipId) return
    const controller = new AbortController()
    void apiStreamRequest(
      "/api/payroll/payslips/" + encodeURIComponent(payslipId) + "/preview",
      { signal: controller.signal },
    )
      .then((response) => {
        if (!response.headers.get("content-type")?.includes("application/pdf"))
          throw new Error("Invalid payslip document")
        return response.blob()
      })
      .then(async (blob) => {
        if ((await blob.slice(0, 5).text()) !== "%PDF-")
          throw new Error("Invalid payslip document")
        if (!active) return
        url = URL.createObjectURL(blob)
        setPreview({ key: previewKey, url, error: "" })
      })
      .catch(() => {
        if (active)
          setPreview({
            key: previewKey,
            url: "",
            error: "Couldn't load the payslip preview.",
          })
      })
    return () => {
      active = false
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [payslipId, previewKey])
  return { previewLoading, previewUrl, previewError }
}

function PayslipReview({
  item,
  manage,
  busy,
  onBack,
  onChanged,
}: {
  item: PayrollRunItem
  manage: boolean
  busy: boolean
  onBack: () => void
  onChanged: () => void
}) {
  const [regenerating, setRegenerating] = useState(false)
  const { previewLoading, previewUrl, previewError } = usePayslipPreview(
    item.payslip?.id ?? "",
    item.payslip?.generatedAt ?? "",
  )

  async function regenerate() {
    if (!item.payslip || regenerating || busy) return
    setRegenerating(true)
    try {
      await apiRequest(
        "/api/payroll/payslips/" +
          encodeURIComponent(item.payslip.id) +
          "/regenerate",
        { method: "POST" },
      )
      sileo.success({ title: "Payslip regenerated" })
      onChanged()
    } catch (cause) {
      sileo.error({
        title: errorMessage(cause, "Couldn't regenerate the payslip."),
      })
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="grid min-w-0 gap-5">
      <SidePanelSection
        title="Payslip review"
        action={
          <Button type="button" size="sm" variant="outline" onClick={onBack}>
            <ArrowLeft size={14} aria-hidden="true" />
            Back
          </Button>
        }
      >
        <DetailList>
          <DetailItem label="Employee">{item.employeeName}</DetailItem>
          <DetailItem label="Employee ID">{item.employeeNumber}</DetailItem>
          <DetailItem label="Net pay">
            <span className="tabular-nums">
              {formatPayrollMoney(item.netAmount)}
            </span>
          </DetailItem>
          <DetailItem label="Payslip status">
            <Pill tone={payslipStatusTone(item.payslipStatus)}>
              {payslipStatusLabel(item.payslipStatus)}
            </Pill>
          </DetailItem>
          <DetailItem label="Publication status">
            {item.payslip?.publishedAt ? (
              <Pill tone="success">Published</Pill>
            ) : item.payslip ? (
              <Pill tone="info">Generated</Pill>
            ) : (
              <Pill tone="neutral">Not generated</Pill>
            )}
          </DetailItem>
        </DetailList>
      </SidePanelSection>
      <SidePanelSection title="PDF preview">
        {previewLoading ? (
          <div aria-busy="true" className="grid gap-2">
            <span className="sr-only" role="status">
              Loading payslip preview…
            </span>
            <MemberRowSkeleton className="py-3" />
            <MemberRowSkeleton className="py-3" />
          </div>
        ) : previewError ? (
          <Alert>{previewError}</Alert>
        ) : previewUrl ? (
          <iframe
            title={`Payslip preview for ${item.employeeName}`}
            src={previewUrl}
            className="h-[min(58dvh,560px)] min-h-[320px] w-full rounded-lg border-0 bg-[#f4f6f9]"
          />
        ) : (
          <EmptyState
            title="Payslip not generated"
            description="Generate payslips for this approved run before reviewing a PDF."
            size="sm"
            role="status"
          />
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!item.payslip}
            onClick={() =>
              item.payslip &&
              void downloadAuthenticatedFile(
                "/api/payroll/payslips/" +
                  encodeURIComponent(item.payslip.id) +
                  "/download",
                item.payslip.reference + ".pdf",
              )
            }
          >
            <Download size={14} aria-hidden="true" />
            Download PDF
          </Button>
          {manage && item.payslip && !item.payslip.publishedAt && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={regenerating || busy}
              onClick={() => void regenerate()}
            >
              <RefreshCw size={14} aria-hidden="true" />
              {regenerating ? "Regenerating…" : "Regenerate PDF"}
            </Button>
          )}
        </div>
      </SidePanelSection>
    </div>
  )
}

function ApprovedRunDetailsSidebar({
  runId,
  refreshKey,
  manage,
  busy,
  onClose,
  onAction,
  onChanged,
}: {
  runId: string
  refreshKey: number
  manage: boolean
  busy: boolean
  onClose: () => void
  onAction: (action: "generate" | "publish", run: PayrollRun) => void
  onChanged: () => void
}) {
  const panel = useSidePanel(onClose)
  const [tab, setTab] = useState("overview")
  const [employeePage, setEmployeePage] = useState(1)
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("")
  const { query: settledEmployeeSearch, pending: employeeSearchPending } =
    useTableSearchQuery(employeeSearch)
  const run = useAsyncResource(
    (signal) => getPayrollRun(runId, signal),
    [runId, refreshKey],
    { fallbackError: "Couldn't load the approved payroll run." },
  )
  const calculationId = run.data?.latestCalculation?.id ?? ""
  const employees = useAsyncResource(
    (signal) =>
      listPayrollRunItems(runId, {
        page: employeePage,
        search: settledEmployeeSearch,
        calculationId,
        signal,
      }),
    [
      runId,
      refreshKey,
      calculationId,
      employeePage,
      settledEmployeeSearch,
      tab,
    ],
    {
      enabled: Boolean(
        calculationId && tab === "employees" && !employeeSearchPending,
      ),
      fallbackError: "Couldn't load approved employees.",
    },
  )
  const selectedEmployee =
    employees.data?.rows.find((item) => item.id === selectedEmployeeId) ?? null
  const calculation = run.data?.latestCalculation
  const employeeCount =
    calculation?.payslipEmployeeCount ??
    (calculation
      ? calculation.calculatedItemCount +
        calculation.reviewItemCount +
        calculation.blockedItemCount
      : 0)
  const generatedCount = calculation?.payslipGeneratedCount ?? 0
  const publishedCount = calculation?.payslipPublishedCount ?? 0
  const generationStatus = calculation?.payslipStatus ?? "NOT_GENERATED"
  const detailDescription = run.data
    ? `${run.data.period.cutoffLabel} · Revision ${calculation?.revision ?? "—"}`
    : "Approved payroll run"

  return (
    <SidePanel open={panel.open} onOpenChange={panel.onOpenChange} busy={busy}>
      <SidePanelHeader
        title="Payslip Details"
        description={detailDescription}
        meta={<Pill tone="success">Approved</Pill>}
        closeLabel="Close payslip details"
        closeDisabled={busy}
      />
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value)
          setSelectedEmployeeId("")
        }}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <div className="flex-none">
          <TabsList
            aria-label="Approved run detail sections"
            variant="underline"
          >
            <TabsTrigger value="overview" variant="underline">
              Overview
            </TabsTrigger>
            <TabsTrigger value="employees" variant="underline">
              Employees
            </TabsTrigger>
          </TabsList>
        </div>
        <SidePanelBody className="min-w-0 grid-cols-1">
          <TabsContent value="overview" className="mt-0 grid min-w-0 gap-5">
            {run.error ? (
              <SidePanelError message={run.error} onRetry={run.retry} />
            ) : run.loading && !run.data ? (
              <div aria-busy="true" className="grid gap-2">
                <span className="sr-only" role="status">
                  Loading approved payroll run…
                </span>
                <MemberRowSkeleton className="py-3" />
                <MemberRowSkeleton className="py-3" />
                <MemberRowSkeleton className="py-3" />
              </div>
            ) : run.data ? (
              <>
                <SidePanelSection title="Payroll summary">
                  <DetailList>
                    <DetailItem label="Employees">{employeeCount}</DetailItem>
                    <DetailItem label="Gross pay">
                      <span className="tabular-nums">
                        {formatPayrollMoney(calculation?.grossTotal)}
                      </span>
                    </DetailItem>
                    <DetailItem label="Deductions">
                      <span className="tabular-nums">
                        {formatPayrollMoney(calculation?.deductionsTotal)}
                      </span>
                    </DetailItem>
                    <DetailItem
                      label="Net pay"
                      className="font-semibold [&_dd]:text-[13px]"
                    >
                      <span className="font-semibold tabular-nums">
                        {formatPayrollMoney(calculation?.netTotal)}
                      </span>
                    </DetailItem>
                  </DetailList>
                </SidePanelSection>
                <SidePanelSection title="Payslip lifecycle">
                  <DetailList>
                    <DetailItem label="Status">
                      <Pill tone={payslipStatusTone(generationStatus)}>
                        {payslipStatusLabel(generationStatus)}
                      </Pill>
                    </DetailItem>
                    <DetailItem label="Generated">
                      {generatedCount} of {employeeCount}
                    </DetailItem>
                    <DetailItem label="Published">
                      {publishedCount} of {employeeCount}
                    </DetailItem>
                    <DetailItem label="Not generated">
                      {Math.max(employeeCount - generatedCount, 0)}
                    </DetailItem>
                    {calculation?.payslipLastGeneratedAt && (
                      <DetailItem label="Last generated">
                        {timestamp(calculation.payslipLastGeneratedAt)}
                      </DetailItem>
                    )}
                    {calculation?.payslipLastPublishedAt && (
                      <DetailItem label="Last published">
                        {timestamp(calculation.payslipLastPublishedAt)}
                      </DetailItem>
                    )}
                  </DetailList>
                </SidePanelSection>
              </>
            ) : null}
          </TabsContent>
          <TabsContent value="employees" className="mt-0 grid min-w-0 gap-5">
            {selectedEmployee ? (
              <PayslipReview
                item={selectedEmployee}
                manage={manage}
                busy={busy}
                onBack={() => setSelectedEmployeeId("")}
                onChanged={() => {
                  employees.retry()
                  run.retry()
                  onChanged()
                }}
              />
            ) : (
              <SidePanelSection title="Employees" className="min-w-0">
                <div className="grid min-w-0 gap-3">
                  <SearchField
                    label="Search approved employees"
                    value={employeeSearch}
                    onChange={(event) => {
                      setEmployeeSearch(event.target.value)
                      setEmployeePage(1)
                    }}
                    placeholder="Search employee or ID…"
                  />
                  {employees.error ? (
                    <SidePanelError
                      message={employees.error}
                      onRetry={employees.retry}
                    />
                  ) : (
                    <RecordTable
                      headings={[
                        "Employee",
                        "Net Pay",
                        "Payslip Status",
                        "Details",
                      ]}
                      alignments={{ "Net Pay": "right", Details: "center" }}
                      columnClassNames={{
                        Employee: "w-[38%]",
                        "Net Pay": "w-[25%]",
                        "Payslip Status": "w-[24%]",
                        Details: "w-[13%]",
                      }}
                      tableClassName="min-w-0 table-fixed"
                      loading={employees.loading || employeeSearchPending}
                      empty={!employees.data?.rows.length}
                    >
                      {employees.data?.rows.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="min-w-0">
                            <div className="grid min-w-0 gap-0.5">
                              <span
                                className="block min-w-0 truncate font-medium"
                                title={item.employeeName}
                              >
                                {item.employeeName}
                              </span>
                              <span
                                className="block min-w-0 truncate text-[10px] text-[#738096]"
                                title={item.employeeNumber}
                              >
                                {item.employeeNumber}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="min-w-0 whitespace-nowrap text-right tabular-nums">
                            {formatPayrollMoney(item.netAmount)}
                          </TableCell>
                          <TableCell className="min-w-0">
                            <Pill tone={payslipStatusTone(item.payslipStatus)}>
                              {payslipStatusLabel(item.payslipStatus)}
                            </Pill>
                          </TableCell>
                          <TableCell className="min-w-0 text-center">
                            <div className="flex justify-center">
                              <Button
                                type="button"
                                variant="rowAction"
                                size={null}
                                aria-label={`Review payslip for ${item.employeeName}`}
                                onClick={() => setSelectedEmployeeId(item.id)}
                              >
                                <Eye size={14} aria-hidden="true" />
                                <HoverTooltip side="top-end">
                                  Review payslip
                                </HoverTooltip>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </RecordTable>
                  )}
                  <Pages
                    result={
                      employees.loading ||
                      employeeSearchPending ||
                      employees.error
                        ? null
                        : employees.data
                    }
                    label="Approved employee pages"
                    onPageChange={setEmployeePage}
                  />
                </div>
              </SidePanelSection>
            )}
          </TabsContent>
        </SidePanelBody>
      </Tabs>
      <SidePanelFooter className="justify-between max-[560px]:items-stretch">
        <SidePanelButton
          variant="secondary"
          disabled={busy}
          onClick={() => panel.close()}
        >
          Close
        </SidePanelButton>
        {manage && run.data && (
          <div className="flex flex-wrap justify-end gap-2">
            <SidePanelButton
              variant="secondary"
              disabled={
                busy ||
                run.loading ||
                !employeeCount ||
                generatedCount >= employeeCount
              }
              onClick={() => onAction("generate", run.data!)}
            >
              {generatedCount >= employeeCount
                ? "Payslips generated"
                : "Generate payslips"}
            </SidePanelButton>
            <SidePanelButton
              disabled={
                busy ||
                run.loading ||
                !employeeCount ||
                generatedCount < employeeCount ||
                publishedCount >= employeeCount
              }
              onClick={() => onAction("publish", run.data!)}
            >
              {publishedCount >= employeeCount
                ? "Payslips published"
                : "Publish payslips"}
            </SidePanelButton>
          </div>
        )}
      </SidePanelFooter>
    </SidePanel>
  )
}

function IndividualPayslipDetails({
  slip,
  onClose,
  onDownload,
}: {
  slip: Payslip
  onClose: () => void
  onDownload: () => Promise<void>
}) {
  const panel = useSidePanel(onClose)
  const [previewSession, setPreviewSession] = useState({ open: false, id: 0 })
  const openPreview = () =>
    setPreviewSession((session) => ({ open: true, id: session.id + 1 }))
  const [downloading, setDownloading] = useState(false)
  const preview = usePayslipPreview(
    previewSession.open ? slip.id : "",
    slip.generatedAt + ":" + previewSession.id,
  )
  const status = slip.publishedAt ? "PUBLISHED" : "GENERATED"
  const period = `${slip.period.cutoffLabel} · Revision ${slip.revision}`

  return (
    <SidePanel open={panel.open} onOpenChange={panel.onOpenChange}>
      <SidePanelHeader
        title="Payslip Details"
        description={period}
        meta={
          <Pill tone={payslipStatusTone(status)}>
            {payslipStatusLabel(status)}
          </Pill>
        }
      />
      <Tabs
        defaultValue="overview"
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <TabsList aria-label="Payslip detail sections" variant="underline">
          <TabsTrigger value="overview" variant="underline">
            Overview
          </TabsTrigger>
          <TabsTrigger value="document" variant="underline">
            Document
          </TabsTrigger>
        </TabsList>
        <SidePanelBody className="min-w-0 grid-cols-1">
          <TabsContent value="overview" className="mt-0 min-w-0 space-y-5">
            <SidePanelSection title="Employee information">
              <DetailList>
                <DetailItem label="Employee">{slip.employeeName}</DetailItem>
                <DetailItem label="Employee ID">
                  {slip.employeeNumber}
                </DetailItem>
                <DetailItem label="Frequency">
                  {humanizeEnum(slip.period.configuration.frequency)}
                </DetailItem>
                {slip.period.startDate && slip.period.endDate && (
                  <DetailItem label="Payroll dates">
                    {slip.period.startDate.slice(0, 10)} –{" "}
                    {slip.period.endDate.slice(0, 10)}
                  </DetailItem>
                )}
              </DetailList>
            </SidePanelSection>
            <SidePanelSection title="Financial breakdown">
              <DetailList className="tabular-nums [&_dt]:min-w-0 [&_dt]:shrink [&_dt]:[overflow-wrap:anywhere] [&_dd]:shrink-0">
                {slip.lines.map((line, index) => (
                  <DetailItem
                    key={index}
                    label={`${humanizeEnum(line.componentType)} · ${line.name}`}
                  >
                    {formatPayrollMoney(line.amount)}
                  </DetailItem>
                ))}
                <DetailItem label="Gross pay">
                  <strong>{formatPayrollMoney(slip.gross)}</strong>
                </DetailItem>
                <DetailItem label="Total deductions">
                  {formatPayrollMoney(slip.deductions)}
                </DetailItem>
                <DetailItem label="Net pay">
                  <strong className="text-sm">
                    {formatPayrollMoney(slip.net)}
                  </strong>
                </DetailItem>
              </DetailList>
            </SidePanelSection>
            <SidePanelSection title="Document history">
              <DetailList>
                <DetailItem label="Generated at">
                  {timestamp(slip.generatedAt)}
                </DetailItem>
                <DetailItem label="Published at">
                  {slip.publishedAt
                    ? timestamp(slip.publishedAt)
                    : "Awaiting publication"}
                </DetailItem>
                <DetailItem label="Reference">{slip.reference}</DetailItem>
              </DetailList>
            </SidePanelSection>
          </TabsContent>
          <TabsContent value="document" className="mt-0 min-w-0">
            <SidePanelSection
              title="Payslip document"
              action={
                <Button variant="outline" size="sm" onClick={openPreview}>
                  Preview PDF
                </Button>
              }
            >
              <DetailList layout="stacked">
                <DetailItem label="Document">
                  <FileText
                    size={14}
                    className="mr-1 inline"
                    aria-hidden="true"
                  />
                  {slip.employeeName} · Payslip PDF
                </DetailItem>
                <DetailItem label="Payroll period">{period}</DetailItem>
                <DetailItem label="Format">A4 PDF</DetailItem>
                <DetailItem label="Reference">{slip.reference}</DetailItem>
              </DetailList>
              {slip.publishedAt && (
                <p className="m-0 text-xs text-muted-foreground">
                  Published payslips retain their original PDF.
                </p>
              )}
            </SidePanelSection>
          </TabsContent>
        </SidePanelBody>
      </Tabs>
      <SidePanelFooter className="flex-wrap justify-between">
        <SidePanelButton variant="secondary" onClick={() => panel.close()}>
          Close
        </SidePanelButton>
        <div className="flex flex-wrap gap-2">
          <SidePanelButton variant="secondary" onClick={openPreview}>
            Preview PDF
          </SidePanelButton>
          <SidePanelButton
            disabled={downloading}
            onClick={async () => {
              setDownloading(true)
              try {
                await onDownload()
              } finally {
                setDownloading(false)
              }
            }}
          >
            {downloading ? "Downloading…" : "Download PDF"}
          </SidePanelButton>
        </div>
      </SidePanelFooter>
      {previewSession.open && (
        <Modal
          elevated
          size="xl"
          onClose={() =>
            setPreviewSession((session) => ({ ...session, open: false }))
          }
          className="flex max-h-[94dvh] flex-col"
        >
          <ModalHeader title="Payslip PDF preview" description={period} />
          <ModalBody className="min-h-0 overflow-y-auto">
            {preview.previewLoading ? (
              <div aria-busy="true">
                <span role="status">Loading payslip preview…</span>
                <MemberRowSkeleton />
              </div>
            ) : preview.previewError ? (
              <Alert role="alert">{preview.previewError}</Alert>
            ) : preview.previewUrl ? (
              <iframe
                title={`Payslip preview for ${slip.employeeName}`}
                src={preview.previewUrl}
                className="block h-[72dvh] w-full border-0"
              />
            ) : (
              <EmptyState title="Payslip PDF unavailable" size="sm" />
            )}
          </ModalBody>
        </Modal>
      )}
    </SidePanel>
  )
}

export function PayrollDocumentsPage({ staff = false }: { staff?: boolean }) {
  const account = usePortalAccount()
  const manage = !staff && canManagePayroll(account)
  const preferences = useAsyncResource(getPayrollPreferences, [], {
    enabled: manage,
  })
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
  const { query: settledRequestQuery, pending: requestSearchPending } =
    useTableSearchQuery(requestSearch)
  const { query: payslipQuery, pending: payslipSearchPending } =
    useTableSearchQuery(search)
  const { query: runQuery, pending: runSearchPending } =
    useTableSearchQuery(runSearch)
  const requestQuery = requestSearch.trim()
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
  const [discardResponseConfirm, setDiscardResponseConfirm] = useState(false)
  const [confirm, setConfirm] = useState<{
    action: "generate" | "publish"
    run: PayrollRun
  } | null>(null)
  const [activeTab, setActiveTab] = useState("payslips")
  const [selectedRunId, setSelectedRunId] = useState("")
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
            search: payslipQuery,
            status: publication,
          }),
        { signal },
      ),
    [base, slipPage, payslipQuery, publication, refresh, activeTab],
    {
      enabled: !payslipSearchPending && (staff || activeTab === "payslips"),
      fallbackError: "Couldn't load payslips.",
    },
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
      activeTab,
      refresh,
    ],
    {
      enabled: !requestSearchPending && (staff || activeTab === "requests"),
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
        search: runQuery,
        status: "APPROVED",
        signal,
      }),
    [runPage, runQuery, refresh, activeTab],
    {
      enabled: manage && activeTab === "runs" && !runSearchPending,
      fallbackError: "Couldn't load approved runs.",
    },
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
          title: path.endsWith("/publish-payslips")
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
      const message = errorMessage(cause, "Couldn't save the payroll change.")
      setError(message)
      if (!confirm && path.endsWith("/publish-payslips"))
        sileo.error({ title: message })
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
  const hasUnsavedResponseChanges = Boolean(
    manage &&
    !create &&
    selected &&
    (status ||
      body.length > 0 ||
      (correction !== undefined &&
        correction !== selected.needsFinancialCorrection)),
  )
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

  function closeSelectedRequest() {
    if (hasUnsavedResponseChanges) {
      setDiscardResponseConfirm(true)
      return
    }
    setCreate(false)
    setSelected(null)
    resetForm()
  }

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
  const selectedRequestDescription = selectedDetails?.messages.find(
    (entry) => !entry.isAdmin,
  )
  const requestConversation = selectedDetails?.messages.filter(
    (entry) => entry.id !== selectedRequestDescription?.id,
  )
  const concernFiltersActive = Boolean(
    requestQuery || requestStatus || requestType,
  )
  const payrollHistorySwitcher = !staff ? (
    <ManagementViewToggle
      className="ml-auto max-[560px]:ml-0 max-[560px]:w-full"
      active={activeTab}
      ariaLabel="Payroll history sections"
      views={payrollHistoryViews}
      onChange={(tab) => {
        setActiveTab(tab)
        setRefresh((value) => value + 1)
      }}
    />
  ) : null
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
  const approvedRunsContent = (
    <section aria-label="Approved runs" className="min-w-0">
      <div className={`${filterBarClass} pb-4`}>
        <SearchField
          label="Search approved runs"
          value={runSearch}
          onChange={(value) => {
            setRunSearch(value.target.value)
            setRunPage(1)
          }}
          placeholder="Search payroll period…"
        />
        {payrollHistorySwitcher}
      </div>
      {runs.error && <Alert className="mb-3">{runs.error}</Alert>}
      <RecordTable
        headings={[
          "Payroll Period",
          "Revision",
          "Employees",
          "Net Pay",
          "Payslip Status",
          "Details",
        ]}
        alignments={{
          Revision: "center",
          Employees: "center",
          "Net Pay": "center",
          Details: "center",
        }}
        columnClassNames={{
          "Payroll Period": "w-[24%]",
          Revision: "w-[12%]",
          Employees: "w-[13%]",
          "Net Pay": "w-[21%]",
          "Payslip Status": "w-[20%]",
          Details: "w-[10%]",
        }}
        tableClassName="min-w-[720px] table-fixed [&_th]:px-3 [&_tbody_td]:px-3"
        loading={runs.loading || runSearchPending}
        empty={!runs.error && !runs.data?.rows.length}
      >
        {runs.data?.rows.map((run) => {
          const approvedCalculation = run.calculationHistory.find(
            (calculation) =>
              calculation.approvalEvents?.some(
                (event) => event.action === "PAYROLL_APPROVED",
              ),
          )
          const netPay = formatPayrollMoney(approvedCalculation?.netTotal)
          return (
            <TableRow key={run.id}>
              <TableCell className="min-w-0 align-middle [overflow-wrap:anywhere]">
                <span className="block font-medium">
                  {run.period.cutoffLabel}
                </span>
                <span className="mt-1 block text-[10px] leading-4 text-[#738096]">
                  {formatPayrollDate(run.period.startDate)} –{" "}
                  {formatPayrollDate(run.period.endDate)}
                </span>
              </TableCell>
              <TableCell className="min-w-0 text-center tabular-nums align-middle">
                {approvedCalculation?.revision ?? "Unavailable"}
              </TableCell>
              <TableCell className="min-w-0 text-center tabular-nums align-middle">
                {run.latestCalculation?.payslipEmployeeCount ??
                  (run.latestCalculation
                    ? run.latestCalculation.calculatedItemCount +
                      run.latestCalculation.reviewItemCount +
                      run.latestCalculation.blockedItemCount
                    : 0)}
              </TableCell>
              <TableCell className="min-w-0 whitespace-nowrap text-center tabular-nums align-middle">
                {netPay === "—" ? "Unavailable" : netPay}
              </TableCell>
              <TableCell className="min-w-0 align-middle">
                {(() => {
                  const status =
                    run.latestCalculation?.payslipStatus ?? "NOT_GENERATED"
                  return (
                    <Pill tone={payslipStatusTone(status)}>
                      {payslipStatusLabel(status)}
                    </Pill>
                  )
                })()}
              </TableCell>
              <TableCell className="min-w-0 text-center align-middle">
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="rowAction"
                    size={null}
                    aria-label={`View approved run details for ${run.period.cutoffLabel}`}
                    onClick={() => {
                      setSelectedRunId(run.id)
                      setConfirm(null)
                    }}
                  >
                    <Eye size={14} aria-hidden="true" />
                    <HoverTooltip side="top-end">
                      View approved run details
                    </HoverTooltip>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </RecordTable>
      <Pages
        result={
          runs.loading || runSearchPending || runs.error ? null : runs.data
        }
        label="Approved run pages"
        onPageChange={setRunPage}
      />
    </section>
  )
  const payslipsContent = (
    <PayrollPageSection
      title={staff ? "My payslips" : "Payslips"}
      staff={staff}
    >
      <div className={staff ? "grid min-w-0 gap-2" : "min-w-0"}>
        {!staff && (
          <div className={`${filterBarClass} pb-4`}>
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
              fitOptions
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
            {payrollHistorySwitcher}
          </div>
        )}
        {!staff && slips.error && <Alert className="mb-3">{slips.error}</Alert>}
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
              staff ? "Actions" : "Details",
            ]}
            alignments={{
              Revision: "right",
              "Net pay": "right",
              Actions: "center",
              Details: "center",
            }}
            columnClassNames={
              staff
                ? undefined
                : {
                    "Payroll period": "w-[15%]",
                    Employee: "w-[21%]",
                    Revision: "w-[9%]",
                    Reference: "w-[18%]",
                    "Net pay": "w-[13%]",
                    Publication: "w-[16%]",
                    Details: "w-[8%]",
                  }
            }
            tableClassName={staff ? undefined : "table-fixed min-w-[680px]"}
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
            loading={slips.loading || payslipSearchPending}
            empty={!slips.error && !slips.data?.rows.length}
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
                    <RecordCell>
                      <span
                        className="block truncate font-medium"
                        title={row.employeeName}
                      >
                        {row.employeeName}
                      </span>
                      <span
                        className="block truncate text-muted-foreground"
                        title={row.employeeNumber}
                      >
                        {row.employeeNumber}
                      </span>
                    </RecordCell>
                    <RecordCell className="text-right tabular-nums">
                      {row.revision}
                    </RecordCell>
                  </>
                )}
                <RecordCell className={staff ? "break-all" : undefined}>
                  {staff && (
                    <span className="mr-1.5 hidden text-[#738096] @max-[900px]:inline">
                      Reference
                    </span>
                  )}
                  {staff ? (
                    row.reference
                  ) : (
                    <span className="block truncate" title={row.reference}>
                      {row.reference}
                    </span>
                  )}
                </RecordCell>
                <RecordCell
                  className={staff ? undefined : "text-right tabular-nums"}
                >
                  {staff && (
                    <span className="mr-1.5 hidden text-[#738096] @max-[900px]:inline">
                      Net pay
                    </span>
                  )}
                  {staff ? money(row, row.net) : formatPayrollMoney(row.net)}
                </RecordCell>
                <RecordCell>
                  {staff && (
                    <span className="mr-1.5 hidden text-[#738096] @max-[900px]:inline">
                      Publication
                    </span>
                  )}
                  {!staff ? (
                    <div className="grid justify-items-start gap-1">
                      <Pill tone={row.publishedAt ? "success" : "info"}>
                        {row.publishedAt ? "Published" : "Generated"}
                      </Pill>
                      {row.publishedAt && (
                        <span className="text-muted-foreground">
                          {timestamp(row.publishedAt)}
                        </span>
                      )}
                    </div>
                  ) : row.publishedAt ? (
                    timestamp(row.publishedAt)
                  ) : (
                    <Pill tone="neutral">Generated</Pill>
                  )}
                </RecordCell>
                <RecordCell
                  className={
                    staff ? "flex flex-wrap items-center gap-2" : "text-center"
                  }
                >
                  {staff && (
                    <span className="mr-1.5 hidden text-[#738096] @max-[900px]:inline">
                      Actions
                    </span>
                  )}
                  {staff ? (
                    <div className="flex flex-wrap justify-center gap-2">
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
                  ) : (
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        variant="rowAction"
                        size={null}
                        aria-label={`View payslip for ${row.employeeName}, ${row.period.cutoffLabel}, revision ${row.revision}`}
                        onClick={() => setSlip(row)}
                      >
                        <Eye size={14} aria-hidden="true" />
                        <HoverTooltip side="top-end">
                          View payslip details
                        </HoverTooltip>
                      </Button>
                    </div>
                  )}
                </RecordCell>
              </RecordRow>
            ))}
          </RecordTable>
        )}
        <Pages
          result={
            slips.loading ||
            payslipSearchPending ||
            slips.error ||
            (staff && !slips.data?.total)
              ? null
              : slips.data
          }
          label="Payslip pages"
          onPageChange={setSlipPage}
        />
      </div>
    </PayrollPageSection>
  )
  const requestsContent = (
    <PayrollPageSection
      title={staff ? "Payroll Concerns" : "Payroll requests"}
      staff={staff}
    >
      <div className={staff ? "grid min-w-0 gap-2" : "min-w-0"}>
        <div className={staff ? filterBarClass : `${filterGridClass} pb-4`}>
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
            fitOptions
            label={staff ? "Concern status" : "Request status"}
            value={requestStatus}
            onChange={(value) => {
              setRequestStatus(value)
              setRequestPage(1)
            }}
            options={[{ value: "", label: "All statuses" }, ...requestStatuses]}
          />
          <FilterSelect
            fitOptions
            label={staff ? "Concern type" : "Request type"}
            value={requestType}
            onChange={(value) => {
              setRequestType(value)
              setRequestPage(1)
            }}
            options={[{ value: "", label: "All types" }, ...requestTypes]}
          />
          {payrollHistorySwitcher}
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
        {!staff && requests.error && (
          <Alert className="mb-3">{requests.error}</Alert>
        )}
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
            alignments={{ Actions: "center" }}
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
            empty={!requests.error && !requests.data?.rows.length}
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
                    staff ? "flex flex-wrap items-center gap-2" : "text-center"
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
            requests.loading ||
            requestSearchPending ||
            requests.error ||
            (staff && !requests.data?.total)
              ? null
              : requests.data
          }
          label={staff ? "Payroll concern pages" : "Payroll request pages"}
          onPageChange={setRequestPage}
        />
      </div>
    </PayrollPageSection>
  )
  const confirmCalculation = confirm?.run.latestCalculation
  const confirmEmployeeCount =
    confirmCalculation?.payslipEmployeeCount ??
    (confirmCalculation
      ? confirmCalculation.calculatedItemCount +
        confirmCalculation.reviewItemCount +
        confirmCalculation.blockedItemCount
      : 0)
  const confirmGeneratedCount = confirmCalculation?.payslipGeneratedCount ?? 0
  const confirmMissingCount = Math.max(
    confirmEmployeeCount - confirmGeneratedCount,
    0,
  )
  const dialogs = (
    <>
      {discardResponseConfirm && (
        <ConfirmationDialog
          title="Discard unsaved response?"
          subject={selected ? humanizeEnum(selected.type) : undefined}
          description="Your response changes haven't been saved. Close without saving?"
          confirmLabel="Discard changes"
          pendingLabel="Discarding…"
          pending={false}
          destructive={false}
          onClose={() => setDiscardResponseConfirm(false)}
          onConfirm={() => {
            setDiscardResponseConfirm(false)
            setSelected(null)
            resetForm()
          }}
        />
      )}
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
              ? `Create ${confirmMissingCount} private PDFs from approved revision ${confirmCalculation?.revision ?? "—"}. ${confirmMissingCount} payslips are not generated yet.`
              : `Make ${confirmGeneratedCount} generated payslips available to employees. ${confirmMissingCount} documents are still missing.`
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
      {slip && !staff && (
        <IndividualPayslipDetails
          key={slip.id}
          slip={slip}
          onClose={() => setSlip(null)}
          onDownload={() => download(slip)}
        />
      )}
      {slip && staff && (
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
          sidePanel={!create}
          title={
            create
              ? editing
                ? "Edit concern"
                : staff
                  ? "Raise a concern"
                  : "New payroll request"
              : staff
                ? "Concern details"
                : "Payroll Request Details"
          }
          description={
            staff
              ? create
                ? editing
                  ? "Update the concern type, description, or related payslip."
                  : "Report missing payslips, salary discrepancies, or other payroll-related concerns."
                : "Your concern and Admin responses."
              : selected
                ? humanizeEnum(selected.type)
                : "Payroll request"
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
            ) : !staff && manage && selected && !create && openRequest ? (
              <SidePanelFooter>
                <SidePanelButton
                  type="submit"
                  form="payroll-request-response-form"
                  disabled={busy}
                >
                  {busy ? "Saving…" : "Save response"}
                </SidePanelButton>
              </SidePanelFooter>
            ) : undefined
          }
          busy={busy}
          preventClose={hasUnsavedResponseChanges}
          onPreventClose={() => setDiscardResponseConfirm(true)}
          onClose={closeSelectedRequest}
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
                <SidePanelSection title="Request information">
                  <DetailList>
                    <DetailItem label="Employee">
                      {selectedDetails.employee.fullName}
                    </DetailItem>
                    <DetailItem label="Employee ID">
                      {selectedDetails.employee.employeeId}
                    </DetailItem>
                    <DetailItem label="Status">
                      <Pill tone="neutral">
                        {humanizeEnum(selectedDetails.status)}
                      </Pill>
                    </DetailItem>
                    <DetailItem label="Submitted">
                      {timestamp(selectedDetails.createdAt)}
                    </DetailItem>
                    {selectedDetails.withdrawnAt && (
                      <DetailItem label="Withdrawn">
                        {timestamp(selectedDetails.withdrawnAt)}
                      </DetailItem>
                    )}
                    <DetailItem label="Related payslip">
                      {selectedDetails.payslip?.reference}
                    </DetailItem>
                    <DetailItem label="Description">
                      {selectedRequestDescription?.body}
                    </DetailItem>
                  </DetailList>
                  {selectedDetails.needsFinancialCorrection && (
                    <Pill tone="warning">Financial correction needed</Pill>
                  )}
                </SidePanelSection>
                {requestDetail.error && <Alert>{requestDetail.error}</Alert>}
                {requestDetail.loading && (
                  <div aria-busy="true">
                    <span className="sr-only" role="status">
                      Loading concern history…
                    </span>
                    <MemberRowSkeleton className="py-3" />
                    <MemberRowSkeleton className="py-3" />
                  </div>
                )}
                {requestConversation?.length ? (
                  <SidePanelSection title="Responses">
                    {requestConversation.map((entry) => (
                      <div
                        className="grid gap-1 border-b border-[#eceef1] pb-3 last:border-b-0"
                        key={entry.id}
                      >
                        <p className="text-xs">
                          {entry.isAdmin ? "Payroll Admin" : "Employee"} ·{" "}
                          {timestamp(entry.createdAt)}
                        </p>
                        <p className="m-0 whitespace-pre-wrap break-words text-sm">
                          {entry.body}
                        </p>
                      </div>
                    ))}
                  </SidePanelSection>
                ) : null}
                {selectedDetails.activity?.length ? (
                  <SidePanelSection title="Activity history">
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
                          className="grid gap-1 border-b border-[#eceef1] pb-3 text-xs last:border-b-0"
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
                  </SidePanelSection>
                ) : null}
              </>
            )}
            {(create || (openRequest && (staff || manage))) && (
              <Form
                id={
                  staff && create
                    ? "payroll-concern-form"
                    : manage && !create
                      ? "payroll-request-response-form"
                      : undefined
                }
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
                          fitOptions
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
                        fitOptions
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
                          fitOptions
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
                      fitOptions
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
                  {!(staff && create) && !(manage && !create) && (
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
        <div className="grid min-w-0 gap-6">
          {overview.error && <Alert>{overview.error}</Alert>}
          {overview.data && !overview.data.linked && (
            <Alert>Your Staff account has no linked employee record.</Alert>
          )}
          {payslipsContent}
          {requestsContent}
          {dialogs}
        </div>
      </main>
    )

  return (
    <main className={contentClass + " min-w-0 p-[clamp(16px,2.1vw,32px)]"}>
      <PageHeader
        headingId="payroll-documents-heading"
        title="Payslips & Payroll History"
        description="Manage approved payroll records, employee payslips, and publication history."
        actions={!manage ? <Pill tone="neutral">Read only</Pill> : undefined}
      />
      <Tabs
        value={activeTab}
        onValueChange={(tab) => {
          setActiveTab(tab)
          setRefresh((value) => value + 1)
        }}
        className="mt-[18px] min-w-0"
      >
        <TabsContent value="payslips">{payslipsContent}</TabsContent>
        <TabsContent value="runs">
          {manage ? (
            approvedRunsContent
          ) : (
            <Alert>
              Approved run actions are available to payroll managers.
            </Alert>
          )}
        </TabsContent>
        <TabsContent value="requests">{requestsContent}</TabsContent>
      </Tabs>
      {selectedRunId && (
        <ApprovedRunDetailsSidebar
          key={selectedRunId}
          runId={selectedRunId}
          refreshKey={refresh}
          manage={manage}
          busy={busy}
          onClose={() => setSelectedRunId("")}
          onAction={(action, run) => {
            resetForm()
            if (
              action === "publish" &&
              preferences.data?.requirePublicationConfirmation === false
            ) {
              void mutate(
                "/runs/" + encodeURIComponent(run.id) + "/publish-payslips",
              )
              return
            }
            setConfirm({ action, run })
          }}
          onChanged={() => setRefresh((value) => value + 1)}
        />
      )}
      {dialogs}
    </main>
  )
}
