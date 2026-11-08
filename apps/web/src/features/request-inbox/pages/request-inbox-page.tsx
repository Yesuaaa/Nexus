"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { sileo } from "@/lib/toast"
import { contentClass } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import {
  useTableSearch,
  useTableFooter,
} from "@/components/ui/use-table-search"
import { TableSearchStatus } from "@/components/ui/table-search-status"
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
import { getConversation } from "@/features/request-conversations/api/request-conversations-api"
import { cn } from "@/lib/utils"
import { watchVisibleRefresh } from "@/lib/visible-refresh"
import {
  acceptInboxRequest,
  declineInboxRequest,
  deleteInboxRequest,
  getInboxRequest,
  listInbox,
  type InboxList,
  type InboxRequest,
  type InboxView,
  type InboxSort,
} from "../api/request-inbox-api"
import { RequestInboxTable } from "../components/request-inbox-table"

type ConfirmAction = { kind: "decline" | "delete"; request: InboxRequest }

function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  busyLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  busyLabel: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onCancel()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
      className="pointer-events-auto m-auto w-[calc(100%-32px)] max-w-[420px] rounded-[13px] border border-[#dedede] bg-background p-0 text-[#182235] shadow-[0_8px_30px_rgb(20_30_50_/_18%)] backdrop:bg-black/40"
    >
      <div className="grid gap-4 p-5">
        <div className="grid gap-1.5">
          <h2
            id={titleId}
            className="m-0 text-base leading-tight font-semibold"
          >
            {title}
          </h2>
          <p
            id={descriptionId}
            className="m-0 text-xs leading-relaxed text-[#52627a]"
          >
            {description}
          </p>
        </div>
        <div className="flex justify-end gap-2 max-[560px]:flex-col-reverse">
          <Button
            type="button"
            variant="outline"
            className="h-9 min-w-[92px] text-xs max-[560px]:h-11"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-9 min-w-[92px] bg-[#b42318] text-xs text-white hover:bg-[#912018] max-[560px]:h-11"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? busyLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}

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
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<InboxSort>("createdAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState<InboxRequest | null>(null)
  const [accepting, setAccepting] = useState(false)
  const acceptingRef = useRef(false)
  const [acceptError, setAcceptError] = useState("")
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null)
  const [confirming, setConfirming] = useState(false)
  const confirmingRef = useRef(false)
  const [detailsRevision, setDetailsRevision] = useState(0)
  const [result, setResult] = useState<InboxList | null>(null)
  const [errorMessage, setError] = useState("")
  const [errorRequestKey, setErrorRequestKey] = useState("")
  const [resolvedKey, setResolvedKey] = useState("")
  const [resolvedViewKey, setResolvedViewKey] = useState("")
  const viewKey = JSON.stringify({
    search: query,
    view,
    page,
    sortBy,
    sortDir,
  })
  const requestKey = `${viewKey}:${revision}`
  const error = errorRequestKey === requestKey ? errorMessage : ""
  const loading = resolvedKey !== requestKey || search.trim() !== query

  const searchScope = JSON.stringify([view, sortBy, sortDir, revision])
  const { acceptRows, preview, previewing } = useTableSearch<InboxRequest>({
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
    let inFlight = false
    let hasLoaded = false
    const load = () => {
      if (inFlight) return
      inFlight = true
      void listInbox({
        search: query,
        view,
        page,
        sortBy,
        sortDir,
        signal: controller.signal,
      })
        .then((value) => {
          if (!active) return
          const lastPage = Math.max(1, Math.ceil(value.total / value.pageSize))
          if (page > lastPage) {
            setPage(lastPage)
            return
          }
          hasLoaded = true
          acceptRows(value.serviceRequests)
          setResult(value)
          setError("")
          setResolvedKey(requestKey)
          setResolvedViewKey(viewKey)
        })
        .catch((reason: unknown) => {
          if (!active) return
          if (
            hasLoaded &&
            (!(reason instanceof ApiError) || reason.status >= 500)
          )
            return
          setErrorRequestKey(requestKey)
          setError(
            reason instanceof Error
              ? reason.message
              : "Couldn't load requests.",
          )
          setResolvedKey(requestKey)
        })
        .finally(() => {
          inFlight = false
        })
    }
    load()
    const stopRefresh = watchVisibleRefresh(load)
    return () => {
      active = false
      controller.abort()
      stopRefresh()
    }
  }, [
    query,
    view,
    page,
    sortBy,
    sortDir,
    revision,
    requestKey,
    viewKey,
    acceptRows,
  ])

  function refresh() {
    setRevision((value) => value + 1)
  }

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
        description:
          reason instanceof Error
            ? reason.message
            : "Couldn't open this request's conversation. Try again.",
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
      const message =
        reason instanceof Error
          ? reason.message
          : kind === "decline"
            ? "Couldn't decline this request. Try again."
            : "Couldn't delete this request. Try again."
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

  const from = !footer?.total ? 0 : (footer.page - 1) * footer.pageSize + 1
  const to = footer
    ? (footer.page - 1) * footer.pageSize + footer.serviceRequests.length
    : 0
  const confirmService = confirm?.request.service.name ?? "this request"
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
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Awaiting acceptance</SelectItem>
              <SelectItem value="under-review">Under review</SelectItem>
              <SelectItem value="awaiting-information">
                Awaiting information
              </SelectItem>
              <SelectItem value="ready-for-quotation">
                Ready for quotation
              </SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
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
          requests={preview ?? result?.serviceRequests ?? []}
          loading={loading}
          error={error}
          viewKey={tableViewKey}
          onRowsSettled={onRowsSettled}
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
        <TableSearchStatus active={loading && previewing} label="requests" />
        {!error && !previewing && !!footer?.total && (
          <footer className="flex flex-wrap items-center justify-between gap-3 pt-4 text-[11px] text-[#52627a]">
            <span role="status" aria-live="polite" aria-atomic="true">
              Showing {from}–{to} of {footer.total}
            </span>
            <NumberedPagination
              page={footer.page}
              totalPages={Math.max(
                1,
                Math.ceil(footer.total / footer.pageSize),
              )}
              disabled={loading || footer !== result}
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
                <p role="alert" className="mt-0 mb-3 text-xs text-red-700">
                  {acceptError}
                </p>
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
                      className="w-full bg-[#203f8c] text-white hover:bg-[#172f70]"
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
                      className="w-full bg-[#b42318] text-white hover:bg-[#912018]"
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
                      className="mt-3 w-full bg-[#203f8c] text-white hover:bg-[#172f70]"
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
      <ConfirmModal
        open={!!confirm}
        busy={confirming}
        title={
          confirm?.kind === "delete"
            ? "Delete this request?"
            : "Decline this request?"
        }
        description={
          confirm?.kind === "delete"
            ? `This permanently removes ${confirmService} from the inbox. This can't be undone.`
            : `The client's booking for ${confirmService} will be marked as declined. This can't be undone.`
        }
        confirmLabel={
          confirm?.kind === "delete" ? "Delete request" : "Decline request"
        }
        busyLabel={confirm?.kind === "delete" ? "Deleting…" : "Declining…"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runConfirm()}
      />
    </main>
  )
}
