"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { sileo } from "@/lib/toast"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { FilterSelect } from "@/components/ui/filter-select"
import { usePaginatedList } from "@/components/ui/use-paginated-list"
import { TableSearchStatus } from "@/components/ui/table-search-status"
import { TablePaginationFooter } from "@/components/ui/table-pagination-footer"
import { SearchField } from "@/components/ui/search-field"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { ApiError } from "@/features/auth/api/auth-api"
import { BookingDetailsDrawer } from "@/features/bookings/components/booking-details-drawer"
import { getConversation } from "@/features/request-conversations/api/request-conversations-api"
import { cn } from "@/lib/utils"
import {
  acceptInboxRequest,
  declineInboxRequest,
  deleteInboxRequest,
  getInboxRequest,
  listInbox,
  type InboxRequest,
  type InboxView,
  type InboxSort,
} from "../api/request-inbox-api"
import { RequestInboxTable } from "../components/request-inbox-table"
import { errorMessage } from "@/lib/error-message"

type ConfirmAction = { kind: "decline" | "delete"; request: InboxRequest }

const viewOptions: { value: InboxView; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Awaiting acceptance" },
  { value: "under-review", label: "Under review" },
  { value: "awaiting-information", label: "Awaiting information" },
  { value: "ready-for-quotation", label: "Ready for quotation" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
]

function matchesTableSearch(item: InboxRequest, query: string) {
  return [
    item.title,
    item.referenceNumber,
    item.service.name,
    item.client.fullName,
    item.client.email,
  ].some((value) => value?.toLowerCase().includes(query))
}

export function RequestInboxPage() {
  const router = useRouter()
  const account = usePortalAccount()
  const [search, setSearch] = useState("")
  const query = search.trim()
  const [view, setView] = useState<InboxView>("pending")
  const [sortBy, setSortBy] = useState<InboxSort>("createdAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [selected, setSelected] = useState<InboxRequest | null>(null)
  const [accepting, setAccepting] = useState(false)
  const acceptingRef = useRef(false)
  const [acceptError, setAcceptError] = useState("")
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null)
  const [confirming, setConfirming] = useState(false)
  const confirmingRef = useRef(false)
  const [detailsRevision, setDetailsRevision] = useState(0)
  const list = usePaginatedList({
    params: { search: query, view, sortBy, sortDir },
    load: ({ page, signal }) =>
      listInbox({ search: query, view, page, sortBy, sortDir, signal }),
    rows: (result) => result.serviceRequests,
    matches: matchesTableSearch,
    initial: null,
    refresh: "poll",
    fallbackError: "Couldn't load requests.",
  })
  const { setPage, retry: refresh } = list

  async function goToChat(request: InboxRequest) {
    if (
      !request.acceptedDepartmentId ||
      request.acceptedDepartmentId !== account.headOf?.id
    ) {
      sileo.error({
        title: "Conversation unavailable",
        description:
          "Accept this request for your department before opening its conversation.",
      })
      return
    }
    try {
      const conversation = await getConversation(request.id)
      if (!conversation.conversation)
        throw new Error("This request's conversation is not available yet.")
      router.push(`/messages?request=${encodeURIComponent(request.id)}`)
    } catch (reason) {
      sileo.error({
        title: "Conversation unavailable",
        description: errorMessage(
          reason,
          "Couldn't open this request's conversation. Try again.",
        ),
      })
    }
  }

  async function accept(id: string) {
    if (acceptingRef.current) return
    acceptingRef.current = true
    setAccepting(true)
    setAcceptError("")
    try {
      const accepted = await acceptInboxRequest(id)
      setSelected(accepted)
      setDetailsRevision((value) => value + 1)
      refresh()
      sileo.success({
        title: "Consultation accepted",
        description:
          "The request workspace is ready for consultation and requirements gathering.",
      })
    } catch (reason) {
      const message = errorMessage(
        reason,
        "Couldn't accept this request. Try again.",
      )
      setAcceptError(message)
      sileo.error({ title: "Couldn't accept request", description: message })
      if (
        reason instanceof ApiError &&
        (reason.status === 409 ||
          reason.status === 404 ||
          reason.status === 403)
      ) {
        refresh()
        setDetailsRevision((value) => value + 1)
      }
    } finally {
      acceptingRef.current = false
      setAccepting(false)
    }
  }

  async function runConfirm() {
    if (!confirm || confirmingRef.current) return
    confirmingRef.current = true
    setConfirming(true)
    const { kind, request } = confirm
    try {
      if (kind === "decline") {
        const declined = await declineInboxRequest(request.id)
        setSelected((current) =>
          current?.id === request.id ? declined : current,
        )
        setDetailsRevision((value) => value + 1)
        sileo.success({
          title: "Request declined",
          description: "The booking was declined and the inbox was refreshed.",
        })
      } else {
        await deleteInboxRequest(request.id)
        setSelected((current) => (current?.id === request.id ? null : current))
        sileo.success({ title: "Request deleted" })
      }
      setConfirm(null)
      refresh()
    } catch (reason) {
      const message = errorMessage(
        reason,
        kind === "decline"
          ? "Couldn't decline this request. Try again."
          : "Couldn't delete this request. Try again.",
      )
      sileo.error({
        title:
          kind === "decline"
            ? "Couldn't decline request"
            : "Couldn't delete request",
        description: message,
      })
      if (
        reason instanceof ApiError &&
        (reason.status === 409 ||
          reason.status === 404 ||
          reason.status === 403)
      ) {
        setConfirm(null)
        refresh()
        setDetailsRevision((value) => value + 1)
      }
    } finally {
      confirmingRef.current = false
      setConfirming(false)
    }
  }

  const confirmService = confirm?.request.service.name ?? "this request"
  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Request inbox"
    >
      <PageHeader
        headingId="request-inbox-heading"
        title="Request Inbox"
        description={`Review and accept booked services for ${
          list.data?.department.name ??
          account.headOf?.name ??
          "your department"
        }.`}
      />
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
          <FilterSelect
            label="Filter requests"
            value={view}
            options={viewOptions}
            triggerClassName="w-[185px]"
            onChange={(value) => {
              setView(value)
              setPage(1)
            }}
          />
          {search && (
            <Button
              variant="outline"
              className="h-[34px] text-xs max-[560px]:h-11"
              onClick={() => {
                setSearch("")
                setPage(1)
              }}
            >
              Clear search
            </Button>
          )}
        </div>
        <RequestInboxTable
          requests={list.rows}
          loading={list.loading}
          error={list.error}
          viewKey={list.tableViewKey}
          onRowsSettled={list.onRowsSettled}
          quickKey={query}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={(column) => {
            setSortDir(sortBy === column && sortDir === "asc" ? "desc" : "asc")
            setSortBy(column)
            setPage(1)
          }}
          onRetry={refresh}
          onView={(request) => {
            setSelected(request)
            setAcceptError("")
          }}
          onGoToChat={(request) => void goToChat(request)}
          onDelete={(request) => setConfirm({ kind: "delete", request })}
        />
        <TableSearchStatus
          active={list.loading && list.previewing}
          label="requests"
        />
        {list.footer && (
          <TablePaginationFooter
            {...list.footer}
            label="Request inbox pages"
            onPageChange={setPage}
            className="text-[#52627a]"
          />
        )}
      </section>
      {selected && (
        <BookingDetailsDrawer
          key={selected.id}
          id={selected.id}
          loadDetails={getInboxRequest}
          closeDisabled={accepting || !!confirm}
          onClose={() => setSelected(null)}
          description="Review the client's booking before accepting it for department review."
          fallbackFocusId="request-inbox-heading"
          refreshKey={detailsRevision}
          statusLabels={{ SUBMITTED: "Pending" }}
          showMessagesLink={(details) =>
            details.acceptedDepartmentId === account.headOf?.id
          }
          additionalFields={[
            ["Client", selected.client.fullName || "Client"],
            ["Email", selected.client.email],
            ["Contact number", selected.client.contactNumber || "Not provided"],
          ]}
          renderActions={(details) => (
            <div>
              {acceptError && (
                <Alert variant="text" className="mb-3">
                  {acceptError}
                </Alert>
              )}
              {(details.status === "SUBMITTED" ||
                details.status === "UNDER_REVIEW") &&
              !details.acceptedDepartmentId ? (
                <>
                  <p className="mt-0 mb-3 text-xs leading-relaxed text-[#52627a]">
                    {details.status === "SUBMITTED"
                      ? "Accepting starts a consultation and opens a private request workspace with the client. Service delivery requires a separate quotation approval."
                      : "Start a conversation to claim this previously accepted booking for your department."}
                  </p>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="brand"
                      className="w-full"
                      disabled={accepting || confirming}
                      onClick={() => void accept(details.id)}
                    >
                      {accepting
                        ? "Accepting…"
                        : details.status === "SUBMITTED"
                          ? "Accept request"
                          : "Start conversation"}
                    </Button>
                    <Button
                      variant="danger"
                      className="w-full"
                      disabled={accepting || confirming}
                      onClick={() =>
                        setConfirm({ kind: "decline", request: selected })
                      }
                    >
                      Decline request
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="m-0 text-xs text-[#52627a]">
                    {details.acceptedDepartmentId === account.headOf?.id
                      ? "Your department accepted this consultation. Open the request workspace to gather requirements and prepare a quotation."
                      : details.acceptedDepartmentId
                        ? "Another department accepted this request. Its conversation is private to that department and the client."
                        : "This booking is no longer awaiting acceptance."}
                  </p>
                  {details.acceptedDepartmentId === account.headOf?.id && (
                    <Button
                      variant="brand"
                      className="mt-3 w-full"
                      onClick={() => void goToChat(selected)}
                    >
                      Go to chat
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        />
      )}
      {confirm && (
        <ConfirmationDialog
          title={
            confirm.kind === "delete"
              ? "Delete this request?"
              : "Decline this request?"
          }
          description={
            confirm.kind === "delete"
              ? `This permanently removes ${confirmService} from the inbox. This can't be undone.`
              : `The client's booking for ${confirmService} will be marked as declined. This can't be undone.`
          }
          confirmLabel={
            confirm.kind === "delete" ? "Delete request" : "Decline request"
          }
          pendingLabel={confirm.kind === "delete" ? "Deleting…" : "Declining…"}
          pending={confirming}
          onClose={() => setConfirm(null)}
          onConfirm={() => void runConfirm()}
        />
      )}
    </main>
  )
}
