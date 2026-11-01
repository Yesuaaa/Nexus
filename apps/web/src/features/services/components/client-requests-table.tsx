import Link from "next/link"
import { Eye, MessageSquare, X } from "lucide-react"
import { useState } from "react"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { cancelClientServiceRequest } from "../api/client-services-api"
import { Button } from "@/components/ui/button"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { Pill } from "@/components/ui/pill"
import { rowActionButton } from "@/components/ui/row-action-styles"
import type { ServiceRequestSummary } from "../api/client-services-api"
import {
  requestDate,
  serviceRequestStatuses,
} from "../model/service-request-status"

function RequestActions({
  request,
  onView,
  compact = false,
  onCancelled,
}: {
  request: ServiceRequestSummary
  onView: (request: ServiceRequestSummary) => void
  compact?: boolean
  onCancelled: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  async function cancelRequest() {
    setPending(true)
    setError("")
    try {
      await cancelClientServiceRequest(request)
      setConfirming(false)
      onCancelled()
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not cancel this request.",
      )
    } finally {
      setPending(false)
    }
  }
  const chatAvailable = Boolean(request.acceptedDepartmentId)
  const chatHint =
    "Chat becomes available when a department accepts your request."
  const buttonClass = compact
    ? rowActionButton
    : "min-h-11 w-full min-w-0 px-2 text-xs"
  return (
    <div
      className={
        compact
          ? "flex items-center gap-2"
          : "grid w-full min-w-0 grid-cols-2 gap-2"
      }
    >
      <Button
        variant="outline"
        className={buttonClass}
        aria-label={`View request: ${request.title}`}
        onClick={() => onView(request)}
      >
        <Eye size={15} aria-hidden="true" />
        {!compact && "View request"}
        {compact && <HoverTooltip>View request</HoverTooltip>}
      </Button>
      {chatAvailable ? (
        <Button asChild variant="outline" className={buttonClass}>
          <Link
            href={`/messages?request=${encodeURIComponent(request.id)}`}
            aria-label={`Go to chat: ${request.title}`}
          >
            <MessageSquare size={15} aria-hidden="true" />
            {!compact && "Go to chat"}
            {compact && <HoverTooltip>Go to chat</HoverTooltip>}
          </Link>
        </Button>
      ) : (
        <span
          tabIndex={0}
          className="min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-[#294a9b]"
        >
          <Button
            disabled
            variant="outline"
            className={buttonClass}
            aria-label={`Go to chat unavailable. ${chatHint}`}
          >
            <MessageSquare size={15} aria-hidden="true" />
            {!compact && "Go to chat"}
            {compact && <HoverTooltip>Go to chat</HoverTooltip>}
          </Button>
          <HoverTooltip>{chatHint}</HoverTooltip>
          <span className="sr-only">{chatHint}</span>
        </span>
      )}
      {!["CLOSED", "CANCELLED"].includes(request.status) && (
        <Button
          variant="outline"
          className={`${buttonClass} ${compact ? "" : "col-span-2"} text-[#bc3649] hover:text-[#a42f40]`}
          aria-label={`Cancel request: ${request.title}`}
          onClick={() => {
            setError("")
            setConfirming(true)
          }}
        >
          <X size={15} aria-hidden="true" />
          {!compact && "Cancel request"}
          {compact && <HoverTooltip>Cancel request</HoverTooltip>}
        </Button>
      )}
      {confirming && (
        <ConfirmationDialog
          title="Cancel this request?"
          subject={request.title}
          description="Your request will be cancelled. This action cannot be undone."
          confirmLabel="Cancel request"
          pendingLabel="Cancelling…"
          pending={pending}
          error={error}
          onClose={() => setConfirming(false)}
          onConfirm={() => void cancelRequest()}
        />
      )}
    </div>
  )
}

export function RequestStatus({
  status,
}: {
  status: ServiceRequestSummary["status"]
}) {
  const value = serviceRequestStatuses[status]
  return <Pill className={value.className}>{value.label}</Pill>
}

