"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { PanelLoading, SidePanelLoading } from "@/components/ui/panel-loading"
import { Plus } from "lucide-react"
import { sileo } from "@/lib/toast"
import { contentClass } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import {
  useTableSearch,
  useTableFooter,
} from "@/components/ui/use-table-search"
import { TableSearchStatus } from "@/components/ui/table-search-status"
import { NumberedPagination } from "@/components/ui/numbered-pagination"
import { SearchEmptyState } from "@/components/ui/search-empty-state"
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
  listClients,
  type ClientList,
  type ClientSort,
  type ClientStatus,
  type Client,
} from "../api/clients-api"
import { ClientTable } from "../components/client-table"
import type { ClientDetailsTab } from "../components/client-details-drawer"

const ClientFormDialog = dynamic(
  () =>
    import("../components/client-form-dialog").then(
      (module) => module.ClientFormDialog,
    ),
  { loading: PanelLoading },
)
const ClientDetailsDrawer = dynamic(
  () =>
    import("../components/client-details-drawer").then(
      (module) => module.ClientDetailsDrawer,
    ),
  { loading: () => <SidePanelLoading /> },
)

const sortOptions: { value: string; label: string }[] = [
  { value: "createdAt:desc", label: "Newest registered" },
  { value: "createdAt:asc", label: "Oldest registered" },
  { value: "fullName:asc", label: "Name: A to Z" },
  { value: "fullName:desc", label: "Name: Z to A" },
  { value: "email:asc", label: "Email: A to Z" },
  { value: "email:desc", label: "Email: Z to A" },
  { value: "isActive:desc", label: "Active first" },
  { value: "isActive:asc", label: "Inactive first" },
]

function matchesTableSearch(item: Client, query: string) {
  return [item.fullName, item.email].some((value) =>
    value?.toLowerCase().includes(query),
  )
}

