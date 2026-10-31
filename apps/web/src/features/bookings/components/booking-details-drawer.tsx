"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { rowActionButton } from "@/components/ui/row-action-styles"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { useAnimatedPanelClose } from "@/components/ui/use-animated-panel-close"
import { cn } from "@/lib/utils"
import { getBooking, type BookingDetails } from "../api/bookings-api"
import { bookingDate } from "../model/booking-status"
import { BookingStatusPill } from "./booking-status-pill"
import { RequestMessagesLink } from "@/features/request-conversations/components/request-messages-link"

export function BookingDetailsDrawer({
  id,
  onClose,
  loadDetails = getBooking,
  additionalFields = [],
  renderActions,
  description = "Your submitted service request and preferences.",
  refreshKey = 0,
  fallbackFocusId = "booked-services-heading",
  closeDisabled = false,
  showMessagesLink = true,
}: {
  id: string
  onClose: () => void
  loadDetails?: (id: string) => Promise<BookingDetails>
  additionalFields?: [string, string][]
  renderActions?: (details: BookingDetails) => ReactNode
  description?: string
  refreshKey?: number
  fallbackFocusId?: string
  closeDisabled?: boolean
  showMessagesLink?: boolean | ((details: BookingDetails) => boolean)
}) {
  const { open, handleOpenChange } = useAnimatedPanelClose(onClose)
  const openerRef = useRef(
    typeof document === "undefined" ? null : document.activeElement,
  )
  const [details, setDetails] = useState<BookingDetails | null>(null)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)
  const [resolvedKey, setResolvedKey] = useState("")
  const requestKey = `${id}:${revision}:${refreshKey}`
  const loading = resolvedKey !== requestKey
  useEffect(() => {
    let active = true
    loadDetails(id)
      .then((value) => {
        if (!active) return
        setDetails(value)
        setError("")
        setResolvedKey(requestKey)
      })
      .catch((reason: unknown) => {
        if (!active) return
        setError(
          reason instanceof Error
            ? reason.message
            : "Couldn't load your booking.",
        )
        setResolvedKey(requestKey)
      })
    return () => {
      active = false
    }
  }, [id, revision, requestKey, loadDetails])

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!closeDisabled) handleOpenChange(nextOpen)
      }}
    >
      <SheetContent
        showCloseButton={false}
        overlayClassName="nexus-panel-overlay bg-[rgb(13_28_57_/_40%)]"
        className="nexus-side-panel inset-y-auto top-[15px] right-[15px] flex h-[calc(100dvh-30px)] max-h-none w-[min(600px,calc(100vw-30px))] max-w-none flex-col gap-0 overflow-hidden rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_16px_60px_rgb(18_36_73_/_18%)] sm:max-w-none max-[560px]:top-0 max-[560px]:right-0 max-[560px]:h-dvh max-[560px]:w-full max-[560px]:rounded-none max-[560px]:border-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const opener = openerRef.current
          if (
            opener instanceof HTMLElement &&
            opener.isConnected &&
            opener !== document.body
          )
            opener.focus()
          else
            (
              document.getElementById(`booking-view-${id}`) ??
              document.getElementById(fallbackFocusId)
            )?.focus()
        }}
      >
        <header className="flex flex-none items-start justify-between gap-4 border-b border-[#eceef1] px-6 pt-6 pb-5 max-[560px]:px-5">
          <div className="min-w-0">
            <SheetTitle className="m-0 text-[22px] leading-[1.25] font-[650] tracking-[-0.03em]">
              Booking details
            </SheetTitle>
            <SheetDescription className="mt-1 text-xs text-[#52627a]">
              {description}
            </SheetDescription>
          </div>
          <SheetClose asChild>
            <button
              type="button"
              aria-label="Close booking details"
              disabled={closeDisabled}
              className={cn(rowActionButton, "max-[560px]:size-11")}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </SheetClose>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 max-[560px]:px-5">
          {loading ? (
            <p
              role="status"
              className="py-8 text-center text-xs text-[#52627a]"
            >
              Loading booking details…
            </p>
          ) : error ? (
            <div
              role="alert"
              className="grid justify-items-center gap-3 py-8 text-center text-xs text-[#52627a]"
            >
              <p>{error}</p>
              <Button
                variant="outline"
                className="text-xs"
                onClick={() => setRevision((value) => value + 1)}
              >
                Try again
              </Button>
            </div>
          ) : (
            details && (
              <>
                <h2 className="m-0 text-base font-semibold break-words">
                  {details.service.name}
                </h2>
                <div className="mt-3">
                  <BookingStatusPill status={details.status} />
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-x-5 max-[450px]:grid-cols-1">
                  {[
                    ...additionalFields,
                    ["Request reference", details.id],
                    ["Package", details.packageName || "Standard service"],
                    ["Date requested", bookingDate(details.createdAt)],
                    ["Last updated", bookingDate(details.updatedAt)],
                    [
                      "Expected timeline",
                      details.expectedTimeline || "Not specified",
                    ],
                    [
                      "Preferred specialist",
                      details.preferredSpecialistName || "Department to assign",
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="min-w-0 border-b border-[#eceef1] py-3"
                    >
                      <dt className="text-[11px] text-[#52627a]">{label}</dt>
                      <dd className="mt-1.5 ml-0 text-xs font-medium [overflow-wrap:anywhere]">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-6 space-y-6">
                  {[
                    ["Project goals", details.projectGoals],
                    ["Project requirements", details.projectRequirements],
                    ["Additional details", details.additionalDetails],
                  ].map(([title, value]) => (
                    <section key={title}>
                      <h3 className="m-0 text-xs font-semibold">{title}</h3>
                      <p className="mt-2 mb-0 text-xs leading-6 whitespace-pre-wrap text-[#52627a] [overflow-wrap:anywhere]">
                        {value || "Not provided"}
                      </p>
                    </section>
                  ))}
                </div>
                <p className="mt-6 rounded-lg bg-[#f8fafd] p-3 text-[11px] leading-relaxed text-[#52627a]">
                  Specialist preferences are subject to availability and
                  department approval. An expected timeline is your requested
                  schedule.
                </p>
                {(typeof showMessagesLink === "function"
                  ? showMessagesLink(details)
                  : showMessagesLink) && (
                  <RequestMessagesLink requestId={details.id} />
                )}
              </>
            )
          )}
        </div>
        {!loading && !error && details && renderActions && (
          <footer className="flex-none border-t border-[#eceef1] px-6 py-4 max-[560px]:px-5">
            {renderActions(details)}
          </footer>
        )}
      </SheetContent>
    </Sheet>
  )
}