export function ClientRequestsTable({
  requests,
  onView,
  onCancelled,
}: {
  requests: ServiceRequestSummary[]
  onView: (request: ServiceRequestSummary) => void
  onCancelled: () => void
}) {
  return (
    <>
      <div className="overflow-hidden rounded-lg border border-[#e8ebef] bg-background @max-[900px]:hidden">
        <table className="w-full table-fixed border-collapse text-left text-xs text-foreground">
          <caption className="sr-only">Your service requests</caption>
          <thead className="bg-[#e8eef2] text-foreground">
            <tr>
              {[
                "Request",
                "Service & package",
                "Status",
                "Submitted",
                "Actions",
              ].map((label, index) => (
                <th
                  key={index}
                  scope="col"
                  className={
                    index === 4
                      ? "h-[39px] w-40 border-b border-[#dfe6eb] px-3 text-left align-middle text-xs font-semibold"
                      : "h-[39px] border-b border-[#dfe6eb] px-4 text-left align-middle text-xs font-semibold"
                  }
                >
                  {label || <span className="sr-only">Actions</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr
                key={request.id}
                className="h-[58px] border-b border-[#eceef1] align-middle transition-colors last:border-b-0 hover:bg-[#e8eef2]"
              >
                <td className="px-4 py-[7px] align-middle">
                  <button
                    onClick={() => onView(request)}
                    className="cursor-pointer rounded text-left font-semibold text-[#244993] hover:underline focus-visible:outline-2 focus-visible:outline-[#294c96]"
                  >
                    {request.title}
                  </button>
                  <p className="mt-1 mb-0 break-all text-[10px] text-[#738096]">
                    {request.referenceNumber || request.id}
                  </p>
                </td>
                <td className="px-4 py-[7px] align-middle">
                  <span className="block break-words font-medium">
                    {request.service.name}
                  </span>
                  <span className="mt-1 block text-[11px] text-[#738096]">
                    {request.packageName ||
                      request.package?.name ||
                      "Standard service"}
                  </span>
                </td>
                <td className="px-4 py-[7px] align-middle">
                  <RequestStatus status={request.status} />
                </td>
                <td className="px-4 py-[7px] align-middle text-[#52627a]">
                  <time dateTime={request.createdAt}>
                    {requestDate(request.createdAt)}
                  </time>
                </td>
                <td className="px-3 py-[7px] align-middle">
                  <RequestActions
                    request={request}
                    onView={onView}
                    onCancelled={onCancelled}
                    compact
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        className="hidden gap-3 @max-[900px]:grid"
        role="list"
        aria-label="Your service requests"
      >
        {requests.map((request) => (
          <article
            key={request.id}
            role="listitem"
            className="min-w-0 rounded-lg border border-[#e8ebef] bg-background p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="m-0 min-w-0 break-words text-sm font-semibold">
                {request.title}
              </h2>
              <RequestStatus status={request.status} />
            </div>
            <p className="mt-1 mb-3 break-all text-[10px] text-[#738096]">
              {request.referenceNumber || request.id}
            </p>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-[#738096]">Service</dt>
                <dd className="mt-1 ml-0 break-words font-medium">
                  {request.service.name}
                </dd>
              </div>
              <div>
                <dt className="text-[#738096]">Package</dt>
                <dd className="mt-1 ml-0 break-words font-medium">
                  {request.packageName ||
                    request.package?.name ||
                    "Standard service"}
                </dd>
              </div>
            </dl>
            <div className="mt-4 space-y-3 border-t border-[#eceef1] pt-3">
              <time
                className="block text-[11px] whitespace-nowrap text-[#52627a]"
                dateTime={request.createdAt}
              >
                {requestDate(request.createdAt)}
              </time>
              <RequestActions
                request={request}
                onView={onView}
                onCancelled={onCancelled}
              />
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
