"use client"

import { useState } from "react"
import {
  Ban,
  Check,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock3,
  Eye,
  Plus,
  Settings2,
} from "lucide-react"
import { PageHeader, PageHeaderButton } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FilterSelect, filterBarClass } from "@/components/ui/filter-select"
import { MemberRowSkeleton } from "@/components/ui/panel-loading"
import { Pill } from "@/components/ui/pill"
import {
  RowActionLabel,
  RowActionsMenu,
} from "@/components/ui/row-actions-menu"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { useTableSearchQuery } from "@/components/ui/use-table-search-query"
import { SearchField } from "@/components/ui/search-field"
import {
  DetailItem,
  DetailList,
  SidePanelButton,
  SidePanel,
  SidePanelBody,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelSection,
} from "@/components/ui/side-panel"
import { EmptyState } from "@/components/ui/empty-state"
import {
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
  ResponsiveDataTableRow,
} from "@/components/ui/responsive-data-table"
import {
  TablePaginationFooter,
  pageRange,
} from "@/components/ui/table-pagination-footer"
import { apiRequest } from "@/features/auth/api/auth-api"
import { canManagePayroll } from "@/features/auth/model/permissions"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { listPayrollRuns } from "@/features/payroll/api/payroll-runs-api"
import { errorMessage } from "@/lib/error-message"
import { formatDateTime, humanizeEnum } from "@/lib/format"
import { sileo } from "@/lib/toast"
import { useAsyncResource } from "@/lib/use-async-resource"
import { getPayrollPreferences } from "@/features/payroll/api/payroll-api"
import { formatPayrollMoney } from "@/features/payroll/model/money"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Batch = {
  id: string
  period: string
  runId: string
  revision: number
  frequency: string
  status: string
  employeeCount: number
  blockedCount: number
  totalNet: string
  proposedAmount: string
  createdAt: string
}
type Detail = Batch & {
  simulatorEnabled: boolean
  itemsPage: {
    page: number
    pageSize: number
    total: number
    sort: string
    search: string
    status: string
  }
  items: {
    id: string
    employeeId: string
    employeeNameSnapshot: string
    employeeNumberSnapshot: string
    employeeEmail: string | null
    approvedNet: string
    destination: { kind: string; masked: string } | null
    attempt: { outcome: string } | null
    reason: string
    status: string
  }[]
  history: {
    id: string
    changes: { activity: string }
    createdAt: string
    actorAccountId: string
    actorName: string
  }[]
}
const batchGrid =
  "grid grid-cols-[minmax(0,1.15fr)_minmax(0,1.4fr)_minmax(48px,.55fr)_minmax(56px,.65fr)_minmax(105px,1fr)_minmax(76px,.7fr)_minmax(110px,.95fr)_44px] items-center gap-3"

const base = "/api/payroll/disbursements"
const timestamp = (date: string) => formatDateTime(date, "Asia/Manila")
const historyDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  month: "long",
  day: "numeric",
  year: "numeric",
})
const historyDateKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
function groupHistoryByDate(entries: Detail["history"]) {
  const groups = new Map<
    string,
    { key: string; label: string; entries: Detail["history"] }
  >()
  for (const entry of entries) {
    const date = new Date(entry.createdAt)
    const key = historyDateKey.format(date)
    const group = groups.get(key)
    if (group) {
      group.entries.push(entry)
    } else {
      groups.set(key, {
        key,
        label: historyDate.format(date),
        entries: [entry],
      })
    }
  }
  return [...groups.values()]
}
const payoutStatuses = [
  "",
  "BLOCKED",
  "NO_PAYMENT",
  "SUCCEEDED",
  "FAILED",
  "PENDING",
] as const
const payoutGrid =
  "grid grid-cols-[minmax(0,1.45fr)_minmax(88px,.82fr)_minmax(104px,1fr)_minmax(74px,.75fr)_36px] items-center gap-2 @max-[460px]:grid-cols-[minmax(0,1.2fr)_76px_82px_68px_32px]"
const payoutSorts = [
  { value: "NAME_ASC", label: "Name A–Z" },
  { value: "NAME_DESC", label: "Name Z–A" },
  { value: "NET_DESC", label: "Net pay high–low" },
  { value: "NET_ASC", label: "Net pay low–high" },
]

function batchTone(status: string) {
  return status === "BLOCKED"
    ? "warning"
    : status === "CANCELLED"
      ? "danger"
      : "neutral"
}

function payoutTone(status: string) {
  return status === "SUCCEEDED"
    ? "success"
    : status === "FAILED"
      ? "danger"
      : status === "PENDING" || status === "BLOCKED"
        ? "warning"
        : "neutral"
}

