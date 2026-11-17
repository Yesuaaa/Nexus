"use client"

import { useWorkflowFilePreview } from "@/features/request-workflow/hooks/use-workflow-file-preview"
import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { ChevronRight, Download } from "lucide-react"
import { contentClass, focusRing } from "@/components/layout/styles"
import { PageHeader } from "@/components/layout/page-header"
import { Alert } from "@/components/ui/alert"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { apiRequest } from "@/features/auth/api/auth-api"
import { Pill, type PillTone } from "@/components/ui/pill"
import { rowActionButton } from "@/components/ui/row-action-styles"
import { downloadWorkflowFile } from "@/features/request-workflow/api/workflow-api"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { errorMessage } from "@/lib/error-message"
import { useAsyncResource } from "@/lib/use-async-resource"

type BillingPayment = {
  id: string
  requestId: string
  serviceName: string
  bookingReference: string | null
  amount: string
  currency: string
  status: "PENDING" | "SUBMITTED" | "VERIFIED"
  reference: string | null
  approvedAt: string | null
  lineItems?:
    { description: string; quantity: number; unitPrice: string }[] | null
  verifiedAt: string | null
  submittedAt: string | null
  sandbox: boolean
  proofFile: { id: string; name: string; mimeType: string } | null
}

const paymentRowClass =
  "grid grid-cols-2 items-center gap-x-4 gap-y-2 px-4 py-3 text-xs text-foreground @min-[640px]:grid-cols-[minmax(0,2fr)_minmax(8rem,1fr)_minmax(9rem,1fr)_9.5rem]"
const conversationHref = (id: string) =>
  `/messages?request=${encodeURIComponent(id)}`

const summaryDate = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "Asia/Manila",
})

function formatAmount({
  amount,
  currency,
}: Pick<BillingPayment, "amount" | "currency">) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(
    Number(amount),
  )
}

function paymentStatus(payment: BillingPayment): {
  label: string
  tone: PillTone
} {
  if (payment.status === "PENDING")
    return { label: "Payment due", tone: "warning" }
  if (payment.sandbox) return { label: "Test payment", tone: "neutral" }
  if (payment.status === "VERIFIED")
    return { label: "Verified payment", tone: "success" }
  return { label: "Awaiting verification", tone: "warning" }
}

function ProofAttachment({
  requestId,
  file,
}: {
  requestId: string
  file: NonNullable<BillingPayment["proofFile"]>
}) {
  const [expanded, setExpanded] = useState(false)
  const isImage = ["image/png", "image/jpeg"].includes(file.mimeType)
  const url = useWorkflowFilePreview(requestId, file.id, isImage)

  return (
    <div className="min-w-0">
      <dt className="text-xs text-[#475569]">Attached file</dt>
      <dd className="mt-2">
        <div className="flex items-center gap-3">
          {url && (
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={
                expanded ? "Collapse payment proof" : "Enlarge payment proof"
              }
              onClick={() => setExpanded(!expanded)}
              className={`shrink-0 overflow-hidden rounded-lg border border-[#e2e8f0] ${focusRing}`}
            >
              <Image
                unoptimized
                src={url}
                alt=""
                width={96}
                height={96}
                className="size-24 object-cover"
              />
            </button>
          )}
          <span className="min-w-0 break-all text-xs text-[#475569]">
            {file.name}
          </span>
        </div>
        {url && expanded && (
          <Image
            unoptimized
            src={url}
            alt="Uploaded payment proof"
            width={480}
            height={480}
            className="mt-3 max-h-[40dvh] w-full rounded-lg border border-[#e2e8f0] object-contain"
          />
        )}
      </dd>
    </div>
  )
}

