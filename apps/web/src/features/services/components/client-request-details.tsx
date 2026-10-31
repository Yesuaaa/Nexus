import { useRef } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { useAnimatedPanelClose } from "@/components/ui/use-animated-panel-close"
import type { ServiceRequestSummary } from "../api/client-services-api"
import {
  requestDate,
  serviceRequestStatuses,
} from "../model/service-request-status"
import { RequestStatus } from "./client-requests-table"
import { RequestMessagesLink } from "@/features/request-conversations/components/request-messages-link"

export function ClientRequestDetails({
  request,
  onClose,
}: {
  request: ServiceRequestSummary
  onClose: () => void
}) {
  const { open, handleOpenChange } = useAnimatedPanelClose(onClose)
  const opener = useRef(
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
    ["Submitted", requestDate(request.createdAt)],
    ["Last updated", requestDate(request.updatedAt)],
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
        overlayClassName="nexus-panel-overlay bg-[rgb(15_23_42_/_35%)]"
        className="nexus-side-panel flex w-[min(520px,100vw)] flex-col gap-0 border-[#dfe6eb] p-0 sm:max-w-[520px]"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (
            opener.current instanceof HTMLElement &&
            opener.current.isConnected
          )
            opener.current.focus()
        }}
      >
        <header className="border-b border-[#e8ebef] px-6 py-5 pr-12">
          <SheetTitle className="break-words text-lg tracking-[-0.025em]">
            {request.title}
          </SheetTitle>
          <SheetDescription className="mt-1 break-all text-xs text-[#738096]">
            {request.referenceNumber || request.id}
          </SheetDescription>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <RequestStatus status={request.status} />
          <p className="mt-2 text-xs leading-5 text-[#52627a]">
            {serviceRequestStatuses[request.status].description}
          </p>
          <dl>
            {details.map(([label, value]) => (
              <div key={label} className="border-b border-[#eceef1] py-3">
                <dt className="text-[11px] text-[#738096]">{label}</dt>
                <dd className="mt-1 ml-0 break-words text-xs font-medium">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 rounded-lg bg-[#f1f5fb] p-3 text-xs leading-5 text-[#52627a]">
            Specialist preferences are subject to availability. The Department
            Manager makes the final assignment.
          </p>
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
                <section key={label} className="mt-5">
                  <h3 className="text-xs font-semibold">{label}</h3>
                  <p className="whitespace-pre-wrap break-words text-xs leading-6 text-[#52627a]">
                    {value}
                  </p>
                </section>
              ),
          )}
          <RequestMessagesLink requestId={request.id} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
