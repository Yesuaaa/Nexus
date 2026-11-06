"use client"

import type { ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Workflow } from "../model/workflow"

export function WorkflowDraftFrame({
  title,
  booking,
  status,
  internal = false,
  description,
  onClose,
  closeDisabled = false,
  children,
}: {
  title: string
  booking?: Pick<Workflow["request"], "id" | "serviceName" | "referenceNumber">
  status?: string
  internal?: boolean
  description?: string
  onClose: () => void
  closeDisabled?: boolean
  children: ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="mx-5 mb-2 max-h-[min(45dvh,400px)] overflow-y-auto overscroll-contain rounded-xl border border-[#d8e1ef] bg-white px-4 py-3 shadow-[0_2px_8px_rgb(18_36_73_/_4%)] max-[767px]:mx-3"
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="m-0 text-sm font-semibold text-[#182235]">
              {title}
            </h2>
            {internal ? (
              <span className="rounded-full bg-[#fff3e0] px-2.5 py-1 text-[9px] font-semibold tracking-wide text-[#9a4f00]">
                INTERNAL · STAFF ONLY
              </span>
            ) : (
              status && (
                <span className="text-[10px] text-[#8791a2]">{status}</span>
              )
            )}
          </div>
          {booking && (
            <p className="mt-1 mb-0 text-[10px] font-medium text-[#294a9b]">
              {booking.serviceName} · {booking.referenceNumber || booking.id}
            </p>
          )}
          {description && (
            <p className="mt-1 mb-0 text-[11px] leading-5 text-[#52627a]">
              {description}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          aria-label={`Close ${title.toLowerCase()} draft`}
          className="size-8 shrink-0 border-0 bg-transparent p-0 text-[#52627a] hover:bg-[#f1f4fa]"
          onClick={onClose}
          disabled={closeDisabled}
        >
          <X size={16} aria-hidden="true" />
        </Button>
      </header>
      {children}
    </section>
  )
}
