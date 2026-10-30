"use client"

import { useEffect, useRef } from "react"
import { CheckCircle2 } from "lucide-react"
import { focusRing } from "@/components/layout/styles"
import { cn } from "@/lib/utils"
import type { ServiceRequestReceipt } from "../api/services-api"

export function ServiceRequestConfirmation({
  receipt,
  serviceName,
  packageName,
  specialistName,
  onNewRequest,
}: {
  receipt: ServiceRequestReceipt
  serviceName: string
  packageName: string
  specialistName: string | null
  onNewRequest: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
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
      <span className="inline-block rounded-full bg-[#fff4d6] px-3 py-1 text-xs font-semibold text-[#755400]">
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
            <dt className="text-[10px] font-bold tracking-[0.12em] text-[#687e9e] uppercase">
              {label}
            </dt>
            <dd className="mt-1 ml-0 text-sm leading-6 font-semibold text-[#243c69] [overflow-wrap:anywhere]">
              {text}
            </dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={onNewRequest}
        className={cn(
          "mt-4 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-0 bg-[#294c96] px-5 text-sm font-bold text-white hover:bg-[#203f80] max-[560px]:w-full",
          focusRing,
        )}
      >
        Start another request
      </button>
    </section>
  )
}
