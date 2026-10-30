"use client"

import { useEffect, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"
import { sileo } from "sileo"
import { contentClass } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { NumberedPagination } from "@/components/ui/numbered-pagination"
import { SearchField } from "@/components/ui/search-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { ApiError } from "@/features/auth/api/auth-api"
import { BookingDetailsDrawer } from "@/features/bookings/components/booking-details-drawer"
import { cn } from "@/lib/utils"
import {
  acceptInboxRequest,
  getInboxRequest,
  listInbox,
  type InboxList,
  type InboxRequest,
  type InboxView,
} from "../api/request-inbox-api"
import { RequestInboxTable } from "../components/request-inbox-table"

export function RequestInboxPage() {
  const account = usePortalAccount()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [view, setView] = useState<InboxView>("pending")
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState<InboxRequest | null>(null)
  const [accepting, setAccepting] = useState(false)
  const acceptingRef = useRef(false)
  const [acceptError, setAcceptError] = useState("")
  const [detailsRevision, setDetailsRevision] = useState(0)
  const [result, setResult] = useState<InboxList | null>(null)
  const [error, setError] = useState("")
  const [resolvedKey, setResolvedKey] = useState("")
  const [resolvedViewKey, setResolvedViewKey] = useState("")
  const viewKey = JSON.stringify({ search: debouncedSearch, view, page })
  const requestKey = `${viewKey}:${revision}`
  const loading =
    resolvedKey !== requestKey || search.trim() !== debouncedSearch

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 150)
    return () => clearTimeout(timer)
  }, [search])
  useEffect(() => {
    let active = true
    listInbox({ search: debouncedSearch, view, page })
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
          reason instanceof Error ? reason.message : "Couldn't load requests.",
        )
        setResolvedKey(requestKey)
      })
    return () => {
      active = false
    }
  }, [debouncedSearch, view, page, revision, requestKey, viewKey])

  async function accept(id: string) {
    if (acceptingRef.current) return
    acceptingRef.current = true
    setAccepting(true)
    setAcceptError("")
    try {
      await acceptInboxRequest(id)
      setSelected(null)
      setRevision((value) => value + 1)
      sileo.success({
        title: "Request accepted",
        description: "The booking is now under review.",
      })
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Couldn't accept this request. Try again."
      setAcceptError(message)
      sileo.error({ title: "Couldn't accept request", description: message })
      if (
        reason instanceof ApiError &&
        (reason.status === 409 ||
          reason.status === 404 ||
          reason.status === 403)
      ) {
        setRevision((value) => value + 1)
        setDetailsRevision((value) => value + 1)
      }
    } finally {
      acceptingRef.current = false
      setAccepting(false)
    }
  }

  const from = !result?.total ? 0 : (result.page - 1) * result.pageSize + 1
  const to = result
    ? (result.page - 1) * result.pageSize + result.serviceRequests.length
    : 0
  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Request inbox"
    >
      <header className="-mx-[clamp(16px,2.1vw,32px)] flex items-center justify-between gap-5 border-b border-[#eceef1] px-[clamp(16px,2.1vw,32px)] pt-0.5 pb-5 max-[560px]:items-start">
        <div className="min-w-0">
          <h1
            id="request-inbox-heading"
            tabIndex={-1}
            className="m-0 text-[clamp(21px,2vw,25px)] leading-[1.25] font-[650] tracking-[-0.03em]"
          >
            Request Inbox
          </h1>
          <p className="mt-[5px] mb-0 text-xs leading-[1.45] text-[#52627a]">
            Review and accept booked services for{" "}
            {result?.department.name ??
              account.headOf?.name ??
              "your department"}
            .
          </p>
        </div>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => setRevision((value) => value + 1)}
          className="h-[34px] flex-none text-xs max-[560px]:h-11"
        >
          <RefreshCw size={14} aria-hidden="true" />
          Refresh
        </Button>
      </header>
      <section aria-label="Department bookings" className="mt-[18px] min-w-0">
        <div className="flex flex-wrap items-center gap-2.5 pb-4 max-[560px]:flex-col max-[560px]:items-stretch">
          <SearchField
            label="Search requests"
            placeholder="Search service, client or reference…"
            value={search}
            maxLength={100}
            containerClassName="max-[560px]:h-11"
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
          <Select
            value={view}
            onValueChange={(value) => {
              setView(value as InboxView)
              setPage(1)
            }}
          >
            <SelectTrigger
              aria-label="Filter requests"
              className="h-[34px] w-[185px] border-[#e1e4ea] text-xs max-[560px]:h-11 max-[560px]:w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Awaiting acceptance</SelectItem>
              <SelectItem value="under-review">Under review</SelectItem>
            </SelectContent>
          </Select>
          {search && (
            <Button
              variant="outline"
              className="h-[34px] text-xs max-[560px]:h-11"
              onClick={() => {
                setSearch("")
                setDebouncedSearch("")
                setPage(1)
              }}
            >
              Clear search
            </Button>
          )}
        </div>
        <RequestInboxTable
          requests={result?.serviceRequests ?? []}
          loading={loading}
          error={error}
          viewKey={resolvedViewKey}
          quickKey={debouncedSearch}
          onRetry={() => setRevision((value) => value + 1)}
          onView={(request) => {
            setSelected(request)
            setAcceptError("")
          }}
        />
        {!error && !!result?.total && (
          <footer className="flex flex-wrap items-center justify-between gap-3 pt-4 text-[11px] text-[#52627a]">
            <span role="status" aria-live="polite" aria-atomic="true">
              Showing {from}–{to} of {result.total}
            </span>
            <NumberedPagination
              page={result.page}
              totalPages={Math.max(
                1,
                Math.ceil(result.total / result.pageSize),
              )}
              disabled={loading}
              label="Request inbox pages"
              onPageChange={setPage}
            />
          </footer>
        )}
      </section>
      {selected && (
        <BookingDetailsDrawer
          key={selected.id}
          id={selected.id}
          loadDetails={getInboxRequest}
          closeDisabled={accepting}
          onClose={() => setSelected(null)}
          description="Review the client's booking before accepting it for department review."
          fallbackFocusId="request-inbox-heading"
          refreshKey={detailsRevision}
          additionalFields={[
            ["Client", selected.client.fullName || "Client"],
            ["Email", selected.client.email],
            ["Contact number", selected.client.contactNumber || "Not provided"],
          ]}
          renderActions={(details) => (
            <div>
              {acceptError && (
                <p role="alert" className="mt-0 mb-3 text-xs text-red-700">
                  {acceptError}
                </p>
              )}
              {details.status === "PENDING" ||
              details.status === "SUBMITTED" ? (
                <>
                  <p className="mt-0 mb-3 text-xs leading-relaxed text-[#52627a]">
                    Accepting moves this booking to Under review. The client
                    will see the updated status.
                  </p>
                  <Button
                    className="w-full bg-[#203f8c] text-white hover:bg-[#172f70]"
                    disabled={accepting}
                    onClick={() => void accept(details.id)}
                  >
                    {accepting ? "Accepting…" : "Accept request"}
                  </Button>
                </>
              ) : (
                <p className="m-0 text-xs text-[#52627a]">
                  This booking is no longer awaiting acceptance.
                </p>
              )}
            </div>
          )}
        />
      )}
    </main>
  )
}