export default function BillingLogsPage() {
  const { formatDate } = useDatePreferences()
  const { data: payments = null, error } = useAsyncResource(
    (signal) =>
      apiRequest<BillingPayment[]>("/api/request-workflows/billing", {
        signal,
      }),
    [],
    { fallbackError: "Could not load billing records." },
  )
  const [selected, setSelected] = useState<BillingPayment | null>(null)
  const [downloadError, setDownloadError] = useState("")
  const [downloading, setDownloading] = useState(false)

  const due = (payments ?? [])
    .filter(({ status }) => status === "PENDING")
    .sort((a, b) => (a.approvedAt ?? "").localeCompare(b.approvedAt ?? ""))
  const history = payments?.filter(({ status }) => status !== "PENDING") ?? []

  async function downloadSelected() {
    if (!selected?.proofFile || downloading) return
    setDownloading(true)
    setDownloadError("")
    try {
      await downloadWorkflowFile(selected.requestId, selected.proofFile)
    } catch (reason) {
      setDownloadError(errorMessage(reason, "Could not download the file."))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <main className={`${contentClass} p-[clamp(16px,2.1vw,32px)]`}>
      <PageHeader
        tone="client"
        title="Billing Logs"
        description="See what’s due and review payments for your booked services."
      />

      {error ? (
        <Alert variant="text" className="mt-6 text-sm">
          {error}
        </Alert>
      ) : payments === null ? (
        <p role="status" className="mt-6 text-sm text-[#52627a]">
          Loading billing records…
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          <section aria-labelledby="billing-due">
            <h2 id="billing-due" className="mb-3 text-base font-semibold">
              Due next
            </h2>
            {due.length ? (
              <ul className="@container divide-y divide-[#c7d7ef] rounded-xl border border-[#b9cbee] bg-[#eaf1fd]">
                {due.map((payment) => {
                  const isDemo = payment.bookingReference === "DEMO-BILLING-001"
                  return (
                    <li key={payment.id} className={paymentRowClass}>
                      <div className="col-span-2 min-w-0 @min-[640px]:col-span-1">
                        <p className="break-words font-semibold">
                          {isDemo ? "Website Development" : payment.serviceName}
                        </p>
                        <p className="mt-1 break-words text-[11px] text-[#52627a]">
                          {isDemo
                            ? "INV-003 · BK-2026-0142"
                            : payment.bookingReference || "Booked service"}
                        </p>
                      </div>
                      <p className="min-w-0 break-words text-sm leading-5 font-semibold text-slate-900 tabular-nums @min-[640px]:text-center">
                        {formatAmount(payment)}
                      </p>
                      <p className="text-xs leading-5 text-[#475569] @min-[640px]:text-center">
                        {isDemo ? "Due Nov 20, 2026" : "Payment due"}
                      </p>
                      <Button
                        type="button"
                        variant="brand"
                        className="col-span-2 min-w-24 justify-self-end text-xs @min-[640px]:col-span-1"
                        onClick={() => {
                          setDownloadError("")
                          setSelected(payment)
                        }}
                      >
                        Review
                      </Button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="rounded-lg border border-[#e2e8f0] px-4 py-3 text-xs text-[#52627a]">
                No payments due.
              </p>
            )}
          </section>

          <section aria-labelledby="billing-history">
            <h2 id="billing-history" className="mb-3 text-base font-semibold">
              Payment history
            </h2>
            {history.length ? (
              <ul className="@container divide-y divide-[#eceef1] rounded-xl border border-[#e2e8f0]">
                {history.map((payment) => {
                  const status = paymentStatus(payment)
                  const actionLabel = payment.proofFile
                    ? payment.status === "VERIFIED"
                      ? "View receipt"
                      : "View proof"
                    : "View payment"
                  return (
                    <li key={payment.id} className={paymentRowClass}>
                      <div className="col-span-2 min-w-0 @min-[640px]:col-span-1">
                        <p className="break-words font-semibold">
                          {payment.serviceName}
                        </p>
                        <p className="mt-1 break-words text-[11px] text-[#52627a]">
                          {payment.status === "VERIFIED" && payment.verifiedAt
                            ? formatDate(payment.verifiedAt)
                            : payment.bookingReference || "Booked service"}
                        </p>
                      </div>
                      <span className="min-w-0 break-words text-sm font-semibold tabular-nums @min-[640px]:text-center">
                        {formatAmount(payment)}
                      </span>
                      <Pill
                        tone={status.tone}
                        className="justify-self-start @min-[640px]:justify-self-center"
                      >
                        {status.label}
                      </Pill>
                      <button
                        type="button"
                        aria-label={actionLabel}
                        className={`${rowActionButton} col-span-2 justify-self-end @min-[640px]:col-span-1`}
                        onClick={() => {
                          setDownloadError("")
                          setSelected(payment)
                        }}
                      >
                        <ChevronRight size={16} aria-hidden="true" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="rounded-lg border border-[#e2e8f0] px-4 py-3 text-xs text-[#52627a]">
                No payment history yet.
              </p>
            )}
          </section>
        </div>
      )}

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open && !downloading) setSelected(null)
        }}
      >
        {selected && (
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <DialogTitle
              className={
                selected.status === "VERIFIED" ? "font-bold" : undefined
              }
            >
              {selected.sandbox
                ? "Sandbox receipt"
                : selected.status === "PENDING"
                  ? "Payment summary"
                  : selected.proofFile
                    ? "Payment proof"
                    : "Payment details"}
            </DialogTitle>
            <DialogDescription
              className={
                selected.status === "PENDING" ||
                (selected.proofFile && !selected.sandbox)
                  ? "text-sm text-[#475569]"
                  : undefined
              }
            >
              {selected.serviceName}
              {(selected.status === "PENDING" ||
                (selected.proofFile && !selected.sandbox)) &&
                selected.bookingReference &&
                ` · ${selected.bookingReference}`}
            </DialogDescription>
            <div className="border border-transparent px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-[#475569]">
                  {selected.status === "PENDING"
                    ? "Amount due"
                    : "Payment amount"}
                </p>
                <Pill tone={paymentStatus(selected).tone}>
                  {paymentStatus(selected).label}
                </Pill>
              </div>
              <p
                className={`mt-1 text-2xl tracking-tight text-[#203f8c] tabular-nums ${selected.status === "VERIFIED" ? "font-extrabold" : "font-bold"}`}
              >
                {formatAmount(selected)}
              </p>
              {selected.status === "SUBMITTED" && (
                <p className="mt-2 text-xs leading-5 text-[#475569]">
                  The team will verify your payment within 1 business day.
                </p>
              )}
              {selected.sandbox && (
                <p className="mt-2 text-xs text-[#475569]">
                  Test payment only. No money was charged.
                </p>
              )}
            </div>
            <dl
              className={`grid rounded-lg border border-[#e2e8f0] text-sm empty:hidden ${selected.status === "VERIFIED" ? "gap-5 px-4 py-5 [&_dd]:text-sm [&_dd]:leading-5 [&_dd]:font-medium" : "gap-3 px-4 py-3"}`}
            >
              {selected.bookingReference &&
                (!selected.proofFile || selected.sandbox) && (
                  <div>
                    <dt className="text-xs text-[#475569]">
                      Booking reference
                    </dt>
                    <dd className="mt-1 break-all text-xs">
                      {selected.bookingReference}
                    </dd>
                  </div>
                )}
              {selected.status === "PENDING" && selected.approvedAt && (
                <div>
                  <dt className="text-xs text-[#475569]">
                    Quotation accepted on
                  </dt>
                  <dd className="mt-1">
                    {summaryDate.format(new Date(selected.approvedAt))}
                  </dd>
                </div>
              )}
              {selected.status === "PENDING" && (
                <div>
                  <dt className="text-xs text-[#475569]">Due date</dt>
                  <dd className="mt-1">Not specified</dd>
                </div>
              )}
              {selected.proofFile && !selected.sandbox && (
                <>
                  <div>
                    <dt className="text-xs text-[#475569]">Payment method</dt>
                    <dd className="mt-1">Not recorded</dd>
                  </div>
                  {selected.submittedAt && (
                    <div>
                      <dt className="text-xs text-[#475569]">Submitted</dt>
                      <dd className="mt-1">
                        {formatDate(selected.submittedAt)}
                      </dd>
                    </div>
                  )}
                </>
              )}
              {selected.reference && (
                <div className="min-w-0">
                  <dt className="text-xs text-[#475569]">Reference</dt>
                  <dd className="mt-1 break-all text-xs">
                    {selected.reference}
                  </dd>
                </div>
              )}
              {selected.status === "VERIFIED" && selected.verifiedAt && (
                <div>
                  <dt className="text-xs text-[#475569]">Verified on</dt>
                  <dd className="mt-1">{formatDate(selected.verifiedAt)}</dd>
                </div>
              )}
              {selected.proofFile && !selected.sandbox ? (
                <ProofAttachment
                  key={selected.proofFile.id}
                  requestId={selected.requestId}
                  file={selected.proofFile}
                />
              ) : (
                selected.proofFile && (
                  <div className="min-w-0">
                    <dt className="text-xs text-[#475569]">Attached file</dt>
                    <dd className="mt-1 break-all text-xs">
                      {selected.proofFile.name}
                    </dd>
                  </div>
                )
              )}
            </dl>
            {selected.status === "PENDING" && (
              <Table className="text-sm">
                <TableHeader className="border-b border-[#e2e8f0] text-xs text-[#475569]">
                  <TableRow>
                    <TableHead
                      scope="col"
                      className="px-0 pb-2 text-left font-medium"
                    >
                      Item
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="px-0 pb-2 text-right font-medium"
                    >
                      Amount
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.lineItems && selected.lineItems.length > 1 ? (
                    selected.lineItems.map((item, index) => (
                      <TableRow
                        key={index}
                        className="border-b border-[#e2e8f0]"
                      >
                        <TableCell className="px-0 py-3 pr-3">
                          {item.description}
                        </TableCell>
                        <TableCell className="px-0 py-3 text-right tabular-nums">
                          {formatAmount({
                            amount: String(
                              item.quantity * Number(item.unitPrice),
                            ),
                            currency: selected.currency,
                          })}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="border-b border-[#e2e8f0]">
                      <TableCell className="px-0 py-3 pr-3">
                        {selected.serviceName}
                      </TableCell>
                      <TableCell className="px-0 py-3 text-right tabular-nums">
                        {formatAmount(selected)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {selected.lineItems && selected.lineItems.length > 1 && (
                  <tfoot className="font-semibold">
                    <tr>
                      <th scope="row" className="pt-3 text-left">
                        Total due
                      </th>
                      <td className="pt-3 text-right tabular-nums">
                        {formatAmount(selected)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </Table>
            )}
            {downloadError && <Alert variant="text">{downloadError}</Alert>}
            <DialogFooter className="flex-row flex-wrap justify-between gap-2 sm:justify-between sm:space-x-0 [&>*:nth-child(2)]:ml-auto">
              <Button asChild variant="outline" className="text-xs">
                <Link href={conversationHref(selected.requestId)}>
                  Go to chats
                </Link>
              </Button>
              {selected.status === "PENDING" && (
                <Button asChild variant="brand" className="text-xs">
                  <Link
                    href={`${conversationHref(selected.requestId)}#workflow-${encodeURIComponent(selected.id)}`}
                  >
                    Pay {formatAmount(selected)}
                  </Link>
                </Button>
              )}
              {selected.status !== "PENDING" && selected.proofFile && (
                <Button
                  type="button"
                  disabled={downloading}
                  onClick={() => void downloadSelected()}
                  variant="brand"
                  className="text-xs"
                >
                  <Download size={15} aria-hidden="true" />
                  {downloading
                    ? "Downloading…"
                    : selected.sandbox
                      ? "Download receipt"
                      : "Download proof"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </main>
  )
}
