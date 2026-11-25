"use client"

import { useEffect, useState, type FormEvent } from "react"
import { RefreshCw } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { EmptyState } from "@/components/ui/empty-state"
import { FormTextarea } from "@/components/ui/form-input"
import { Pill, type PillTone } from "@/components/ui/pill"
import { SearchField } from "@/components/ui/search-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  TablePaginationFooter,
  pageRange,
} from "@/components/ui/table-pagination-footer"
import { useTableSearchQuery } from "@/components/ui/use-table-search-query"
import { apiRequest } from "@/features/auth/api/auth-api"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { hasPermission, Permissions } from "@/features/auth/model/permissions"
import { useAsyncResource } from "@/lib/use-async-resource"
import { cn } from "@/lib/utils"
import {
  inquiryStatuses,
  type InquiryListing,
  type InquiryRecord,
  type InquiryStatus,
} from "../model/types"

const labels: Record<InquiryStatus, string> = {
  PENDING: "Pending",
  CONTACTED: "Contacted",
  CLOSED: "Closed",
  SPAM: "Spam",
}
const tones: Record<InquiryStatus, PillTone> = {
  PENDING: "warning",
  CONTACTED: "info",
  CLOSED: "success",
  SPAM: "neutral",
}
type Draft = { status: InquiryStatus; note: string; version: number }
const date = (value: string, time = false) =>
  new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(time ? { hour: "numeric", minute: "2-digit" } : {}),
  })

