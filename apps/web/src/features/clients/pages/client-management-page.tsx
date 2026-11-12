"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { PanelLoading, SidePanelLoading } from "@/components/ui/panel-loading"
import { Plus } from "lucide-react"
import { sileo } from "@/lib/toast"
import { PageHeader, PageHeaderButton } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { FilterSelect } from "@/components/ui/filter-select"
import { usePaginatedList } from "@/components/ui/use-paginated-list"
import { TableSearchStatus } from "@/components/ui/table-search-status"
import { TablePaginationFooter } from "@/components/ui/table-pagination-footer"
import { SearchEmptyState } from "@/components/ui/search-empty-state"
import { SearchField } from "@/components/ui/search-field"
import { cn } from "@/lib/utils"
import {
  listClients,
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

const statusOptions: { value: ClientStatus; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
]

const sortOptions: {
  value: `${ClientSort}:${"asc" | "desc"}`
  label: string
}[] = [
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
  const [animateRows, setAnimateRows] = useState(true)
  const [sortBy, setSortBy] = useState<ClientSort>("createdAt")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const filtered = Boolean(query || status)

  const list = usePaginatedList({
    params: { search: query, status, sortBy, sortOrder },
    load: ({ page, signal }) =>
      listClients({ search: query, status, page, sortBy, sortOrder, signal }),
    rows: (result) => result.clients,
    matches: matchesTableSearch,
    initial: { clients: [], total: 0, page: 1, pageSize: 10 },
    fallbackError: "Could not load clients.",
  })
  const { setPage } = list

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

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Client management"
    >
      <PageHeader
        headingId="client-directory-heading"
        title="Client Management"
        description="Create and manage client accounts and contact information."
        actions={
          <PageHeaderButton
            type="button"
            onClick={() => setFormTarget("create")}
          >
            <Plus size={16} aria-hidden="true" />
            Create Client
          </PageHeaderButton>
        }
      />
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
          <FilterSelect
            label="Filter by account status"
            value={status}
            options={statusOptions}
            triggerClassName="w-[135px]"
            onChange={(value) => {
              setAnimateRows(true)
              setStatus(value)
              setPage(1)
            }}
          />
          <div className="hidden @max-[1000px]:block max-[560px]:w-full">
            <FilterSelect
              label="Sort clients"
              value={`${sortBy}:${sortOrder}`}
              options={sortOptions}
              triggerClassName="w-[180px]"
              onChange={(value) => {
                setAnimateRows(true)
                const [key, order] = value.split(":")
                setSortBy(key as ClientSort)
                setSortOrder(order as "asc" | "desc")
                setPage(1)
              }}
            />
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
          clients={list.rows}
          viewKey={list.tableViewKey}
          onRowsSettled={list.onRowsSettled}
          quickKey={query}
          animateRows={animateRows}
          loading={list.loading}
          error={list.error}
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
          onRetry={list.retry}
          onSort={sort}
          onView={(client) => setSelectedClient({ client, tab: "overview" })}
        />
        <TableSearchStatus
          active={list.loading && list.previewing}
          label="clients"
        />
        {list.footer && (
          <TablePaginationFooter
            {...list.footer}
            label="Client pages"
            onPageChange={(nextPage) => {
              setAnimateRows(true)
              setPage(nextPage)
            }}
          />
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
            list.retry()
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
