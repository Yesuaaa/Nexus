"use client"

import Link from "next/link"
import { useState } from "react"
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  LoaderCircle,
  Plus,
} from "lucide-react"
import {
  ClientPageHeader,
  clientPageHeaderActionClass,
} from "@/components/layout/client-page-header"
import { contentClass } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { ClientTableSkeleton } from "@/components/ui/client-table-skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterSelect } from "@/components/ui/filter-select"
import { KpiCards } from "@/components/ui/kpi-cards"
import { usePaginatedList } from "@/components/ui/use-paginated-list"
import { TableSearchStatus } from "@/components/ui/table-search-status"
import { TablePaginationFooter } from "@/components/ui/table-pagination-footer"
import { SearchField } from "@/components/ui/search-field"
import { cn } from "@/lib/utils"
import {
  listMyServiceRequests,
  type ClientRequestsResponse,
  type ServiceRequestStatus,
  type ServiceRequestSummary,
} from "../api/client-services-api"
import { ClientRequestsTable } from "../components/client-requests-table"
import { ClientRequestDetails } from "../components/client-request-details"
import { serviceRequestStatuses } from "../model/service-request-status"

const initial: ClientRequestsResponse = {
  requests: [],
  total: 0,
  page: 1,
  pageSize: 10,
  summary: { total: 0, pending: 0, inProgress: 0, completed: 0, cancelled: 0 },
}

const statusOptions: { value: ServiceRequestStatus | ""; label: string }[] = [
  { value: "", label: "All Statuses" },
  ...Object.entries(serviceRequestStatuses).map(([value, item]) => ({
    value: value as ServiceRequestStatus,
    label: item.label,
  })),
]
const sortOptions: { value: "asc" | "desc"; label: string }[] = [
  { value: "desc", label: "Newest first" },
  { value: "asc", label: "Oldest first" },
]

function matchesTableSearch(item: ServiceRequestSummary, query: string) {
  return [
    item.title,
    item.referenceNumber,
    item.service.name,
    item.packageName,
    item.package?.name,
  ].some((value) => value?.toLowerCase().includes(query))
}

export function ClientServiceRequestsPage() {
  const [search, setSearch] = useState("")
  const query = search.trim()
  const [status, setStatus] = useState<ServiceRequestStatus | "">("")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [selected, setSelected] = useState<ServiceRequestSummary | null>(null)
  const filtered = Boolean(query || status)

  const list = usePaginatedList({
    params: { search: query, status, sortOrder },
    load: ({ page, signal }) =>
      listMyServiceRequests({ page, search: query, status, sortOrder, signal }),
    rows: (result) => result.requests,
    matches: matchesTableSearch,
    initial,
    refresh: "focus",
    viewKeyFrom: "request",
    fallbackError: "Could not load your service requests.",
    onLoaded: (result) =>
      setSelected((current) =>
        current
          ? (result.requests.find((item) => item.id === current.id) ?? null)
          : null,
      ),
  })
  const { setPage, retry } = list
  const summary = (list.data ?? initial).summary

  function clearFilters() {
    setSearch("")
    setStatus("")
    setPage(1)
  }
  const metrics = [
    {
      label: "Total Requests",
      value: summary.total,
      description: "All your service requests",
      icon: ClipboardList,
      iconClassName: "text-[#2058d4]",
    },
    {
      label: "Pending Review",
      value: summary.pending,
      description: "Awaiting department review",
      icon: Clock3,
      iconClassName: "text-[#b78112]",
    },
    {
      label: "In Review",
      value: summary.inProgress,
      description: "Review and quotation preparation",
      icon: LoaderCircle,
      iconClassName: "text-[#2058d4]",
    },
    {
      label: "Closed",
      value: summary.completed,
      description: "Closed service requests",
      icon: CheckCircle2,
      iconClassName: "text-[#159447]",
    },
  ]
  return (
    <main
      className={cn(contentClass, "p-[clamp(20px,2.1vw,32px)]")}
      aria-label="Booked requests"
    >
      <ClientPageHeader
        eyebrow="Service requests"
        title="Booked Requests"
        description="Track your requests, review project details, and follow their progress."
        actions={
          <Button asChild className={clientPageHeaderActionClass}>
            <Link href="/services">
              <Plus size={16} aria-hidden="true" />
              New Service Request
            </Link>
          </Button>
        }
      />
      <div className="mt-[clamp(30px,4vw,52px)]">
        <KpiCards
          metrics={metrics}
          label="Your request overview"
          pending={!list.hasLoaded}
          unavailable={Boolean(list.error)}
          showCharts={false}
          variant="blue"
          className="grid-cols-4 max-[1100px]:grid-cols-2 max-[480px]:grid-cols-1"
        />
      </div>
      <section className="@container mt-6 min-w-0" aria-label="Request history">
        <div className="flex flex-wrap items-center gap-2.5 pb-4 max-[560px]:flex-col max-[560px]:items-stretch">
          <SearchField
            label="Search service requests"
            placeholder="Search reference, service or package…"
            value={search}
            maxLength={100}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
          <FilterSelect
            label="Filter by request status"
            value={status}
            options={statusOptions}
            triggerClassName="w-[165px]"
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
          />
          <FilterSelect
            label="Sort service requests"
            value={sortOrder}
            options={sortOptions}
            triggerClassName="w-[160px]"
            onChange={(value) => {
              setSortOrder(value)
              setPage(1)
            }}
          />
          {Boolean(search || status) && (
            <Button
              variant="outline"
              className="h-[34px] text-xs max-[560px]:h-11"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          )}
        </div>
        {!list.hasLoaded ? (
          <ClientTableSkeleton
            label="your service requests"
            columns={6}
            gridClassName="grid grid-cols-[76px_minmax(180px,1.25fr)_minmax(180px,1.25fr)_minmax(120px,.8fr)_minmax(130px,.9fr)_140px] items-center gap-3.5"
          />
        ) : list.error ? (
          <div
            role="alert"
            className="grid min-h-64 place-content-center gap-4 rounded-lg border border-[#e1e4ea] p-6 text-center text-sm text-[#52627a]"
          >
            <p>{list.error}</p>
            <Button variant="outline" onClick={retry}>
              Try again
            </Button>
          </div>
        ) : (
          <ClientRequestsTable
            requests={list.rows}
            viewKey={list.tableViewKey}
            quickKey={query}
            onRowsSettled={list.onRowsSettled}
            emptyMessage={
              list.loading ? (
                "Searching requests…"
              ) : (
                <EmptyState
                  headingLevel={2}
                  icon={ClipboardList}
                  title={
                    filtered
                      ? "No matching requests"
                      : "No service requests yet"
                  }
                  description={
                    filtered
                      ? "Try a different search or status filter."
                      : "Explore our services and tell us what you need."
                  }
                  action={
                    <Button asChild variant="outline" className="text-xs">
                      <Link href="/services">Browse services</Link>
                    </Button>
                  }
                  className="border-0 p-0"
                />
              )
            }
            onView={(request) => {
              setSelected(request)
              retry()
            }}
            onCancelled={retry}
          />
        )}
        <TableSearchStatus
          active={list.loading && list.previewing}
          label="requests"
        />
        {list.footer && (
          <TablePaginationFooter
            {...list.footer}
            label="Service request pages"
            onPageChange={setPage}
            className="text-[#52627a]"
          />
        )}
      </section>
      {selected && (
        <ClientRequestDetails
          request={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  )
}
