"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Copy } from "lucide-react"
import { focusRing } from "@/components/layout/styles"
import { cn } from "@/lib/utils"
import type { ServiceRequestReceipt } from "../api/services-api"

export function ServiceRequestConfirmation({
  receipt,
  serviceName,
  packageName,
  specialistName,
  onNewRequest,
  onBackToServices,
}: {
  receipt: ServiceRequestReceipt
  serviceName: string
  packageName: string
  specialistName: string | null
  onNewRequest: () => void
  onBackToServices?: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [copyStatus, setCopyStatus] = useState("")
  useEffect(() => {
    headingRef.current?.focus()
  }, [])
  return (
    <section
      className="mt-6 rounded-2xl border border-[#dce3ee] bg-white p-6 max-[560px]:p-5"
      aria-labelledby="request-submitted-heading"
    >
      <CheckCircle2 size={36} className="text-[#19703a]" aria-hidden="true" />
      <h2
        ref={headingRef}
        id="request-submitted-heading"
        tabIndex={-1}
        className="mt-4 mb-0 rounded text-xl font-bold text-[#101d35] outline-none"
      >
        Service request submitted for review
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#587095]">
        Your request has been received and is pending review. Specialist
        assignment remains subject to availability and Department Manager
        approval.
      </p>
      <span className="inline-block rounded-lg bg-[#fff4d6] px-3 py-1 text-sm font-semibold text-[#755400]">
        Pending review
      </span>
      <dl className="mt-6 grid grid-cols-2 gap-5 max-[600px]:grid-cols-1">
        {[
          ["Request reference", receipt.id],
          ["Service", serviceName],
          ["Package", packageName],
          ["Preferred specialist", specialistName || "Department to assign"],
        ].map(([label, text]) => (
          <div key={label}>
            <dt className="text-xs font-bold tracking-[0.08em] text-[#687e9e] uppercase">
              {label}
            </dt>
            <dd className="mt-1 ml-0 text-sm leading-6 font-semibold text-[#243c69] [overflow-wrap:anywhere]">
              {text}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(receipt.id)
              setCopyStatus("Reference copied.")
            } catch {
              setCopyStatus(
                "Couldn’t copy the reference. Select it above to copy it manually.",
              )
            }
          }}
          className={cn(
            "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#dce3ee] bg-white px-4 text-sm font-semibold text-[#294c96] hover:bg-[#f5f8fd]",
            focusRing,
          )}
        >
          <Copy size={16} aria-hidden="true" /> Copy reference
        </button>
        {copyStatus && (
          <p role="status" className="m-0 text-sm leading-6 text-[#405b80]">
            {copyStatus}
          </p>
        )}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onNewRequest}
          className={cn(
            "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-0 bg-[#294c96] px-5 text-sm font-bold text-white hover:bg-[#203f80] max-[560px]:w-full",
            focusRing,
          )}
        >
          Start another request
        </button>
        {onBackToServices && (
          <button
            type="button"
            onClick={onBackToServices}
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-[#dce3ee] bg-white px-5 text-sm font-bold text-[#294c96] hover:bg-[#f5f8fd] max-[560px]:w-full",
              focusRing,
            )}
          >
            Back to services
          </button>
        )}
      </div>
    </section>
  )
}