export default function DisbursementsPage() {
  const manage = canManagePayroll(usePortalAccount())
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [runId, setRunId] = useState("")
  const [runSearch, setRunSearch] = useState("")
  const [prepareOpen, setPrepareOpen] = useState(false)
  const [selected, setSelected] = useState("")
  const [detailTab, setDetailTab] = useState("source")
  const [itemSearch, setItemSearch] = useState("")
  const [itemStatus, setItemStatus] =
    useState<(typeof payoutStatuses)[number]>("")
  const [itemSort, setItemSort] = useState("NAME_ASC")
  const [itemPage, setItemPage] = useState(1)
  const [itemPageSize, setItemPageSize] = useState(10)
  const [configureItem, setConfigureItem] = useState<string | null>(null)
  const [destinationKind, setDestinationKind] = useState("TEST_BANK")
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(false)
  const [cancel, setCancel] = useState(false)
  const [error, setError] = useState("")
  const [simulation, setSimulation] = useState<{
    path: string
    outcome: "SUCCEEDED" | "FAILED" | "PENDING"
    employee: string
    idempotencyKey: string
  } | null>(null)
  const preferences = useAsyncResource(getPayrollPreferences, [], {
    enabled: manage,
  })
  const { query: batchQuery, pending: batchSearchPending } =
    useTableSearchQuery(search)
  const { query: runQuery, pending: runSearchPending } =
    useTableSearchQuery(runSearch)
  const { query: itemQuery, pending: itemSearchPending } =
    useTableSearchQuery(itemSearch)
  function openBatch(id: string) {
    if (id === selected) {
      setSelected(id)
      return
    }
    setItemSearch("")
    setItemStatus("")
    setItemSort("NAME_ASC")
    setItemPage(1)
    setItemPageSize(10)
    setConfigureItem(null)
    setDetailTab("source")
    setSelected(id)
  }
  const runs = useAsyncResource(
    (signal) =>
      listPayrollRuns({
        page: 1,
        search: runQuery,
        status: "APPROVED",
        signal,
      }),
    [runQuery],
    {
      enabled: manage && !runSearchPending,
      fallbackError: "Couldn't load approved runs.",
    },
  )
  const batches = useAsyncResource(
    (signal) =>
      apiRequest<{
        rows: Batch[]
        page: number
        pageSize: number
        total: number
      }>(
        base +
          "?" +
          new URLSearchParams({
            search: batchQuery,
            status,
            page: String(page),
          }),
        { signal },
      ),
    [batchQuery, status, page, refresh],
    {
      enabled: !batchSearchPending,
      fallbackError: "Couldn't load disbursement batches.",
    },
  )
  const detail = useAsyncResource(
    (signal) =>
      apiRequest<Detail>(
        base +
          "/" +
          encodeURIComponent(selected) +
          "?" +
          new URLSearchParams({
            page: String(itemPage),
            pageSize: String(itemPageSize),
            search: itemQuery,
            status: itemStatus,
            sort: itemSort,
          }),
        { signal },
      ),
    [
      selected,
      refresh,
      itemPage,
      itemPageSize,
      itemQuery,
      itemStatus,
      itemSort,
    ],
    {
      enabled: Boolean(selected) && !itemSearchPending,
      fallbackError: "Couldn't load batch details.",
    },
  )

  async function mutate(
    path: string,
    body?: object,
    done?: { title: string; description?: string },
  ) {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      const batch = await apiRequest<Batch>(base + path, {
        method: "POST",
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      setCancel(false)
      if (path.endsWith("/simulate")) setSimulation(null)
      openBatch(batch.id)
      if (path.endsWith("/destination")) setConfigureItem(null)
      setRefresh((value) => value + 1)
      if (done) sileo.success(done)
    } catch (cause) {
      setError(errorMessage(cause, "Couldn't update the disbursement batch."))
    } finally {
      setBusy(false)
    }
  }

  function recordSimulation(request: NonNullable<typeof simulation>) {
    return mutate(
      request.path,
      {
        outcome: request.outcome,
        idempotencyKey: request.idempotencyKey,
      },
      {
        title: "Simulation recorded",
        description: `${humanizeEnum(request.outcome)} outcome recorded for ${request.employee}.`,
      },
    )
  }

  async function prepareBatch() {
    if (!runId || busy) return
    setBusy(true)
    setError("")
    try {
      await apiRequest<Batch>(base, {
        method: "POST",
        body: JSON.stringify({ runId }),
      })
      setPrepareOpen(false)
      setRunId("")
      setRunSearch("")
      setRefresh((value) => value + 1)
      sileo.success({
        title: "Disbursement batch prepared",
        description: "The batch is ready for review and validation.",
      })
    } catch (cause) {
      setError(errorMessage(cause, "Couldn't prepare the disbursement batch."))
    } finally {
      setBusy(false)
    }
  }

  const result = batches.data
  const batch = detail.data?.id === selected ? detail.data : null
  const eligibleRuns = (runs.data?.rows ?? []).filter(
    (run) => run.status === "APPROVED" && run.latestCalculation,
  )
  const selectedRun = eligibleRuns.find((run) => run.id === runId) ?? null
  return (
    <main
      className={`${contentClass} min-w-0 p-[clamp(16px,2.1vw,32px)]`}
      aria-label="Disbursements"
    >
      <PageHeader
        headingId="disbursements-heading"
        title="Disbursements"
        description="Prepare, review, and track employee payroll disbursements."
        actions={
          manage ? (
            <PageHeaderButton
              type="button"
              disabled={busy}
              onClick={() => {
                setError("")
                setRunId("")
                setRunSearch("")
                setPrepareOpen(true)
              }}
            >
              <Plus size={16} aria-hidden="true" />
              Prepare batch
            </PageHeaderButton>
          ) : (
            <Pill tone="neutral">Read only</Pill>
          )
        }
      />
      <section
        className="@container mt-[18px] min-w-0 max-[767px]:mt-[14px]"
        aria-label="Disbursement batches"
      >
        <div className={`${filterBarClass} pb-4`}>
          <SearchField
            label="Search batches"
            placeholder="Search period or reference…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
          <FilterSelect
            fitOptions
            label="Batch status"
            triggerClassName="w-[142px]"
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
            options={[
              { value: "", label: "All statuses" },
              ...["DRAFT", "BLOCKED", "CANCELLED"].map((value) => ({
                value,
                label: humanizeEnum(value),
              })),
            ]}
          />
        </div>
        {error && !cancel && !prepareOpen && (
          <Alert className="mb-3">{error}</Alert>
        )}
        {batches.error && !batchSearchPending ? (
          <EmptyState
            title="Disbursement batches couldn't be loaded"
            description={batches.error}
            role="alert"
            action={
              <Button variant="outline" onClick={batches.retry}>
                Try again
              </Button>
            }
          />
        ) : !batches.loading && !batchSearchPending && !result?.rows.length ? (
          <EmptyState
            title={
              search || status ? "No matching batches" : "No batches found"
            }
            description={
              search || status
                ? "Adjust the search or filter to see other batches."
                : "Prepared payroll batches will appear here."
            }
            size="lg"
          />
        ) : (
          <>
            <ResponsiveDataTable
              label="Disbursement batches"
              aria-busy={batches.loading || batchSearchPending}
            >
              <ResponsiveDataTableHeader
                className="@max-[820px]:sr-only"
                rowClassName={`${batchGrid} px-4`}
              >
                <ResponsiveDataTableColumnHeader>
                  Payroll period
                </ResponsiveDataTableColumnHeader>
                <ResponsiveDataTableColumnHeader>
                  Batch reference
                </ResponsiveDataTableColumnHeader>
                <ResponsiveDataTableColumnHeader className="text-right">
                  Revision
                </ResponsiveDataTableColumnHeader>
                <ResponsiveDataTableColumnHeader className="text-right">
                  Employees
                </ResponsiveDataTableColumnHeader>
                <ResponsiveDataTableColumnHeader className="text-right">
                  Proposed amount
                </ResponsiveDataTableColumnHeader>
                <ResponsiveDataTableColumnHeader>
                  Status
                </ResponsiveDataTableColumnHeader>
                <ResponsiveDataTableColumnHeader>
                  Created
                </ResponsiveDataTableColumnHeader>
                <ResponsiveDataTableColumnHeader className="text-center">
                  Details
                </ResponsiveDataTableColumnHeader>
              </ResponsiveDataTableHeader>
              <ResponsiveDataTableBody>
                {batches.loading || batchSearchPending ? (
                  <DataTableSkeletonRows
                    label="disbursement batches"
                    rows={3}
                    rowClassName={`${batchGrid} min-h-14 px-4 py-3 @max-[820px]:grid-cols-2`}
                    cellClassNames={Array.from({ length: 8 }, () => "")}
                  />
                ) : (
                  result?.rows.map((row) => (
                    <ResponsiveDataTableRow
                      key={row.id}
                      variant="directory"
                      className={`${batchGrid} min-h-14 text-xs @max-[820px]:grid-cols-2 @max-[820px]:gap-y-2`}
                    >
                      <ResponsiveDataTableCell className="min-w-0 truncate">
                        <span title={row.period}>{row.period}</span>
                      </ResponsiveDataTableCell>
                      <ResponsiveDataTableCell
                        className="min-w-0 truncate"
                        title={row.id}
                      >
                        {row.id}
                      </ResponsiveDataTableCell>
                      <ResponsiveDataTableCell className="text-right tabular-nums">
                        {row.revision}
                      </ResponsiveDataTableCell>
                      <ResponsiveDataTableCell className="text-right tabular-nums">
                        {row.employeeCount}
                      </ResponsiveDataTableCell>
                      <ResponsiveDataTableCell
                        className="whitespace-nowrap text-right tabular-nums"
                        title="Current proposed disbursement amount"
                      >
                        {formatPayrollMoney(row.proposedAmount)}
                      </ResponsiveDataTableCell>
                      <ResponsiveDataTableCell>
                        <Pill
                          tone={
                            row.status === "BLOCKED" ? "warning" : "neutral"
                          }
                        >
                          {humanizeEnum(row.status)}
                        </Pill>
                      </ResponsiveDataTableCell>
                      <ResponsiveDataTableCell className="min-w-0 truncate">
                        <span title={timestamp(row.createdAt)}>
                          {timestamp(row.createdAt)}
                        </span>
                      </ResponsiveDataTableCell>
                      <ResponsiveDataTableCell className="flex justify-center">
                        <Button
                          type="button"
                          variant="rowAction"
                          size={null}
                          aria-label={`View disbursement batch ${row.period}`}
                          onClick={() => openBatch(row.id)}
                        >
                          <Eye size={15} aria-hidden="true" />
                        </Button>
                      </ResponsiveDataTableCell>
                    </ResponsiveDataTableRow>
                  ))
                )}
              </ResponsiveDataTableBody>
            </ResponsiveDataTable>
            {result && !batches.loading && !batchSearchPending && (
              <TablePaginationFooter
                {...pageRange(result.page, result.pageSize, result.total)}
                page={result.page}
                total={result.total}
                totalPages={Math.ceil(result.total / result.pageSize)}
                label="Batch pages"
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </section>
      <Dialog
        open={prepareOpen}
        onOpenChange={(open) => {
          if (busy) return
          setPrepareOpen(open)
          if (!open) setError("")
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prepare Disbursement Batch</DialogTitle>
            <DialogDescription>
              Select an approved payroll run to create a sandbox-ready batch.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className={filterBarClass}>
              <SearchField
                label="Search approved runs"
                placeholder="Search payroll periods…"
                value={runSearch}
                onChange={(event) => {
                  setRunSearch(event.target.value)
                  setRunId("")
                }}
              />
              <FilterSelect
                fitOptions
                label="Approved payroll run"
                value={runId}
                onChange={setRunId}
                options={[
                  { value: "", label: "Select approved run" },
                  ...eligibleRuns.map((run) => ({
                    value: run.id,
                    label: run.period.cutoffLabel,
                  })),
                ]}
              />
            </div>
            {runs.error && (
              <Alert as="div" className="flex flex-wrap items-center gap-3">
                <span>{runs.error}</span>
                <Button variant="outline" size="sm" onClick={runs.retry}>
                  Try again
                </Button>
              </Alert>
            )}
            {!runs.error && (runs.loading || runSearchPending) && (
              <div aria-busy="true">
                <span className="sr-only" role="status">
                  Loading approved payroll runs…
                </span>
                <MemberRowSkeleton className="py-3" />
                <MemberRowSkeleton className="py-3" />
              </div>
            )}
            {!runs.error &&
              !runs.loading &&
              !runSearchPending &&
              eligibleRuns.length === 0 && (
                <EmptyState
                  size="sm"
                  title={
                    runSearch ? "No matching approved runs" : "No approved runs"
                  }
                  description={
                    runSearch
                      ? "Adjust the search to find another eligible payroll run."
                      : "Approved payroll runs will appear here once available."
                  }
                />
              )}
            {selectedRun?.latestCalculation && (
              <DetailList>
                <DetailItem label="Payroll period">
                  {selectedRun.period.cutoffLabel}
                </DetailItem>
                <DetailItem label="Frequency">
                  {humanizeEnum(selectedRun.period.frequency)}
                </DetailItem>
                <DetailItem label="Approved revision">
                  <span className="tabular-nums">
                    {selectedRun.latestCalculation.revision}
                  </span>
                </DetailItem>
                <DetailItem label="Employees">
                  <span className="tabular-nums">
                    {selectedRun.latestCalculation.calculatedItemCount}
                  </span>
                </DetailItem>
                <DetailItem label="Approved net payroll">
                  <span className="font-semibold tabular-nums text-[#101d35]">
                    {formatPayrollMoney(selectedRun.latestCalculation.netTotal)}
                  </span>
                </DetailItem>
              </DetailList>
            )}
            {error && <Alert>{error}</Alert>}
          </div>
          <DialogFooter className="flex-row flex-wrap justify-end gap-2 sm:space-x-0">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setPrepareOpen(false)
                setError("")
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!selectedRun?.latestCalculation || busy}
              onClick={() => void prepareBatch()}
            >
              {busy ? "Preparing…" : "Prepare batch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {selected && (
        <SidePanel
          open
          onOpenChange={(open) => {
            if (!open) setSelected("")
          }}
          busy={busy}
        >
          <SidePanelHeader
            title="Disbursement Details"
            description={
              batch
                ? `${batch.period} · Revision ${batch.revision}`
                : "Loading disbursement details…"
            }
            meta={
              batch ? (
                <>
                  <Pill tone={batchTone(batch.status)}>
                    {humanizeEnum(batch.status)}
                  </Pill>
                  <span
                    className="max-w-[110px] truncate text-[10px] text-[#738096]"
                    title={`Batch reference ${selected}`}
                  >
                    Ref {selected.slice(0, 8)}…
                    <span className="sr-only"> {selected}</span>
                  </span>
                </>
              ) : undefined
            }
          />
          <Tabs
            value={detailTab}
            onValueChange={setDetailTab}
            className="flex min-h-0 min-w-0 flex-1 flex-col"
          >
            <div className="flex-none">
              <TabsList
                aria-label="Disbursement detail sections"
                variant="underline"
              >
                <TabsTrigger value="source" variant="underline">
                  Payroll source
                </TabsTrigger>
                <TabsTrigger value="payouts" variant="underline">
                  Employee payouts
                </TabsTrigger>
                <TabsTrigger value="activity" variant="underline">
                  Activity history
                </TabsTrigger>
              </TabsList>
            </div>
            <SidePanelBody>
              {detail.error && <Alert>{detail.error}</Alert>}
              {detail.loading && !batch && (
                <div aria-busy="true">
                  <span className="sr-only" role="status">
                    Loading batch details…
                  </span>
                  <MemberRowSkeleton className="py-3" />
                  <MemberRowSkeleton className="py-3" />
                  <MemberRowSkeleton className="py-3" />
                </div>
              )}
              {batch && !detail.error && (
                <>
                  <TabsContent
                    value="source"
                    className="mt-0 grid gap-5 outline-none"
                  >
                    <SidePanelSection title="Payroll source">
                      <DetailList>
                        <DetailItem label="Payroll period">
                          {batch.period}
                        </DetailItem>
                        <DetailItem label="Frequency">
                          {batch.frequency
                            ? humanizeEnum(batch.frequency)
                            : "—"}
                        </DetailItem>
                        <DetailItem label="Revision">
                          {batch.revision}
                        </DetailItem>
                        <DetailItem label="Approved net pay">
                          <span className="font-semibold tabular-nums text-[#101d35]">
                            {formatPayrollMoney(batch.totalNet)}
                          </span>
                        </DetailItem>
                        <DetailItem label="Proposed payout">
                          <span className="font-semibold tabular-nums text-[#52627a]">
                            {formatPayrollMoney(batch.proposedAmount)}
                          </span>
                        </DetailItem>
                        <DetailItem label="Blocked employees">
                          <span className="tabular-nums">
                            {batch.blockedCount} of {batch.employeeCount}
                          </span>
                        </DetailItem>
                        <DetailItem label="Payroll run">
                          <span
                            className="block truncate text-[10px]"
                            title={batch.runId}
                          >
                            {batch.runId}
                          </span>
                        </DetailItem>
                      </DetailList>
                    </SidePanelSection>
                  </TabsContent>
                  <TabsContent
                    value="payouts"
                    className="mt-0 grid gap-5 outline-none"
                  >
                    <SidePanelSection
                      title="Employee payouts"
                      action={
                        <Pill tone="neutral">
                          {batch.simulatorEnabled
                            ? "Test environment"
                            : "Transfers disabled"}
                        </Pill>
                      }
                    >
                      <div className="grid gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <SearchField
                            label="Search employees in this batch"
                            placeholder="Search name, email, or employee ID…"
                            value={itemSearch}
                            onChange={(event) => {
                              setItemSearch(event.target.value)
                              setItemPage(1)
                            }}
                            containerClassName="min-w-[190px] flex-1"
                          />
                          <FilterSelect
                            fitOptions
                            label="Payout status"
                            value={itemStatus}
                            onChange={(value) => {
                              setItemStatus(
                                value as (typeof payoutStatuses)[number],
                              )
                              setItemPage(1)
                            }}
                            options={payoutStatuses.map((value) => ({
                              value,
                              label: value
                                ? humanizeEnum(value)
                                : "All statuses",
                            }))}
                          />
                          <FilterSelect
                            fitOptions
                            label="Sort payouts"
                            value={itemSort}
                            onChange={(value) => {
                              setItemSort(value)
                              setItemPage(1)
                            }}
                            options={payoutSorts}
                          />
                        </div>
                        <ResponsiveDataTable
                          label="Employee payouts"
                          aria-busy={detail.loading || itemSearchPending}
                        >
                          <ResponsiveDataTableHeader
                            rowClassName={`${payoutGrid} px-3 text-[11px]`}
                          >
                            <ResponsiveDataTableColumnHeader>
                              Employee
                            </ResponsiveDataTableColumnHeader>
                            <ResponsiveDataTableColumnHeader className="text-right">
                              Net pay
                            </ResponsiveDataTableColumnHeader>
                            <ResponsiveDataTableColumnHeader>
                              Destination
                            </ResponsiveDataTableColumnHeader>
                            <ResponsiveDataTableColumnHeader>
                              Status
                            </ResponsiveDataTableColumnHeader>
                            <ResponsiveDataTableColumnHeader className="text-center">
                              Actions
                            </ResponsiveDataTableColumnHeader>
                          </ResponsiveDataTableHeader>
                          <ResponsiveDataTableBody>
                            {detail.loading || itemSearchPending ? (
                              <DataTableSkeletonRows
                                label="employee payouts"
                                rows={4}
                                rowClassName={`${payoutGrid} min-h-[54px] px-3 py-2 text-[11px]`}
                                cellClassNames={["", "", "", "", ""]}
                              />
                            ) : batch.items.length === 0 ? (
                              <ResponsiveDataTableRow>
                                <ResponsiveDataTableCell
                                  aria-colspan={5}
                                  className="p-4"
                                >
                                  <EmptyState
                                    size="sm"
                                    title="No matching employees"
                                    description="Adjust the search or filters to see payout items."
                                  />
                                </ResponsiveDataTableCell>
                              </ResponsiveDataTableRow>
                            ) : (
                              batch.items.map((item) => {
                                const actionsEnabled =
                                  manage &&
                                  batch.simulatorEnabled &&
                                  batch.status !== "CANCELLED" &&
                                  item.status !== "NO_PAYMENT"
                                const actionItems = actionsEnabled
                                  ? item.attempt
                                    ? [
                                        {
                                          action: "recorded" as const,
                                          label: (
                                            <RowActionLabel icon={CircleCheck}>
                                              Simulation recorded
                                            </RowActionLabel>
                                          ),
                                          disabled: true,
                                        },
                                      ]
                                    : item.destination
                                      ? [
                                          {
                                            action: "SUCCEEDED" as const,
                                            label: (
                                              <RowActionLabel icon={Check}>
                                                Simulate success
                                              </RowActionLabel>
                                            ),
                                          },
                                          {
                                            action: "FAILED" as const,
                                            label: (
                                              <RowActionLabel icon={CircleX}>
                                                Simulate failure
                                              </RowActionLabel>
                                            ),
                                          },
                                          {
                                            action: "PENDING" as const,
                                            label: (
                                              <RowActionLabel icon={Clock3}>
                                                Simulate pending
                                              </RowActionLabel>
                                            ),
                                          },
                                        ]
                                      : [
                                          {
                                            action: "configure" as const,
                                            label: (
                                              <RowActionLabel icon={Settings2}>
                                                Configure test destination
                                              </RowActionLabel>
                                            ),
                                          },
                                        ]
                                  : [
                                      {
                                        action: "unavailable" as const,
                                        label: (
                                          <RowActionLabel
                                            icon={
                                              item.status === "NO_PAYMENT"
                                                ? Ban
                                                : CircleAlert
                                            }
                                          >
                                            {item.status === "NO_PAYMENT"
                                              ? "No payout required"
                                              : "No actions available"}
                                          </RowActionLabel>
                                        ),
                                        disabled: true,
                                      },
                                    ]
                                return (
                                  <ResponsiveDataTableRow
                                    key={item.id}
                                    className={`${payoutGrid} min-h-[54px] border-b border-[#eceef1] px-3 py-2 text-[11px] last:border-0`}
                                  >
                                    <ResponsiveDataTableCell className="min-w-0">
                                      <span
                                        className="block truncate font-semibold"
                                        title={item.employeeNameSnapshot}
                                      >
                                        {item.employeeNameSnapshot}
                                      </span>
                                      <span
                                        className="block truncate text-[10px] text-[#738096]"
                                        title={
                                          item.employeeEmail
                                            ? `${item.employeeNumberSnapshot} · ${item.employeeEmail}`
                                            : item.employeeNumberSnapshot
                                        }
                                      >
                                        {item.employeeNumberSnapshot}
                                        {item.employeeEmail
                                          ? ` · ${item.employeeEmail}`
                                          : ""}
                                      </span>
                                    </ResponsiveDataTableCell>
                                    <ResponsiveDataTableCell className="whitespace-nowrap text-right tabular-nums">
                                      {formatPayrollMoney(item.approvedNet)}
                                    </ResponsiveDataTableCell>
                                    <ResponsiveDataTableCell
                                      className="min-w-0 truncate text-[10px] text-[#52627a]"
                                      title={
                                        item.destination
                                          ? `Generated test destination ${item.destination.masked}`
                                          : "No generated test destination"
                                      }
                                    >
                                      {item.destination
                                        ? `${humanizeEnum(item.destination.kind)} ${item.destination.masked}`
                                        : item.status === "BLOCKED"
                                          ? "Test destination required"
                                          : "Not configured"}
                                    </ResponsiveDataTableCell>
                                    <ResponsiveDataTableCell>
                                      <Pill
                                        tone={payoutTone(item.status)}
                                        title={item.reason}
                                      >
                                        {humanizeEnum(item.status)}
                                      </Pill>
                                    </ResponsiveDataTableCell>
                                    <ResponsiveDataTableCell className="flex justify-center">
                                      <RowActionsMenu
                                        triggerLabel={`Actions for ${item.employeeNameSnapshot}`}
                                        menuLabel={`Payout actions for ${item.employeeNameSnapshot}`}
                                        items={actionItems}
                                        disabled={
                                          busy ||
                                          preferences.loading ||
                                          !actionsEnabled
                                        }
                                        onAction={(action) => {
                                          if (action === "configure") {
                                            setError("")
                                            setConfigureItem(item.id)
                                            setDestinationKind("TEST_BANK")
                                            return
                                          }
                                          if (
                                            action === "SUCCEEDED" ||
                                            action === "FAILED" ||
                                            action === "PENDING"
                                          ) {
                                            const request = {
                                              path:
                                                "/" +
                                                batch.id +
                                                "/items/" +
                                                item.id +
                                                "/simulate",
                                              outcome: action,
                                              employee:
                                                item.employeeNameSnapshot,
                                              idempotencyKey:
                                                crypto.randomUUID(),
                                            } as const
                                            if (
                                              preferences.error ||
                                              preferences.data
                                                ?.requireSimulationConfirmation ===
                                                true
                                            ) {
                                              setError("")
                                              setSimulation(request)
                                            } else {
                                              void recordSimulation(request)
                                            }
                                          }
                                        }}
                                      />
                                    </ResponsiveDataTableCell>
                                  </ResponsiveDataTableRow>
                                )
                              })
                            )}
                          </ResponsiveDataTableBody>
                        </ResponsiveDataTable>
                        {batch.itemsPage && (
                          <TablePaginationFooter
                            {...pageRange(
                              batch.itemsPage.page,
                              batch.itemsPage.pageSize,
                              batch.itemsPage.total,
                            )}
                            page={batch.itemsPage.page}
                            total={batch.itemsPage.total}
                            totalPages={Math.ceil(
                              batch.itemsPage.total / batch.itemsPage.pageSize,
                            )}
                            label="Employee payout pages"
                            itemLabel="employees"
                            disabled={detail.loading || itemSearchPending}
                            onPageChange={setItemPage}
                          />
                        )}
                        <FilterSelect
                          fitOptions
                          label="Employees per page"
                          value={String(itemPageSize)}
                          onChange={(value) => {
                            setItemPageSize(Number(value))
                            setItemPage(1)
                          }}
                          options={[10, 20, 50].map((value) => ({
                            value: String(value),
                            label: `${value} per page`,
                          }))}
                        />
                      </div>
                    </SidePanelSection>
                  </TabsContent>
                  <TabsContent
                    value="activity"
                    className="mt-0 grid gap-5 outline-none"
                  >
                    <SidePanelSection title="Activity history">
                      {batch.history.length ? (
                        <div className="grid gap-5">
                          {groupHistoryByDate(batch.history).map((group) => (
                            <section
                              key={group.key}
                              aria-labelledby={`activity-date-${group.key}`}
                              className="grid gap-2"
                            >
                              <h4
                                id={`activity-date-${group.key}`}
                                className="m-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#738096]"
                              >
                                {group.label}
                              </h4>
                              <ol
                                aria-label={`${group.label} disbursement activity`}
                                className="m-0 list-none p-0"
                              >
                                {group.entries.map((entry) => (
                                  <li
                                    key={entry.id}
                                    className="relative grid gap-1 border-b border-[#eceef1] pb-4 pl-5 pt-0 last:border-0 last:pb-0 before:absolute before:left-0 before:top-1.5 before:z-10 before:size-2.5 before:rounded-full before:bg-[#284f9e] before:ring-4 before:ring-background after:absolute after:bottom-0 after:left-[4px] after:top-4 after:w-px after:bg-[#dfe6eb] last:after:hidden"
                                  >
                                    <span className="text-xs font-medium text-[#182235]">
                                      {humanizeEnum(entry.changes.activity)}
                                    </span>
                                    <span className="text-[10px] text-[#738096]">
                                      {timestamp(entry.createdAt)} · Actor{" "}
                                      <span title={entry.actorAccountId}>
                                        {entry.actorName ||
                                          entry.actorAccountId}
                                      </span>
                                    </span>
                                    <span
                                      className="truncate text-[10px] text-[#94a3b8]"
                                      title={entry.id}
                                    >
                                      Event {entry.id}
                                    </span>
                                  </li>
                                ))}
                              </ol>
                            </section>
                          ))}
                        </div>
                      ) : (
                        <p className="m-0 text-xs text-[#738096]">
                          No activity recorded for this batch.
                        </p>
                      )}
                    </SidePanelSection>
                  </TabsContent>
                </>
              )}
            </SidePanelBody>
          </Tabs>
          <SidePanelFooter className="justify-between">
            <SidePanelButton
              variant="secondary"
              disabled={busy}
              onClick={() => setSelected("")}
            >
              Close
            </SidePanelButton>
            {manage && batch && batch.status !== "CANCELLED" && (
              <div className="flex flex-wrap justify-end gap-2">
                <SidePanelButton
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setError("")
                    setCancel(true)
                  }}
                >
                  Cancel batch
                </SidePanelButton>
                {batch.status === "DRAFT" && (
                  <SidePanelButton
                    disabled={busy}
                    onClick={() =>
                      void mutate("/" + batch.id + "/validate", undefined, {
                        title: "Batch validated",
                        description:
                          "The disbursement batch was validated and its audit history was updated.",
                      })
                    }
                  >
                    Validate batch
                  </SidePanelButton>
                )}
              </div>
            )}
          </SidePanelFooter>
        </SidePanel>
      )}
      {configureItem && batch && (
        <ConfirmationDialog
          title="Configure test destination"
          subject={
            batch.items.find((item) => item.id === configureItem)
              ?.employeeNameSnapshot
          }
          description="This creates a masked test destination for the local sandbox simulator. It is not a verified production payout account."
          confirmLabel="Save destination"
          pendingLabel="Saving…"
          pending={busy}
          destructive={false}
          error={error}
          onClose={() => setConfigureItem(null)}
          onConfirm={() =>
            void mutate(
              "/" + batch.id + "/items/" + configureItem + "/destination",
              { kind: destinationKind },
              {
                title: "Test destination configured",
                description:
                  "The generated sandbox destination was saved. It does not enable production payouts.",
              },
            )
          }
        >
          <label className="mt-4 grid gap-2 text-sm">
            Test destination type
            <Select value={destinationKind} onValueChange={setDestinationKind}>
              <SelectTrigger aria-label="Test destination type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TEST_BANK">Test bank</SelectItem>
                <SelectItem value="TEST_EWALLET">Test e-wallet</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </ConfirmationDialog>
      )}
      {cancel && batch && (
        <ConfirmationDialog
          title="Cancel batch?"
          description="This closes the batch and preserves its audit history."
          confirmLabel="Cancel batch"
          cancelLabel="Keep batch"
          pendingLabel="Cancelling…"
          pending={busy}
          error={error}
          onClose={() => setCancel(false)}
          onConfirm={() =>
            void mutate("/" + batch.id + "/cancel", undefined, {
              title: "Batch cancelled",
              description:
                "The disbursement batch was cancelled and its audit history was preserved.",
            })
          }
        />
      )}
      {simulation && (
        <ConfirmationDialog
          title="Record sandbox simulation?"
          subject={simulation.employee}
          description={`Record a ${humanizeEnum(simulation.outcome).toLowerCase()} outcome for this test payout.`}
          confirmLabel="Record simulation"
          pendingLabel="Recording…"
          pending={busy}
          error={error}
          destructive={false}
          onClose={() => setSimulation(null)}
          onConfirm={() => void recordSimulation(simulation)}
        />
      )}
    </main>
  )
}
