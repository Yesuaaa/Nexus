import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { useRef } from "react"
import { X } from "lucide-react"
import { rowActionButton } from "@/components/ui/row-action-styles"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { useAnimatedPanelClose } from "@/components/ui/use-animated-panel-close"
import { cn } from "@/lib/utils"
import type { ServiceRequestSummary } from "../api/client-services-api"
import { serviceRequestStatuses } from "../model/service-request-status"
import { RequestStatus } from "./client-requests-table"
import { RequestMessagesLink } from "@/features/request-conversations/components/request-messages-link"

export function ClientRequestDetails({
  request,
  onClose,
}: {
  request: ServiceRequestSummary
  onClose: () => void
}) {
  const { formatDate } = useDatePreferences()
  const { open, handleOpenChange } = useAnimatedPanelClose(onClose)
  const openerRef = useRef(
    typeof document === "undefined" ? null : document.activeElement,
  )
  const price =
    request.quotedPrice !== null &&
    request.currency &&
    request.pricingModel !== "CUSTOM_QUOTE"
      ? new Intl.NumberFormat("en-PH", {
          style: "currency",
          currency: request.currency,
        }).format(Number(request.quotedPrice))
      : "Contact for pricing"
  const suffix =
    request.pricingModel === "HOURLY"
      ? " / hour"
      : request.pricingModel === "RECURRING" && request.billingInterval
        ? ` / ${request.billingInterval.toLowerCase()}`
        : ""
  const details = [
    ["Service", request.service.name],
    [
      "Package",
      request.packageName || request.package?.name || "Standard service",
    ],
    [
      "Pricing at submission",
      `${request.pricingModel === "STARTING" && request.quotedPrice !== null ? "Starting at " : ""}${price}${request.quotedPrice !== null ? suffix : ""}`,
    ],
    ["Submitted", formatDate(request.createdAt)],
    ["Last updated", formatDate(request.updatedAt)],
    ["Expected timeline", request.expectedTimeline || "Not provided"],
    [
      "Preferred specialist",
      request.preferredSpecialistName ||
        request.preferredSpecialist?.fullName ||
        "Department to assign",
    ],
  ]
  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
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
        }}
      >
        <header className="flex flex-none items-start justify-between gap-4 border-b border-[#eceef1] px-6 pt-6 pb-5 max-[560px]:px-5">
          <div className="min-w-0">
            <SheetTitle className="m-0 text-[22px] leading-[1.25] font-[650] tracking-[-0.03em]">
              Request details
            </SheetTitle>
            <SheetDescription className="mt-1 text-xs text-[#52627a]">
              Your submitted service request and preferences.
            </SheetDescription>
          </div>
          <SheetClose asChild>
            <button
              type="button"
              aria-label="Close"
              className={cn(rowActionButton, "max-[560px]:size-11")}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </SheetClose>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 max-[560px]:px-5">
          <h2 className="m-0 text-base font-semibold break-words">
            {request.title || request.service.name}
          </h2>
          <div className="mt-3">
            <RequestStatus status={request.status} />
          </div>
          <p className="mt-2 text-xs leading-5 text-[#52627a]">
            {serviceRequestStatuses[request.status].description}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-x-5 max-[450px]:grid-cols-1">
            {details.map(([label, value]) => (
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
              ["Project goals", request.projectGoals],
              [
                "Project requirements",
                request.projectRequirements || request.description,
              ],
              ["Additional details", request.additionalDetails],
            ].map(
              ([label, value]) =>
                value && (
                  <section key={label}>
                    <h3 className="m-0 text-xs font-semibold">{label}</h3>
                    <p className="mt-2 mb-0 text-xs leading-6 whitespace-pre-wrap text-[#52627a] [overflow-wrap:anywhere]">
                      {value}
                    </p>
                  </section>
                ),
            )}
          </div>
          <p className="mt-6 rounded-lg bg-[#f8fafd] p-3 text-[11px] leading-relaxed text-[#52627a]">
            Specialist preferences are subject to availability. The Department
            Manager makes the final assignment.
          </p>
          <RequestMessagesLink requestId={request.id} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
