"use client"
import { useState, type FormEvent } from "react"
import {
  SidePanel,
  SidePanelHeader,
  SidePanelBody,
  useSidePanel,
} from "@/components/ui/side-panel"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { MoneyInput } from "@/components/ui/money-input"
import { DateInput } from "@/components/ui/date-input"
import { FormInput, FormTextarea } from "@/components/ui/form-input"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { apiRequest } from "@/features/auth/api/auth-api"
import { errorMessage } from "@/lib/error-message"
import { useAsyncResource } from "@/lib/use-async-resource"
import { FilterSelect } from "@/components/ui/filter-select"

export type BillingInvoice = {
  id: string
  requestId: string
  quotationId: string | null
  invoiceNumber: string
  description: string
  version: number
  status: "DRAFT" | "ISSUED" | "CANCELLED"
  issueDate: string
  dueDate: string
  client: { fullName: string | null; email: string }
  request: {
    title: string
    referenceNumber: string | null
    project: { id: string; name: string } | null
  }
  projectId: string | null
  total: string
  collected: string
  outstanding: string
  displayStatus: string
  payments: {
    id: string
    amount: string
    paidAt: string
    reference: string | null
    methodLabel: string | null
    note: string | null
  }[]
  workflowPayment: { amount: string; reference: string | null } | null
}
export function InvoicePanel({
  invoice,
  canManage,
  onClose,
  onChanged,
  onEdit,
}: {
  invoice: BillingInvoice
  canManage: boolean
  onClose: () => void
  onChanged: () => void
  onEdit: (invoice: BillingInvoice) => void
}) {
  const panel = useSidePanel(onClose)
  const [confirmation, setConfirmation] = useState<
    "issue" | "cancel" | "commencement" | null
  >(null)
  const eligible = useAsyncResource(
    (signal) =>
      apiRequest<{
        payment: { id: string; amount: string; reference: string | null } | null
      }>(
        `/api/billing/invoices/${encodeURIComponent(invoice.id)}/commencement`,
        { signal },
      ),
    [invoice.id],
    {
      enabled: canManage && invoice.status === "ISSUED",
      fallbackError: "Could not check commencement payments.",
    },
  )
  const [showPayment, setShowPayment] = useState(false)
  const [amount, setAmount] = useState("")
  const [paidAt, setPaidAt] = useState("")
  const [reference, setReference] = useState("")
  const [note, setNote] = useState("")
  const [methodId, setMethodId] = useState("")
  const methods = useAsyncResource(
    (signal) =>
      apiRequest<{ methods: { id: string; label: string }[] }>(
        "/api/billing/settings",
        { signal },
      ),
    [],
    {
      enabled: canManage && invoice.status === "ISSUED",
      fallbackError: "Could not load payment methods.",
    },
  )
  const [key] = useState(() => crypto.randomUUID())
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  async function send(action: string, body: object) {
    setPending(true)
    setError("")
    try {
      await apiRequest(
        `/api/billing/invoices/${encodeURIComponent(invoice.id)}/${action}`,
        { method: "POST", body: JSON.stringify(body) },
      )
      onChanged()
      panel.close()
    } catch (reason) {
      setError(errorMessage(reason, "Couldn't update this invoice."))
    } finally {
      setPending(false)
    }
  }
  function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void send("payments", {
      amount,
      paidAt,
      reference,
      note,
      methodId,
      idempotencyKey: key,
    })
  }
  const rows = [
    ["Client", invoice.client.fullName || invoice.client.email],
    ["Service request", invoice.request.title],
    [
      "Project",
      invoice.projectId ? (invoice.request.project?.name ?? "Project") : "None",
    ],
    ["Description", invoice.description],
    ["Status", invoice.displayStatus.replaceAll("_", " ")],
    ["Total", `₱${invoice.total}`],
    ["Collected", `₱${invoice.collected}`],
    ["Outstanding", `₱${invoice.outstanding}`],
    ["Issue date", invoice.issueDate.slice(0, 10)],
    ["Due date", invoice.dueDate.slice(0, 10)],
  ]
  return (
    <>
      <SidePanel
        open={panel.open}
        onOpenChange={panel.onOpenChange}
        busy={pending}
      >
        <SidePanelHeader
          title={invoice.invoiceNumber}
          description="Invoice details and payment history"
        />
        <SidePanelBody>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="m-0 break-words">{value}</dd>
              </div>
            ))}
          </dl>
          <section>
            <h3 className="font-semibold">Payment history</h3>
            {invoice.workflowPayment && (
              <p>
                Commencement payment: ₱{invoice.workflowPayment.amount}{" "}
                {invoice.workflowPayment.reference}
              </p>
            )}
            {invoice.payments.length ? (
              <ul>
                {invoice.payments.map((payment) => (
                  <li key={payment.id}>
                    ₱{payment.amount} · {payment.paidAt.slice(0, 10)}{" "}
                    {payment.reference} {payment.methodLabel} {payment.note}
                  </li>
                ))}
              </ul>
            ) : (
              !invoice.workflowPayment && <p>No payments recorded.</p>
            )}
          </section>
          {canManage && invoice.status === "DRAFT" && (
            <Button
              variant="outline"
              onClick={() => panel.close(() => onEdit(invoice))}
            >
              Edit draft
            </Button>
          )}
          {canManage && invoice.status === "DRAFT" && (
            <Button variant="brand" onClick={() => setConfirmation("issue")}>
              Issue invoice
            </Button>
          )}
          {canManage &&
            invoice.status === "ISSUED" &&
            invoice.outstanding !== "0.00" && (
              <Button variant="brand" onClick={() => setShowPayment(true)}>
                Record payment
              </Button>
            )}
          {canManage &&
            invoice.status !== "CANCELLED" &&
            !invoice.workflowPayment &&
            !invoice.payments.length && (
              <Button
                variant="outline"
                onClick={() => setConfirmation("cancel")}
              >
                Cancel invoice
              </Button>
            )}
          {showPayment && (
            <form className="grid gap-3" onSubmit={submitPayment}>
              <label htmlFor="invoice-payment-amount">Amount (PHP)</label>
              <MoneyInput
                id="invoice-payment-amount"
                value={amount}
                onValueChange={setAmount}
                requirePositive
              />
              <label htmlFor="invoice-payment-date">Payment date</label>
              <DateInput
                id="invoice-payment-date"
                required
                value={paidAt}
                onChange={(event) => setPaidAt(event.target.value)}
              />
              <label htmlFor="invoice-payment-reference">
                Reference (optional)
              </label>
              <FormInput
                id="invoice-payment-reference"
                maxLength={300}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
              <FilterSelect
                label="Payment method"
                value={methodId}
                options={[
                  { value: "", label: "No method specified" },
                  ...(methods.data?.methods ?? []).map((method) => ({
                    value: method.id,
                    label: method.label,
                  })),
                ]}
                onChange={setMethodId}
              />
              {methods.error && <Alert>{methods.error}</Alert>}
              <label htmlFor="invoice-payment-note">Note (optional)</label>
              <FormTextarea
                id="invoice-payment-note"
                maxLength={2000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <Button type="submit" variant="brand" disabled={pending}>
                {pending ? "Saving…" : "Save payment"}
              </Button>
            </form>
          )}
          {canManage && eligible.data?.payment && (
            <Button
              variant="outline"
              onClick={() => setConfirmation("commencement")}
            >
              Apply commencement payment (₱{eligible.data.payment.amount})
            </Button>
          )}
          {eligible.error && <Alert>{eligible.error}</Alert>}
          {error && !confirmation && <Alert>{error}</Alert>}
        </SidePanelBody>
      </SidePanel>
      {confirmation && (
        <ConfirmationDialog
          title={
            confirmation === "issue"
              ? "Issue invoice?"
              : confirmation === "commencement"
                ? "Apply commencement payment?"
                : "Cancel invoice?"
          }
          subject={invoice.invoiceNumber}
          description={
            confirmation === "issue"
              ? "Issued invoice details cannot be edited."
              : confirmation === "commencement"
                ? "Apply this verified payment to the invoice balance."
                : "Cancellation is final."
          }
          confirmLabel={
            confirmation === "issue"
              ? "Issue invoice"
              : confirmation === "commencement"
                ? "Apply payment"
                : "Cancel invoice"
          }
          pendingLabel="Saving…"
          pending={pending}
          destructive={confirmation === "cancel"}
          error={error}
          onClose={() => {
            setConfirmation(null)
            setError("")
          }}
          onConfirm={() =>
            void send(
              confirmation,
              confirmation === "issue"
                ? { version: invoice.version }
                : confirmation === "commencement"
                  ? { workflowPaymentId: eligible.data?.payment?.id }
                  : {},
            )
          }
        />
      )}
    </>
  )
}
