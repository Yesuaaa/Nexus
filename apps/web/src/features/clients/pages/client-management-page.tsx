"use client"

import { useEffect, useState } from "react"
import { SearchIcon } from "@/components/layout/icons"
import { contentClass } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NumberedPagination } from "@/components/ui/numbered-pagination"
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
import {
  ClientDetailsDrawer,
  type ClientDetailsTab,
} from "../components/client-details-drawer"

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

export function ClientManagementPage() {
  const [selectedClient, setSelectedClient] = useState<{
    client: Client
    tab: ClientDetailsTab
  } | null>(null)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [status, setStatus] = useState<ClientStatus>("")
  const [page, setPage] = useState(1)
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
  const [error, setError] = useState("")
  const requestKey = JSON.stringify({
    search: debouncedSearch,
    status,
    page,
    sortBy,
    sortOrder,
    revision,
  })
  const viewKey = JSON.stringify({
    search: debouncedSearch,
    status,
    page,
    sortBy,
    sortOrder,
  })
  const loading =
    resolvedKey !== requestKey || search.trim() !== debouncedSearch
  const filtered = Boolean(search.trim() || status)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 150)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let active = true
    listClients({ search: debouncedSearch, status, page, sortBy, sortOrder })
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
        setResolvedViewKey(viewKey)
      })
      .catch((reason: unknown) => {
        if (!active) return
        setError(
          reason instanceof Error ? reason.message : "Could not load clients.",
        )
        setResolvedKey(requestKey)
      })
    return () => {
      active = false
    }
  }, [debouncedSearch, status, page, sortBy, sortOrder, revision, requestKey, viewKey])

  function sort(key: ClientSort) {
    setSortOrder(sortBy === key && sortOrder === "asc" ? "desc" : "asc")
    setSortBy(key)
    setPage(1)
  }
  function clearFilters() {
    setSearch("")
    setDebouncedSearch("")
    setStatus("")
    setPage(1)
  }
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize))
  const from =
    result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1
  const to = (result.page - 1) * result.pageSize + result.clients.length

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Client management"
    >
      <header className="-mx-[clamp(16px,2.1vw,32px)] border-b border-[#eceef1] px-[clamp(16px,2.1vw,32px)] pt-0.5 pb-5">
        <h1
          id="client-directory-heading"
          tabIndex={-1}
          className="m-0 text-[clamp(21px,2vw,25px)] leading-[1.25] font-[650] tracking-[-0.03em]"
        >
          Client Management
        </h1>
        <p className="mt-[5px] mb-0 text-xs leading-[1.45] text-[#52627a]">
          View registered clients and account information.
        </p>
      </header>
      <section
        aria-label="Client directory"
        className="@container mt-[18px] min-w-0"
      >
        <div className="flex flex-wrap items-center gap-2.5 pb-4 max-[560px]:flex-col max-[560px]:items-stretch">
          <label
            className={`flex h-[34px] w-[260px] min-w-0 items-center gap-2 rounded-lg border border-[#e1e4ea] px-[11px] text-[#52627a] focus-within:outline-2 focus-within:outline-[#294a9b] max-[560px]:h-11 max-[560px]:w-full`}
          >
            <SearchIcon width="17" height="17" className="flex-none" />
            <span className="sr-only">Search clients</span>
            <Input
              type="search"
              value={search}
              maxLength={100}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search name or email..."
              className="h-auto min-w-0 border-0 bg-transparent p-0 text-xs shadow-none placeholder:text-[#52627a] focus-visible:ring-0 md:text-xs"
            />
          </label>
          <Select
            value={status || "all"}
            onValueChange={(value) => {
              setStatus(value === "all" ? "" : (value as ClientStatus))
              setPage(1)
            }}
          >
            <SelectTrigger
              aria-label="Filter by account status"
              className="h-[34px] w-[150px] border-[#e1e4ea] text-xs max-[560px]:h-11 max-[560px]:w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <div className="hidden @max-[800px]:block">
            <Select
              value={`${sortBy}:${sortOrder}`}
              onValueChange={(value) => {
                const [key, order] = value.split(":")
                setSortBy(key as ClientSort)
                setSortOrder(order as "asc" | "desc")
                setPage(1)
              }}
            >
              <SelectTrigger
                aria-label="Sort clients"
                className="h-[34px] w-[180px] text-xs max-[560px]:h-11 max-[560px]:w-full"
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
              className="h-[34px] text-xs text-[#244993] max-[560px]:h-11"
            >
              Clear filters
            </Button>
          )}
        </div>
        <div aria-busy={loading}>
          {error || resolvedKey === "" ? (
            <div className="grid min-h-[180px] place-content-center gap-3 rounded-lg border border-[#e8ebef] p-6 text-center text-xs text-[#52627a]">
              {error ? (
                <div role="alert" className="grid justify-items-center gap-3">
                  <p>{error}</p>
                  <Button
                    variant="outline"
                    onClick={() => setRevision((value) => value + 1)}
                    className="text-xs text-[#244993]"
                  >
                    Try again
                  </Button>
                </div>
              ) : (
                <p role="status">Loading clients...</p>
              )}
            </div>
          ) : (
            <ClientTable
              clients={result.clients}
              viewKey={resolvedViewKey}
              emptyMessage={
                filtered
                  ? "No clients match your search or filters."
                  : "No clients registered yet."
              }
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={sort}
              onView={(client) =>
                setSelectedClient({ client, tab: "overview" })
              }
            />
          )}
        </div>
        {!error && result.total > 0 && (
          <footer className="flex flex-wrap items-center justify-between gap-3 pt-4 text-[11px] text-[#52627a]">
            <span role="status" aria-live="polite" aria-atomic="true">
              Showing {from}–{to} of {result.total}
            </span>
            <NumberedPagination
              page={result.page}
              totalPages={pages}
              disabled={loading}
              label="Client pages"
              onPageChange={setPage}
            />
          </footer>
        )}
      </section>
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
