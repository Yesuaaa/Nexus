"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { contentClass } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { NumberedPagination } from "@/components/ui/numbered-pagination"
import { SearchField } from "@/components/ui/search-field"
import { SearchEmptyState } from "@/components/ui/search-empty-state"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { listBookedServices, type BookingList } from "../api/bookings-api"
import { BookedServicesTable } from "../components/booked-services-table"
import { BookingDetailsDrawer } from "../components/booking-details-drawer"
import { bookingStatuses } from "../model/booking-status"

export function BookedServicesPage({
  initialBookingId,
}: {
  initialBookingId: string | null
}) {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [selectedId, setSelectedId] = useState(initialBookingId)
  const [result, setResult] = useState<BookingList>({
    serviceRequests: [],
    total: 0,
    page: 1,
    pageSize: 10,
  })
  const [error, setError] = useState("")
  const [resolvedKey, setResolvedKey] = useState("")
  const [resolvedViewKey, setResolvedViewKey] = useState("")
  const viewKey = JSON.stringify({ search: debouncedSearch, status, page })
  const requestKey = JSON.stringify({ viewKey, revision })
  const loading =
    resolvedKey !== requestKey || search.trim() !== debouncedSearch
  const filtered = Boolean(search.trim() || status)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 150)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let active = true
    listBookedServices({ search: debouncedSearch, status, page })
      .then((value) => {
        if (!active) return
        const lastPage = Math.max(1, Math.ceil(value.total / value.pageSize))
        if (page > lastPage) {
          setPage(lastPage)
          return
        }
        setResult(value)
        setError("")
        setResolvedKey(requestKey)
        setResolvedViewKey(viewKey)
      })
      .catch((reason: unknown) => {
        if (!active) return
        setError(
          reason instanceof Error
            ? reason.message
            : "Couldn't load booked services.",
        )
        setResolvedKey(requestKey)
      })
    return () => {
      active = false
    }
  }, [debouncedSearch, status, page, revision, requestKey, viewKey])

  function clearFilters() {
    setSearch("")
    setDebouncedSearch("")
    setStatus("")
    setPage(1)
  }
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize))
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1
  const to = (result.page - 1) * result.pageSize + result.serviceRequests.length

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Booked services"
    >
      <header className="-mx-[clamp(16px,2.1vw,32px)] flex items-center justify-between gap-6 border-b border-[#eceef1] px-[clamp(16px,2.1vw,32px)] pt-0.5 pb-5 max-[560px]:flex-col max-[560px]:items-start max-[560px]:gap-4">
        <div>
          <h1
            id="booked-services-heading"
            tabIndex={-1}
            className="m-0 text-[clamp(21px,2vw,25px)] leading-[1.25] font-[650] tracking-[-0.03em]"
          >
            Booked Services
          </h1>
          <p className="mt-[5px] mb-0 text-xs leading-[1.45] text-[#52627a]">
            View your service requests, check their status, and review your
            booking details.
          </p>
        </div>
        <Button
          asChild
          className="h-[34px] bg-[#203f8c] text-xs text-white hover:bg-[#172f70] max-[560px]:h-11"
        >
          <Link href="/services">
            <Plus size={16} aria-hidden="true" />
            Browse Services
          </Link>
        </Button>
      </header>
      <section aria-label="Your booked services" className="mt-[18px] min-w-0">
        <div className="flex flex-wrap items-center gap-2.5 pb-4 max-[560px]:flex-col max-[560px]:items-stretch">
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
          <Select
            value={status || "all"}
            onValueChange={(value) => {
              setStatus(value === "all" ? "" : value)
              setPage(1)
            }}
          >
            <SelectTrigger
              aria-label="Filter bookings by status"
              className="h-[34px] w-[180px] border-[#e1e4ea] text-xs max-[560px]:h-11 max-[560px]:w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(bookingStatuses).map(([value, info]) => (
                <SelectItem key={value} value={value}>
                  {info.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          bookings={result.serviceRequests}
          viewKey={resolvedViewKey}
          quickKey={debouncedSearch}
          loading={loading}
          error={error}
          onRetry={() => setRevision((value) => value + 1)}
          onView={(booking) => setSelectedId(booking.id)}
          emptyMessage={
            debouncedSearch ? (
              <SearchEmptyState query={debouncedSearch} />
            ) : filtered ? (
              "No booked services match the selected filters."
            ) : (
              "You haven't booked any services yet. Browse Services to get started."
            )
          }
        />
        {!error && result.total > 0 && (
          <footer className="flex flex-wrap items-center justify-between gap-3 pt-4 text-[11px] text-[#52627a]">
            <span role="status" aria-live="polite" aria-atomic="true">
              Showing {from}–{to} of {result.total}
            </span>
            <NumberedPagination
              page={result.page}
              totalPages={pages}
              disabled={loading}
              label="Booked service pages"
              onPageChange={setPage}
            />
          </footer>
        )}
      </section>
      {selectedId && (
        <BookingDetailsDrawer
          key={selectedId}
          id={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </main>
  )
}
