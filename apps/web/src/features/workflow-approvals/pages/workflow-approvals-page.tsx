"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ShieldCheck } from "lucide-react"
import { contentClass, focusRing } from "@/components/layout/styles"
import { apiRequest } from "@/features/auth/api/auth-api"
import { useRequestWorkflow } from "@/features/request-workflow/hooks/use-request-workflow"
import {
  AgreementCard,
  PaymentVerificationCard,
  QuotationProposalCard,
} from "@/features/request-workflow/components/workflow-cards"

type ApprovalRequest = {
  id: string
  title: string
  referenceNumber: string | null
  serviceName: string
  state: string
  awaitingQuotation: boolean
  awaitingPayment: boolean
}

function ApprovalReview({ requestId }: { requestId: string }) {
  const controls = useRequestWorkflow(requestId)
  const { workflow, loading, error } = controls
  return (
    <section
      aria-label="Assigned workflow review"
      className="min-w-0 p-6 max-[767px]:p-4"
    >
      {loading && (
        <p role="status" className="text-xs text-muted-foreground">
          Loading review…
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      {workflow && (
        <>
          <header className="mb-5 border-b border-border pb-4">
            <p className="m-0 text-xs text-muted-foreground">
              {workflow.request.referenceNumber || "Service request"} ·{" "}
              {workflow.request.serviceName}
            </p>
            <h2 className="mt-2 mb-1 text-lg font-semibold">
              {workflow.request.title}
            </h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {workflow.nextAction}
            </p>
            <p className="m-0 text-[11px] text-muted-foreground">
              Only explicitly assigned approvals are available here.
            </p>
          </header>
          <div className="grid gap-5 xl:grid-cols-2">
            <section
              aria-label="Quotation review"
              className="min-w-0 space-y-4"
            >
              {workflow.quotations.length ? (
                [...workflow.quotations]
                  .reverse()
                  .map((quotation) => (
                    <QuotationProposalCard
                      key={quotation.id}
                      quotation={quotation}
                      workflow={workflow}
                      controls={controls}
                    />
                  ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  No quotation is ready for review.
                </p>
              )}
            </section>
            <section aria-label="Payment review" className="min-w-0 space-y-5">
              {workflow.payment ? (
                <PaymentVerificationCard
                  workflow={workflow}
                  controls={controls}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Payment review becomes available after formal client approval.
                </p>
              )}
              {workflow.permissions.verifyPayment && workflow.agreement && (
                <>
                  {workflow.agreement.status === "PENDING" &&
                    [
                      "AGREEMENT_PAYMENT_PENDING",
                      "READY_FOR_ACTIVATION",
                    ].includes(workflow.state) && (
                      <label className="grid gap-2 rounded-xl border border-border p-4 text-xs font-medium">
                        Upload agreement document
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.txt"
                          disabled={controls.busy}
                          className="min-w-0 max-w-full text-[11px] font-normal"
                          onChange={async (event) => {
                            const input = event.currentTarget
                            const file = input.files?.[0]
                            if (file && (await controls.attach(file)))
                              input.value = ""
                          }}
                        />
                        <span className="text-[10px] font-normal text-muted-foreground">
                          PDF, PNG, JPEG, or plain text up to 5 MB. Upload, then
                          attach the selected document below.
                        </span>
                      </label>
                    )}
                  <AgreementCard workflow={workflow} controls={controls} />
                </>
              )}
            </section>
          </div>
          {workflow.internal?.events.length ? (
            <details className="mt-6 rounded-xl border border-border p-4">
              <summary className="cursor-pointer text-xs font-semibold">
                Review activity
              </summary>
              <ol className="mt-4 list-none space-y-3 p-0">
                {workflow.internal.events.map((event) => (
                  <li key={event.id} className="text-xs leading-5">
                    <p className="m-0 whitespace-pre-wrap">{event.summary}</p>
                    <time
                      dateTime={event.createdAt}
                      className="text-[10px] text-muted-foreground"
                    >
                      {new Date(event.createdAt).toLocaleString("en-PH")}
                    </time>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </>
      )}
    </section>
  )
}

export function WorkflowApprovalsPage({
  requestId,
}: {
  requestId: string | null
}) {
  const [requests, setRequests] = useState<ApprovalRequest[] | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const result = await apiRequest<{ requests: ApprovalRequest[] }>(
          "/api/request-workflows/approvals",
          { signal: controller.signal },
        )
        if (!controller.signal.aborted) {
          setRequests(result.requests)
          setError("")
        }
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Couldn't load assigned approvals.",
          )
      }
    }
    void load()
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load()
    }, 15_000)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [])
  return (
    <main
      className={`${contentClass} grid overflow-hidden lg:grid-cols-[270px_minmax(0,1fr)]`}
      aria-label="Workflow approvals"
    >
      <nav
        aria-label="Assigned approvals"
        className="border-b border-border p-4 lg:border-r lg:border-b-0"
      >
        <h1 className="mt-1 mb-2 flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck size={18} aria-hidden="true" />
          Workflow approvals
        </h1>
        <p className="mt-0 mb-5 text-[11px] leading-5 text-muted-foreground">
          Requests assigned to you for quotation or payment review.
        </p>
        {error ? (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        ) : requests === null ? (
          <p role="status" className="text-xs text-muted-foreground">
            Loading assigned requests…
          </p>
        ) : requests.length === 0 ? (
          <p className="text-xs leading-5 text-muted-foreground">
            You have no assigned requests.
          </p>
        ) : (
          requests.map((request) => (
            <Link
              key={request.id}
              href={`/workflow-approvals?request=${encodeURIComponent(request.id)}`}
              aria-current={requestId === request.id ? "page" : undefined}
              className={`${focusRing} mb-2 block rounded-xl p-3 text-foreground no-underline hover:bg-[#e9eef5] ${requestId === request.id ? "bg-[#e9eef5]" : ""}`}
            >
              <span className="block text-xs font-semibold">
                {request.title}
              </span>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {request.serviceName}
              </span>
              <span className="mt-2 block text-[10px] text-[#203f8c]">
                {[
                  request.awaitingQuotation && "Quotation approval",
                  request.awaitingPayment && "Payment verification",
                ]
                  .filter(Boolean)
                  .join(" · ") || request.state.replaceAll("_", " ")}
              </span>
            </Link>
          ))
        )}
      </nav>
      {requestId ? (
        <ApprovalReview key={requestId} requestId={requestId} />
      ) : (
        <div className="grid min-h-64 place-content-center p-6 text-center">
          <ShieldCheck
            className="mx-auto mb-3 text-[#203f8c]"
            aria-hidden="true"
            size={30}
          />
          <h2 className="text-base font-semibold">
            Select an assigned request
          </h2>
          <p className="max-w-80 text-xs leading-6 text-muted-foreground">
            Review quotations and submitted payment evidence using the assigned
            approval controls.
          </p>
        </div>
      )}
    </main>
  )
}
