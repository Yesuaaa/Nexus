"use client"

import Link from "next/link"
import { Plus, RefreshCw } from "lucide-react"
import { useState } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { FilterSelect, filterBarClass } from "@/components/ui/filter-select"
import { usePaginatedList } from "@/components/ui/use-paginated-list"
import { TableSearchStatus } from "@/components/ui/table-search-status"
import { TablePaginationFooter } from "@/components/ui/table-pagination-footer"
import { SearchField } from "@/components/ui/search-field"
import { SearchEmptyState } from "@/components/ui/search-empty-state"
import { cn } from "@/lib/utils"
import {
  listBookedServices,
  type BookedService,
  type BookingDetails,
} from "../api/bookings-api"
import { BookedServicesTable } from "../components/booked-services-table"
import { BookingDetailsDrawer } from "../components/booking-details-drawer"
import { bookingStatuses } from "../model/booking-status"

const statusOptions = [
  { value: "", label: "All Statuses" },
  ...Object.entries(bookingStatuses).map(([value, info]) => ({
    value,
    label: info.label,
  })),
]

function matchesTableSearch(item: BookedService, query: string) {
  return [
    item.title,
    item.referenceNumber,
    item.service.name,
    item.packageName,
  ].some((value) => value?.toLowerCase().includes(query))
}

export function BookedServicesPage({
  initialBookingId,
}: {
  initialBookingId: string | null
}) {
  const [search, setSearch] = useState("")
  const query = search.trim()
  const [status, setStatus] = useState("")
  const [detailsRefreshKey, setDetailsRefreshKey] = useState(0)
  const [selectedId, setSelectedId] = useState(initialBookingId)
  const filtered = Boolean(query || status)

  const list = usePaginatedList({
    params: { search: query, status },
    load: ({ page, signal }) =>
      listBookedServices({ search: query, status, page, signal }),
    rows: (result) => result.serviceRequests,
    matches: matchesTableSearch,
    initial: { serviceRequests: [], total: 0, page: 1, pageSize: 10 },
    refresh: "focus",
    fallbackError: "Couldn't load booked services.",
    // Keep an open drawer in step with every list refresh.
    onLoaded: () => setDetailsRefreshKey((key) => key + 1),
  })
  const { setPage, setData, retry } = list

  function syncBooking(booking: BookingDetails) {
    setData(
      (current) =>
        current && {
          ...current,
          serviceRequests: current.serviceRequests.map((item) =>
            item.id === booking.id ? { ...item, ...booking } : item,
          ),
        },
    )
  }
  function clearFilters() {
    setSearch("")
    setStatus("")
    setPage(1)
  }

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Booked services"
    >
      <PageHeader
        mobileActions="stack"
        headingId="booked-services-heading"
        tone="client"
        title="Booked Services"
        description="View your service requests, check their status, and review your booking details."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-[34px] gap-2 text-xs"
              disabled={list.loading}
              onClick={retry}
            >
              <RefreshCw size={14} aria-hidden="true" />
              Refresh
            </Button>
            <Button
              asChild
              variant="brand"
              className="h-[34px] text-xs max-[560px]:h-11"
            >
              <Link href="/services">
                <Plus size={16} aria-hidden="true" />
                Browse Services
              </Link>
            </Button>
          </>
        }
      />
      <section aria-label="Your booked services" className="mt-[18px] min-w-0">
        <div className={`${filterBarClass} pb-4`}>
          <SearchField
            label="Search booked services"
            placeholder="Search service, package or reference…"
            maxLength={100}
            value={search}
            containerClassName="max-[560px]:h-11"
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
          <FilterSelect
            label="Filter bookings by status"
            value={status}
            options={statusOptions}
            triggerClassName="w-[180px]"
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
          />
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
        <BookedServicesTable
          bookings={list.rows}
          viewKey={list.tableViewKey}
          onRowsSettled={list.onRowsSettled}
          quickKey={query}
          loading={list.loading}
          error={list.error}
          onRetry={retry}
          onView={(booking) => setSelectedId(booking.id)}
          emptyMessage={
            query ? (
              <SearchEmptyState query={query} />
            ) : filtered ? (
              "No booked services match the selected filters."
            ) : (
              "You haven't booked any services yet. Browse Services to get started."
            )
          }
        />
        <TableSearchStatus
          active={list.loading && list.previewing}
          label="booked services"
        />
        {list.footer && (
          <TablePaginationFooter
            {...list.footer}
            label="Booked service pages"
            onPageChange={setPage}
            className="text-[#52627a]"
          />
        )}
      </section>
      {selectedId && (
        <BookingDetailsDrawer
          onLoaded={syncBooking}
          refreshKey={detailsRefreshKey}
          key={selectedId}
          id={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </main>
  )
}