function ReviewForm({
  inquiry,
  draft,
  canManage,
  onChange,
  onSaved,
  onDiscard,
}: {
  inquiry: InquiryRecord
  draft: Draft
  canManage: boolean
  onChange: (draft: Draft) => void
  onSaved: () => void
  onDiscard: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const dirty =
    draft.status !== inquiry.status ||
    draft.note !== (inquiry.internalNote ?? "")
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManage || saving) return
    setSaving(true)
    setError("")
    try {
      await apiRequest(
        "/api/service-inquiries/" + encodeURIComponent(inquiry.id),
        {
          method: "PATCH",
          body: JSON.stringify({
            status: draft.status,
            internalNote: draft.note.trim(),
            version: draft.version,
          }),
        },
      )
      onSaved()
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Couldn't save the review.",
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <section
      aria-label="Selected inquiry"
      className="flex min-h-0 min-w-0 flex-col"
    >
      <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-[#65718a]">
              Inquiry details
            </span>
            <Pill tone={tones[inquiry.status]}>{labels[inquiry.status]}</Pill>
          </div>
          <h2 className="mt-3 break-words text-lg font-semibold text-foreground">
            {inquiry.subject}
          </h2>
          <p className="mt-1 text-xs text-[#65718a]">
            {inquiry.service.name} · {date(inquiry.createdAt)}
          </p>
          <section className="mt-5 border-t border-[#eceef1] pt-5">
            <h3 className="text-sm font-semibold">Contact Information</h3>
            <dl className="mt-3 grid gap-2.5 text-xs sm:grid-cols-2">
              {[
                ["Name", inquiry.fullName],
                ["Email", inquiry.email],
                ["Phone", inquiry.contactNumber],
                ["Received", date(inquiry.createdAt, true)],
                ["Reference", inquiry.id],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[#65718a]">{label}</dt>
                  <dd className="mt-1 break-all text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="mt-5 border-t border-[#eceef1] pt-5">
            <h3 className="text-sm font-semibold">Requirements</h3>
            <p className="mt-3 rounded-lg bg-[#f5f7fa] p-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#34415a]">
              {inquiry.message}
            </p>
          </section>
          <div className="mt-5 grid gap-3 border-t border-[#eceef1] pt-5">
            <h3 className="text-sm font-semibold">Follow-up</h3>
            <label htmlFor="review-status" className="text-xs font-medium">
              Status
            </label>
            <Select
              value={draft.status}
              disabled={saving || !canManage}
              onValueChange={(status) =>
                onChange({ ...draft, status: status as InquiryStatus })
              }
            >
              <SelectTrigger id="review-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {inquiryStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {labels[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label htmlFor="review-note" className="text-xs font-medium">
              Internal follow-up note
            </label>
            <FormTextarea
              id="review-note"
              rows={4}
              maxLength={2000}
              disabled={saving || !canManage}
              value={draft.note}
              onChange={(event) =>
                onChange({ ...draft, note: event.target.value })
              }
            />
            {draft.version !== inquiry.version && (
              <p role="alert" className="text-xs text-[#b4234d]">
                This inquiry changed since you started editing. Copy your note,
                then discard your draft before editing the updated inquiry.
              </p>
            )}
            {error && (
              <p role="alert" className="text-xs text-[#b4234d]">
                {error}
              </p>
            )}
          </div>
          <p className="mt-4 text-xs text-[#65718a]">
            Reviewing an inquiry does not create a booking, project, or invoice.
          </p>
        </div>
        {canManage && (
          <footer className="flex flex-none justify-end gap-2 border-t border-[#eceef1] px-5 py-3">
            {(dirty || draft.version !== inquiry.version) && (
              <Button
                type="button"
                variant="brandOutline"
                size="panel"
                disabled={saving}
                onClick={onDiscard}
              >
                Discard changes
              </Button>
            )}
            <Button
              type="submit"
              variant="brand"
              size="panel"
              disabled={saving || !dirty || draft.version !== inquiry.version}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </footer>
        )}
      </form>
    </section>
  )
}

export function ServiceInquiriesPage() {
  const account = usePortalAccount()
  const canRead = hasPermission(account, Permissions.SERVICE_INQUIRIES_READ)
  const canManage = hasPermission(account, Permissions.SERVICE_INQUIRIES_MANAGE)
  const [filter, setFilter] = useState("PENDING")
  const [search, setSearch] = useState("")
  const { query, pending: searchPending } = useTableSearchQuery(search)
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [notice, setNotice] = useState("")
  const resource = useAsyncResource(
    (signal) =>
      apiRequest<InquiryListing>(
        "/api/service-inquiries?" +
          new URLSearchParams({ status: filter, page: String(page), q: query }),
        { signal },
      ),
    [page, filter, query],
    { enabled: canRead && !searchPending },
  )
  const data = resource.data
  const busy = resource.loading || searchPending
  const selected =
    !busy && !resource.error
      ? data?.inquiries.find((item) => item.id === selectedId)
      : undefined
  const pages = Math.max(
    1,
    Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 10)),
  )
  const dirtyCount = Object.keys(drafts).length
  useEffect(() => {
    if (!dirtyCount) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirtyCount])
  useEffect(() => {
    if (!resource.loading && !resource.error && data && page > pages) {
      const timer = window.setTimeout(() => setPage(pages), 0)
      return () => window.clearTimeout(timer)
    }
  }, [resource.loading, resource.error, data, page, pages])
  if (!canRead)
    return (
      <main className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}>
        <EmptyState description="You do not have permission to view guest inquiries." />
      </main>
    )
  const counts = data?.counts
  const statusTabs = [
    { value: "ALL", label: "All inquiries", count: counts?.total },
    ...inquiryStatuses.map((status) => ({
      value: status,
      label: labels[status],
      count: counts?.[status],
    })),
  ]
  return (
    <main className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}>
      <PageHeader
        title="Guest Inquiries"
        description="Manage incoming service inquiries and follow-ups."
      />
      <section
        aria-label="Inquiry inbox"
        className="mt-4 min-w-0 overflow-hidden rounded-xl border border-[#dfe6eb] bg-background"
      >
        <Tabs
          value={filter}
          onValueChange={(value) => {
            setFilter(value)
            setPage(1)
            setSelectedId(null)
            setNotice("")
          }}
        >
          <TabsList variant="underline" aria-label="Inquiry status">
            {statusTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                variant="underline"
              >
                {tab.label}
                <span className="ml-1.5 text-[10px] tabular-nums">
                  {resource.error ? "—" : (tab.count ?? "—")}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={filter} variant="inbox">
            {notice && (
              <p role="status" className="px-4 pt-3 text-xs text-[#19703a]">
                {notice}
              </p>
            )}
            {dirtyCount > 0 && (
              <p role="status" className="px-4 pt-3 text-xs text-[#805316]">
                Unsaved edits are kept while you browse this inbox. Return to
                the inquiry to save them.
              </p>
            )}
            <div className="grid min-w-0 md:h-[max(480px,calc(100dvh-250px))] md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <div className="flex min-h-0 min-w-0 flex-col border-b border-[#eceef1] md:border-r md:border-b-0">
                <div className="flex items-center gap-2 border-b border-[#eceef1] p-3">
                  <div className="min-w-0 flex-1">
                    <SearchField
                      label="Search inquiries"
                      placeholder="Search inquiries…"
                      value={search}
                      maxLength={120}
                      fullWidth
                      onChange={(event) => {
                        setSearch(event.target.value)
                        setPage(1)
                        setSelectedId(null)
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="brandOutline"
                    size="boardAction"
                    aria-label="Refresh inquiries"
                    title="Refresh inquiries"
                    disabled={busy}
                    onClick={() => {
                      setNotice("")
                      resource.retry()
                    }}
                  >
                    <RefreshCw size={15} aria-hidden="true" />
                  </Button>
                </div>
                <div className="max-h-[min(50dvh,480px)] min-h-0 flex-1 overflow-y-auto md:max-h-none">
                  {busy ? (
                    <div
                      role="status"
                      aria-label="Loading inquiries"
                      className="grid gap-4 p-4"
                    >
                      {Array.from({ length: 5 }, (_, i) => (
                        <Skeleton key={i} className="h-14 w-full" />
                      ))}
                    </div>
                  ) : resource.error ? (
                    <EmptyState
                      size="sm"
                      role="alert"
                      description={resource.error}
                      action={
                        <Button
                          variant="brandOutline"
                          size="panel"
                          onClick={resource.retry}
                        >
                          Try again
                        </Button>
                      }
                    />
                  ) : !data?.inquiries.length ? (
                    <EmptyState
                      size="sm"
                      title={
                        search || filter !== "ALL"
                          ? "No matching inquiries"
                          : "No inquiries yet"
                      }
                      description="Try another search or status filter."
                    />
                  ) : (
                    <div
                      aria-label="Inquiries"
                      className="divide-y divide-[#e3e8ef]"
                    >
                      {data.inquiries.map((inquiry) => (
                        <div key={inquiry.id} className="px-2 py-0.5">
                          <Button
                            type="button"
                            variant={
                              selectedId === inquiry.id
                                ? "conversationSelected"
                                : "conversation"
                            }
                            size="inboxRow"
                            aria-pressed={selectedId === inquiry.id}
                            onClick={() => {
                              setSelectedId(inquiry.id)
                              setNotice("")
                            }}
                          >
                            <Avatar name={inquiry.fullName} />
                            <span className="grid min-w-0 flex-1 gap-1">
                              <span className="flex min-w-0 items-center justify-between gap-2">
                                <strong className="truncate">
                                  {inquiry.fullName}
                                </strong>
                                <span
                                  className={cn(
                                    "shrink-0 text-[10px]",
                                    selectedId === inquiry.id
                                      ? "text-white/70"
                                      : "text-[#65718a]",
                                  )}
                                >
                                  {date(inquiry.createdAt)}
                                </span>
                              </span>
                              <span
                                className={cn(
                                  "truncate",
                                  selectedId === inquiry.id
                                    ? "text-white/70"
                                    : "text-[#52627a]",
                                )}
                              >
                                {inquiry.service.name}
                              </span>
                              <span className="flex min-w-0 items-center justify-between gap-2">
                                <span
                                  className={cn(
                                    "truncate",
                                    selectedId === inquiry.id
                                      ? "text-white/70"
                                      : "text-[#65718a]",
                                  )}
                                >
                                  {inquiry.subject}
                                </span>
                                {filter === "ALL" && (
                                  <Pill tone={tones[inquiry.status]}>
                                    {labels[inquiry.status]}
                                  </Pill>
                                )}
                              </span>
                            </span>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {!busy && !resource.error && data && (
                  <div className="flex-none border-t border-[#eceef1] px-4 pb-4">
                    <TablePaginationFooter
                      {...pageRange(page, data.pageSize, data.total)}
                      total={data.total}
                      page={page}
                      totalPages={pages}
                      label="Inquiry pages"
                      itemLabel="inquiries"
                      onPageChange={(next) => {
                        setPage(next)
                        setSelectedId(null)
                      }}
                    />
                  </div>
                )}
              </div>
              {busy ? (
                <div
                  className="grid content-start gap-4 p-6"
                  aria-label="Loading inquiry details"
                >
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : selected ? (
                <ReviewForm
                  key={selected.id}
                  inquiry={selected}
                  canManage={canManage}
                  draft={
                    drafts[selected.id] ?? {
                      status: selected.status,
                      note: selected.internalNote ?? "",
                      version: selected.version,
                    }
                  }
                  onChange={(draft) =>
                    setDrafts((current) => {
                      const next = { ...current }
                      if (
                        draft.status === selected.status &&
                        draft.note === (selected.internalNote ?? "") &&
                        draft.version === selected.version
                      )
                        delete next[selected.id]
                      else next[selected.id] = draft
                      return next
                    })
                  }
                  onDiscard={() =>
                    setDrafts((current) => {
                      const next = { ...current }
                      delete next[selected.id]
                      return next
                    })
                  }
                  onSaved={() => {
                    setDrafts((current) => {
                      const next = { ...current }
                      delete next[selected.id]
                      return next
                    })
                    setNotice("Inquiry review saved.")
                    resource.retry()
                  }}
                />
              ) : (
                <div className="p-4">
                  <EmptyState
                    size="md"
                    title="Select an inquiry"
                    description="Choose an inquiry to view its contact details and requirements."
                  />
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </main>
  )
}
