"use client"

import { useState } from "react"
import Link from "next/link"
import { Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ServiceRequestReceipt } from "../api/services-api"

export function ServiceRequestConfirmation({
  receipt,
  serviceName,
  packageName,
  specialistName,
  onBackToServices,
}: {
  receipt: ServiceRequestReceipt
  serviceName: string
  packageName: string
  specialistName: string | null
  onBackToServices: () => void
}) {
  const [copyStatus, setCopyStatus] = useState("")
  const reference = receipt.referenceNumber || receipt.id

  return (
    <section className="mt-6" aria-label="Submitted request details">
      <div className="rounded-2xl border border-[#dce3ee] p-6 max-[560px]:p-4">
        <dl className="m-0 grid gap-4 sm:grid-cols-3 sm:divide-x sm:divide-[#dce3ee]">
          {[
            ["Service", serviceName],
            ["Package", packageName],
            ["Preferred specialist", specialistName || "Department to assign"],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 sm:pr-4">
              <dt className="text-xs font-semibold tracking-wide text-[#52627a] uppercase">
                {label}
              </dt>
              <dd className="mt-1 ml-0 text-sm font-semibold [overflow-wrap:anywhere]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg bg-[#e8eff5] px-4 py-3">
          <dl className="m-0 flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-black">
            <dt className="text-xs font-semibold tracking-wide uppercase">
              Reference No.
            </dt>
            <dd className="m-0 min-w-0 text-sm [overflow-wrap:anywhere]">
              {reference}
            </dd>
          </dl>
          <Button
            type="button"
            variant="outline"
            className="ml-auto border-[#203f8c] bg-white text-[#203f8c] hover:text-[#203f8c]"
            aria-label="Copy reference number"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(reference)
                setCopyStatus("Reference copied.")
              } catch {
                setCopyStatus(
                  "Couldn’t copy the reference. Select it above to copy it manually.",
                )
              }
            }}
          >
            <Copy size={16} aria-hidden="true" /> Copy
          </Button>
        </div>
        <div role="status">
          {copyStatus && <p className="mt-2 text-sm">{copyStatus}</p>}
        </div>
      </div>
      <p className="mt-5 text-sm leading-6 text-black">
        Track updates in Booked Requests. Your preferred specialist is subject
        to availability and Department Manager approval.
      </p>
      <div className="mt-5 flex flex-wrap justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          className="border-black bg-white text-black"
          onClick={onBackToServices}
        >
          Back to services
        </Button>
        <Button asChild variant="brand" className="ml-auto">
          <Link href="/service-requests">View booked requests</Link>
        </Button>
      </div>
    </section>
  )
}