export function ClientManagementPage() {
  const [formTarget, setFormTarget] = useState<Client | "create" | null>(null)
  const [selectedClient, setSelectedClient] = useState<{
    client: Client
    tab: ClientDetailsTab
  } | null>(null)
  const [search, setSearch] = useState("")
  const query = search.trim()
  const [status, setStatus] = useState<ClientStatus>("")
  const [page, setPage] = useState(1)
  const [animateRows, setAnimateRows] = useState(true)
  const [sortBy, setSortBy] = useState<ClientSort>("createdAt")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<ClientList>({
    clients: [],
    total: 0,
    page: 1,
    pageSize: 10,
  })
  const [resolvedKey, setResolvedKey] = useState("")
  const [resolvedViewKey, setResolvedViewKey] = useState("")
  const [errorMessage, setError] = useState("")
  const [errorRequestKey, setErrorRequestKey] = useState("")
  const requestKey = JSON.stringify({
    search: query,
    status,
    page,
    sortBy,
    sortOrder,
    revision,
  })
  const viewKey = JSON.stringify({
    search: query,
    status,
    page,
    sortBy,
    sortOrder,
  })
  const error = errorRequestKey === requestKey ? errorMessage : ""
  const loading = resolvedKey !== requestKey || search.trim() !== query
  const filtered = Boolean(search.trim() || status)

  const searchScope = JSON.stringify([status, sortBy, sortOrder, revision])
  const { acceptRows, preview, previewing } = useTableSearch<Client>({
    search: query,
    scope: searchScope,
    page,
    matches: matchesTableSearch,
  })
  const { footer, onRowsSettled } = useTableFooter(
    result,
    loading || previewing,
  )
  const tableViewKey = previewing
    ? JSON.stringify([searchScope, query, 1])
    : resolvedViewKey

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    listClients({
      search: query,
      status,
      page,
      sortBy,
      sortOrder,
      signal: controller.signal,
    })
      .then((data) => {
        if (!active) return
        const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize))
        if (page > lastPage) {
          setPage(lastPage)
          return
        }
        acceptRows(data.clients)
        setResult(data)
        setError("")
        setResolvedKey(requestKey)
        setResolvedViewKey(viewKey)
      })
      .catch((reason: unknown) => {
        if (!active) return
        setErrorRequestKey(requestKey)
        setError(
          reason instanceof Error ? reason.message : "Could not load clients.",
        )
        setResolvedKey(requestKey)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [
    query,
    status,
    page,
    sortBy,
    sortOrder,
    revision,
    requestKey,
    viewKey,
    acceptRows,
  ])

  function sort(key: ClientSort) {
    setAnimateRows(true)
    setSortOrder(sortBy === key && sortOrder === "asc" ? "desc" : "asc")
    setSortBy(key)
    setPage(1)
  }
  function clearFilters() {
    setAnimateRows(true)
    setSearch("")
    setStatus("")
    setPage(1)
  }
  const pages = Math.max(1, Math.ceil(footer.total / footer.pageSize))
  const from = footer.total === 0 ? 0 : (footer.page - 1) * footer.pageSize + 1
  const to = (footer.page - 1) * footer.pageSize + footer.clients.length

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Client management"
    >
      <header className="-mx-[clamp(16px,2.1vw,32px)] flex items-center justify-between gap-6 border-b border-[#eceef1] px-[clamp(16px,2.1vw,32px)] pt-0.5 pb-5 max-[560px]:flex-col max-[560px]:items-start max-[560px]:gap-4 max-[560px]:pb-[18px]">
        <div>
          <h1
            id="client-directory-heading"
            tabIndex={-1}
            className="m-0 text-[clamp(21px,2vw,25px)] leading-[1.25] font-[650] tracking-[-0.03em] text-foreground"
          >
            Client Management
          </h1>
          <p className="mt-[5px] mb-0 text-xs leading-[1.45] text-[#738096]">
            Create and manage client accounts and contact information.
          </p>
        </div>
        <Button
          onClick={() => setFormTarget("create")}
          className="h-[34px] bg-[#203f8c] text-xs text-white hover:bg-[#172f70]"
        >
          <Plus size={16} aria-hidden="true" />
          Create Client
        </Button>
      </header>
      <section
        aria-label="Client directory"
        className="@container mt-[18px] min-w-0 max-[767px]:mt-[14px]"
      >
        <div className="flex flex-wrap items-center gap-2.5 pb-4 max-[560px]:flex-col max-[560px]:items-stretch">
          <SearchField
            label="Search clients"
            value={search}
            maxLength={100}
            onChange={(event) => {
              setAnimateRows(true)
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search name or email…"
          />
          <Select
            value={status || "all"}
            onValueChange={(value) => {
              setAnimateRows(true)
              setStatus(value === "all" ? "" : (value as ClientStatus))
              setPage(1)
            }}
          >
            <SelectTrigger
              aria-label="Filter by account status"
              className="h-[34px] w-[135px] flex-none border-[#e1e4ea] text-xs max-[560px]:w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <div className="hidden @max-[1000px]:block">
            <Select
              value={`${sortBy}:${sortOrder}`}
              onValueChange={(value) => {
                setAnimateRows(true)
                const [key, order] = value.split(":")
                setSortBy(key as ClientSort)
                setSortOrder(order as "asc" | "desc")
                setPage(1)
              }}
            >
              <SelectTrigger
                aria-label="Sort clients"
                className="h-[34px] w-[180px] text-xs max-[560px]:w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filtered && (
            <Button
              variant="outline"
              onClick={clearFilters}
              className="h-[34px] text-xs text-[#244993]"
            >
              Clear filters
            </Button>
          )}
        </div>
        <ClientTable
          clients={preview ?? result.clients}
          viewKey={tableViewKey}
          onRowsSettled={onRowsSettled}
          quickKey={query}
          animateRows={animateRows}
          loading={loading}
          error={error}
          emptyMessage={
            query ? (
              <SearchEmptyState query={query} />
            ) : filtered ? (
              "No clients match the selected filters."
            ) : (
              "No clients registered yet."
            )
          }
          sortBy={sortBy}
          sortOrder={sortOrder}
          onRetry={() => setRevision((value) => value + 1)}
          onSort={sort}
          onView={(client) => setSelectedClient({ client, tab: "overview" })}
        />
        <TableSearchStatus active={loading && previewing} label="clients" />
        {!error && !previewing && footer.total > 0 && (
          <footer className="flex flex-wrap items-center justify-between gap-3 pt-4 text-[11px] text-[#738096]">
            <span role="status" aria-live="polite" aria-atomic="true">
              Showing {from}–{to} of {footer.total}
            </span>
            <NumberedPagination
              page={footer.page}
              totalPages={pages}
              disabled={loading || footer !== result}
              label="Client pages"
              onPageChange={(nextPage) => {
                setAnimateRows(true)
                setPage(nextPage)
              }}
            />
          </footer>
        )}
      </section>
      {formTarget && (
        <ClientFormDialog
          client={formTarget === "create" ? null : formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            sileo.success({
              title:
                formTarget === "create" ? "Client created" : "Client updated",
              description: "Client information was saved successfully.",
            })
            setFormTarget(null)
            setRevision((value) => value + 1)
          }}
        />
      )}
      {selectedClient && (
        <ClientDetailsDrawer
          key={selectedClient.client.id}
          client={selectedClient.client}
          initialTab={selectedClient.tab}
          onClose={() => setSelectedClient(null)}
        />
      )}
    </main>
  )
}
