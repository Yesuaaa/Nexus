"use client"
import { useState, type FormEvent } from "react"
import {
  SidePanel,
  SidePanelHeader,
  SidePanelBody,
  SidePanelFooter,
  useSidePanel,
} from "@/components/ui/side-panel"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { MoneyInput } from "@/components/ui/money-input"
import { DateInput } from "@/components/ui/date-input"
import { FormTextarea } from "@/components/ui/form-input"
import { FilterSelect } from "@/components/ui/filter-select"
import { SearchField } from "@/components/ui/search-field"
import { apiRequest } from "@/features/auth/api/auth-api"
import { useAsyncResource } from "@/lib/use-async-resource"
import { errorMessage } from "@/lib/error-message"
import type { BillingInvoice } from "./invoice-panel"

type BillingRequest = {
  id: string
  title: string
  referenceNumber: string | null
  client: { fullName: string | null; email: string }
  project: { id: string; name: string } | null
  workflow: { quotations: { total: string; currency: string }[] } | null
}
type RequestPage = { rows: BillingRequest[]; total: number; pageSize: number }
export function InvoiceDraftPanel({
  invoice,
  onClose,
  onSaved,
}: {
  invoice?: BillingInvoice
  onClose: () => void
  onSaved: () => void
}) {
  const panel = useSidePanel(onClose)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<BillingRequest | null>(() =>
    invoice
      ? {
          id: invoice.requestId,
          title: invoice.request.title,
          referenceNumber: invoice.request.referenceNumber,
          client: invoice.client,
          project: invoice.request.project,
          workflow: null,
        }
      : null,
  )
  const [projectId, setProjectId] = useState(invoice?.projectId ?? "")
  const [description, setDescription] = useState(invoice?.description ?? "")
  const [total, setTotal] = useState(invoice?.total ?? "")
  const [issueDate, setIssueDate] = useState(
    invoice?.issueDate.slice(0, 10) ?? "",
  )
  const [dueDate, setDueDate] = useState(invoice?.dueDate.slice(0, 10) ?? "")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const requests = useAsyncResource(
    (signal) =>
      apiRequest<RequestPage>(
        `/api/billing/requests?${new URLSearchParams({ page: String(page), search })}`,
        { signal },
      ),
    [page, search],
    { fallbackError: "Could not load service requests." },
  )
  const settings = useAsyncResource(
    (signal) =>
      apiRequest<{
        configuration: { defaultTerms: string; defaultDueDays: number }
      }>("/api/billing/settings", { signal }),
    [],
    { enabled: !invoice },
  )
  const issueTime = /^\d{4}-\d{2}-\d{2}$/.test(issueDate)
    ? Date.parse(`${issueDate}T00:00:00Z`)
    : NaN
  const suggestedDue =
    Number.isFinite(issueTime) && settings.data
      ? new Date(
          issueTime + settings.data.configuration.defaultDueDays * 86400000,
        )
          .toISOString()
          .slice(0, 10)
      : ""
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const requestId = selected?.id
    if (!requestId) {
      setError("Select a service request.")
      return
    }
    setError("")
    setPending(true)
    try {
      await apiRequest(
        invoice
          ? `/api/billing/invoices/${encodeURIComponent(invoice.id)}`
          : "/api/billing/invoices",
        {
          method: invoice ? "PATCH" : "POST",
          body: JSON.stringify({
            requestId,
            projectId: projectId || null,
            quotationId:
              invoice && requestId === invoice.requestId
                ? invoice.quotationId
                : null,
            description,
            total,
            issueDate,
            dueDate: dueDate || suggestedDue,
            ...(invoice ? { version: invoice.version } : {}),
          }),
        },
      )
      onSaved()
      panel.close()
    } catch (reason) {
      setError(errorMessage(reason, "Could not save the invoice."))
    } finally {
      setPending(false)
    }
  }
  const quote = selected?.workflow?.quotations[0]
  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      busy={pending}
    >
      <SidePanelHeader
        title={invoice ? "Edit draft" : "Create invoice"}
        description="Save invoice details as a draft."
      />
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <SidePanelBody>
          <>
            <SearchField
              label="Search service requests"
              placeholder="Search requests"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
                setSelected(null)
                setProjectId("")
              }}
            />
            {requests.error && <Alert>{requests.error}</Alert>}
            <FilterSelect
              label="Service request"
              value={selected?.id ?? ""}
              placeholder={
                requests.loading
                  ? "Loading requests…"
                  : "Choose a service request"
              }
              options={[
                ...(selected &&
                !(requests.data?.rows ?? []).some(
                  (item) => item.id === selected.id,
                )
                  ? [selected]
                  : []),
                ...(requests.data?.rows ?? []),
              ].map((item) => ({
                value: item.id,
                label: `${item.client.fullName || item.client.email} · ${item.referenceNumber || item.title}`,
              }))}
              onChange={(id) => {
                setSelected(
                  requests.data?.rows.find((item) => item.id === id) ??
                    selected,
                )
                if (id !== selected?.id) setProjectId("")
              }}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || requests.loading}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  requests.loading ||
                  page * (requests.data?.pageSize ?? 10) >=
                    (requests.data?.total ?? 0)
                }
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
            {quote && (
              <p>
                Accepted quotation: {quote.currency} {quote.total}. Invoice
                total can differ.
              </p>
            )}
            {settings.data?.configuration.defaultTerms && (
              <p>Default terms: {settings.data.configuration.defaultTerms}</p>
            )}
            {selected?.project && (
              <FilterSelect
                label="Project"
                value={projectId}
                options={[
                  { value: "", label: "No project" },
                  {
                    value: selected.project.id,
                    label: selected.project.name,
                  },
                ]}
                onChange={setProjectId}
              />
            )}
          </>
          <label htmlFor="draft-description">Description</label>
          <FormTextarea
            id="draft-description"
            required
            maxLength={4000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <label htmlFor="draft-total">Total (PHP)</label>
          <MoneyInput
            id="draft-total"
            value={total}
            onValueChange={setTotal}
            requirePositive
          />
          <label htmlFor="draft-issue">Issue date</label>
          <DateInput
            id="draft-issue"
            required
            value={issueDate}
            onChange={(event) => setIssueDate(event.target.value)}
          />
          <label htmlFor="draft-due">Due date</label>
          <DateInput
            id="draft-due"
            required
            value={dueDate || suggestedDue}
            onChange={(event) => setDueDate(event.target.value)}
          />
          {error && <Alert>{error}</Alert>}
        </SidePanelBody>
        <SidePanelFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => panel.close()}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button variant="brand" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save draft"}
          </Button>
        </SidePanelFooter>
      </form>
    </SidePanel>
  )
}
