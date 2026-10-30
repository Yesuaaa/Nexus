"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  LoaderCircle,
  Plus,
} from "lucide-react"
import { contentClass } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { KpiCards } from "@/components/ui/kpi-cards"
import { NumberedPagination } from "@/components/ui/numbered-pagination"
import { SearchField } from "@/components/ui/search-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

export function ClientServiceRequestsPage() {
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<ServiceRequestStatus | "">("")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState(initial)
  const [resolvedKey, setResolvedKey] = useState("")
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<ServiceRequestSummary | null>(null)
  const requestKey = JSON.stringify({
    page,
    query,
    status,
    sortOrder,
    revision,
  })
  const loading = requestKey !== resolvedKey || search.trim() !== query
  const filtered = Boolean(query || status)
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 150)
    return () => clearTimeout(timer)
  }, [search])
  useEffect(() => {
    let active = true
    listMyServiceRequests({ page, search: query, status, sortOrder })
      .then((data) => {
        if (!active) return
        const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize))
        if (page > lastPage) {
          setPage(lastPage)
          return
        }
        setResult(data)
        setError("")
        setResolvedKey(requestKey)
      })
      .catch((reason: unknown) => {
        if (!active) return
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load your service requests.",
        )
        setResolvedKey(requestKey)
      })
    return () => {
      active = false
    }
  }, [page, query, status, sortOrder, revision, requestKey])
  function clearFilters() {
    setSearch("")
    setQuery("")
    setStatus("")
    setPage(1)
  }
  const metrics = [
    {
      label: "Total Requests",
      value: result.summary.total,
      description: "All your service requests",
      icon: ClipboardList,
      iconClassName: "text-[#2058d4]",
    },
    {
      label: "Pending Review",
      value: result.summary.pending,
      description: "Awaiting department review",
      icon: Clock3,
      iconClassName: "text-[#b78112]",
    },
    {
      label: "In Review",
      value: result.summary.inProgress,
      description: "Review and quotation preparation",
      icon: LoaderCircle,
      iconClassName: "text-[#2058d4]",
    },
    {
      label: "Closed",
      value: result.summary.completed,
      description: "Closed service requests",
      icon: CheckCircle2,
      iconClassName: "text-[#159447]",
    },
  ]
  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="My service requests"
    >
      <header className="-mx-[clamp(16px,2.1vw,32px)] flex items-center justify-between gap-6 border-b border-[#eceef1] px-[clamp(16px,2.1vw,32px)] pt-0.5 pb-5 max-[560px]:flex-col max-[560px]:items-start max-[560px]:gap-4">
        <div>
          <h1 className="m-0 text-[clamp(21px,2vw,25px)] leading-[1.25] font-[650] tracking-[-0.03em]">
            Service Requests
          </h1>
          <p className="mt-[5px] mb-0 text-xs leading-[1.45] text-[#52627a]">
            Track your requests, review project details, and follow their
            progress.
          </p>
        </div>
        <Button
          asChild
          className="h-[34px] bg-[#203f8c] text-xs text-white hover:bg-[#172f70] max-[560px]:h-11"
        >
          <Link href="/services">
            <Plus size={16} aria-hidden="true" />
            New Service Request
          </Link>
        </Button>
      </header>
      <div className="mt-[18px]">
        <KpiCards
          metrics={metrics}
          label="Your request overview"
          pending={loading && !resolvedKey}
          unavailable={Boolean(error)}
          showCharts={false}
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
          <Select
            value={status || "all"}
            onValueChange={(value) => {
              setStatus(value === "all" ? "" : (value as ServiceRequestStatus))
              setPage(1)
            }}
          >
            <SelectTrigger
              aria-label="Filter by request status"
              className="h-[34px] w-[165px] border-[#e1e4ea] text-xs max-[560px]:h-11 max-[560px]:w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(serviceRequestStatuses).map(([value, item]) => (
                <SelectItem key={value} value={value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sortOrder}
            onValueChange={(value) => {
              setSortOrder(value as "asc" | "desc")
              setPage(1)
            }}
          >
            <SelectTrigger
              aria-label="Sort service requests"
              className="h-[34px] w-[160px] text-xs max-[560px]:h-11 max-[560px]:w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Newest first</SelectItem>
              <SelectItem value="asc">Oldest first</SelectItem>
            </SelectContent>
          </Select>
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
        {loading ? (
          <div
            role="status"
            className="grid min-h-64 place-items-center rounded-lg border border-[#e1e4ea] text-xs text-[#52627a]"
          >
            Loading your service requests…
          </div>
        ) : error ? (
          <div
            role="alert"
            className="grid min-h-64 place-content-center gap-4 rounded-lg border border-[#e1e4ea] p-6 text-center text-sm text-[#52627a]"
          >
            <p>{error}</p>
            <Button
              variant="outline"
              onClick={() => setRevision((value) => value + 1)}
            >
              Try again
            </Button>
          </div>
        ) : result.requests.length ? (
          <ClientRequestsTable
            requests={result.requests}
            onView={setSelected}
          />
        ) : (
          <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-[#d7e0ee] p-6 text-center">
            <div>
              <ClipboardList
                size={28}
                className="mx-auto mb-3 text-[#8a9ab3]"
                aria-hidden="true"
              />
              <h2 className="m-0 text-sm font-semibold">
                {filtered ? "No matching requests" : "No service requests yet"}
              </h2>
              <p className="mt-2 text-xs text-[#52627a]">
                {filtered
                  ? "Try a different search or status filter."
                  : "Explore our services and tell us what you need."}
              </p>
              <Button asChild variant="outline" className="mt-2 text-xs">
                <Link href="/services">Browse services</Link>
              </Button>
            </div>
          </div>
        )}
        {!loading && !error && result.total > 0 && (
          <footer className="flex flex-wrap items-center justify-between gap-3 pt-4 text-[11px] text-[#52627a]">
            <span role="status">
              Showing {(result.page - 1) * result.pageSize + 1}–
              {(result.page - 1) * result.pageSize + result.requests.length} of{" "}
              {result.total}
            </span>
            <NumberedPagination
              page={result.page}
              totalPages={Math.max(
                1,
                Math.ceil(result.total / result.pageSize),
              )}
              label="Service request pages"
              onPageChange={setPage}
            />
          </footer>
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
