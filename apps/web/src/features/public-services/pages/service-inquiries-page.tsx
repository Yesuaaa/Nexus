"use client"

import { useState, type FormEvent } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { apiRequest } from "@/features/auth/api/auth-api"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { hasPermission, Permissions } from "@/features/auth/model/permissions"
import { useAsyncResource } from "@/lib/use-async-resource"
import {
  inquiryStatuses,
  type InquiryListing,
  type InquiryRecord,
  type InquiryStatus,
} from "../model/types"
import { PublicState } from "./public-services-page"
import styles from "../components/public-services.module.css"

function ReviewForm({
  inquiry,
  canManage,
  onSaved,
}: {
  inquiry: InquiryRecord
  canManage: boolean
  onSaved: () => void
}) {
  const [status, setStatus] = useState<InquiryStatus>(inquiry.status)
  const [note, setNote] = useState(inquiry.internalNote ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

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
            status,
            internalNote: note.trim(),
            version: inquiry.version,
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
    <section className={styles.reviewPanel} aria-label="Selected inquiry">
      <span className={styles.adminBadge}>{inquiry.status}</span>
      <h2>{inquiry.subject}</h2>
      <p className={styles.small}>{inquiry.service.name}</p>
      <dl className={styles.contactDetails}>
        <div>
          <dt>Name</dt>
          <dd>{inquiry.fullName}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{inquiry.email}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{inquiry.contactNumber}</dd>
        </div>
        <div>
          <dt>Received</dt>
          <dd>
            {new Date(inquiry.createdAt).toLocaleString("en-PH", {
              timeZone: "Asia/Shanghai",
            })}
          </dd>
        </div>
        <div>
          <dt>Reference</dt>
          <dd>{inquiry.id}</dd>
        </div>
      </dl>
      <h3>Requirements</h3>
      <p className={styles.inquiryMessage}>{inquiry.message}</p>
      <form onSubmit={save} className={styles.reviewForm}>
        <fieldset disabled={saving || !canManage}>
          <legend className={styles.srOnly}>Review and follow-up</legend>
          <label htmlFor="review-status">Status</label>
          <select
            id="review-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as InquiryStatus)}
          >
            {inquiryStatuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <label htmlFor="review-note">Internal follow-up note</label>
          <textarea
            id="review-note"
            rows={4}
            maxLength={2000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          {error && (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          )}
          {canManage && (
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save review"}
            </Button>
          )}
        </fieldset>
      </form>
      <p className={styles.small}>
        Reviewing an inquiry does not create a booking, project, or invoice.
      </p>
    </section>
  )
}

export function ServiceInquiriesPage() {
  const account = usePortalAccount()
  const canRead = hasPermission(account, Permissions.SERVICE_INQUIRIES_READ)
  const canManage = hasPermission(account, Permissions.SERVICE_INQUIRIES_MANAGE)
  const [filter, setFilter] = useState("PENDING")
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notice, setNotice] = useState("")
  const resource = useAsyncResource(
    (signal) =>
      apiRequest<InquiryListing>(
        "/api/service-inquiries?" +
          new URLSearchParams({ status: filter, page: String(page) }),
        { signal },
      ),
    [page, filter],
    { enabled: canRead },
  )
  const selected = resource.data?.inquiries.find(
    (item) => item.id === selectedId,
  )
  const pages = Math.max(1, Math.ceil((resource.data?.total ?? 0) / 25))

  if (!canRead)
    return (
      <main className={styles.admin}>
        <PublicState message="You do not have permission to view guest inquiries." />
      </main>
    )

  return (
    <main className={styles.admin}>
      <PageHeader
        title="Guest Service Inquiries"
        description="Review public inquiries and record follow-up separately from bookings."
      />
      <div className={styles.adminToolbar}>
        <label htmlFor="inquiry-filter">Show</label>
        <select
          id="inquiry-filter"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value)
            setPage(1)
            setSelectedId(null)
            setNotice("")
          }}
        >
          <option value="ALL">All statuses</option>
          {inquiryStatuses.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          disabled={resource.loading}
          onClick={() => {
            setSelectedId(null)
            resource.retry()
          }}
        >
          Refresh
        </Button>
      </div>
      {notice && (
        <p role="status" className={styles.adminNotice}>
          {notice}
        </p>
      )}
      {resource.loading ? (
        <PublicState loading message="Loading inquiries…" />
      ) : resource.error ? (
        <PublicState message={resource.error} onRetry={resource.retry} />
      ) : !resource.data?.inquiries.length ? (
        <PublicState message="No inquiries in this view." />
      ) : (
        <>
          <div className={styles.inboxLayout}>
            <div className={styles.inquiryList} aria-label="Inquiries">
              {resource.data.inquiries.map((inquiry) => (
                <button
                  type="button"
                  key={inquiry.id}
                  className={styles.inquiryListItem}
                  aria-pressed={selectedId === inquiry.id}
                  onClick={() => {
                    setSelectedId(inquiry.id)
                    setNotice("")
                  }}
                >
                  <span className={styles.adminBadge}>{inquiry.status}</span>
                  <strong>{inquiry.subject}</strong>
                  <span>{inquiry.service.name}</span>
                  <span>
                    {inquiry.fullName} ·{" "}
                    {new Date(inquiry.createdAt).toLocaleDateString("en-PH", {
                      timeZone: "Asia/Shanghai",
                    })}
                  </span>
                </button>
              ))}
            </div>
            {selected ? (
              <ReviewForm
                key={selected.id + ":" + selected.version}
                inquiry={selected}
                canManage={canManage}
                onSaved={() => {
                  setNotice("Inquiry review saved.")
                  setSelectedId(null)
                  setPage(1)
                  resource.retry()
                }}
              />
            ) : (
              <PublicState message="Select an inquiry to view the contact details and requirements." />
            )}
          </div>
          <nav className={styles.pagination} aria-label="Inquiry pages">
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1}
              onClick={() => {
                setPage(page - 1)
                setSelectedId(null)
              }}
            >
              Previous
            </Button>
            <span>
              Page {page} of {pages}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={page >= pages}
              onClick={() => {
                setPage(page + 1)
                setSelectedId(null)
              }}
            >
              Next
            </Button>
          </nav>
        </>
      )}
    </main>
  )
}
