import { ClientRowTable } from "@/components/ui/client-row-table"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import Link from "next/link"
import { Eye, MessageSquare } from "lucide-react"
import { useState, type ReactNode } from "react"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { cancelClientServiceRequest } from "../api/client-services-api"
import { Button } from "@/components/ui/button"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { Pill } from "@/components/ui/pill"
import { rowActionButton } from "@/components/ui/row-action-styles"
import { RowActionsMenu } from "@/components/ui/row-actions-menu"
import type { ServiceRequestSummary } from "../api/client-services-api"
import { serviceRequestStatuses } from "../model/service-request-status"
import { ServiceIcon } from "./service-icon"
import type { ServiceIconKey } from "../api/services-api"

type RequestRowVisual = {
  iconClassName: string
  iconKey: ServiceIconKey
}

function requestRowVisual(serviceName: string): RequestRowVisual {
  const normalizedName = serviceName.toLocaleLowerCase()

  if (
    normalizedName.includes("community") ||
    normalizedName.includes("social")
  ) {
    return {
      iconClassName: "text-[#19864a]",
      iconKey: "social",
    }
  }

  if (
    normalizedName.includes("marketing") ||
    normalizedName.includes("advertising") ||
    normalizedName.includes("campaign")
  ) {
    return {
      iconClassName: "text-[#6547d7]",
      iconKey: "advertising",
    }
  }

  if (normalizedName.includes("search") || normalizedName.includes("seo")) {
    return {
      iconClassName: "text-[#245bc4]",
      iconKey: "search",
    }
  }

  if (
    normalizedName.includes("web") ||
    normalizedName.includes("development") ||
    normalizedName.includes("code")
  ) {
    return {
      iconClassName: "text-[#245bc4]",
      iconKey: "code",
    }
  }

  return {
    iconClassName: "text-[#6547d7]",
    iconKey: "business",
  }
}

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
  const requestName = request.service.name
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
        aria-label={`View request: ${requestName}`}
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
            aria-label={`Go to chat: ${requestName}`}
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
        <RowActionsMenu
          triggerLabel={`More actions for ${requestName}`}
          triggerClassName={
            !compact ? "justify-self-start max-[560px]:size-11" : undefined
          }
          items={[
            {
              action: "cancel" as const,
              label: "Cancel request",
              className:
                "text-[#c33945] focus:bg-[#fff0f1] focus:text-[#c33945]",
            },
          ]}
          onAction={(action) => {
            if (action === "cancel") {
              setError("")
              setConfirming(true)
            }
          }}
        />
      )}
      {confirming && (
        <ConfirmationDialog
          title="Cancel this request?"
          subject={requestName}
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

const requestKey = (request: ServiceRequestSummary) => request.id

export function ClientRequestsTable({
  requests,
  onView,
  onCancelled,
  viewKey,
  quickKey,
  onRowsSettled,
  emptyMessage,
}: {
  viewKey: string
  quickKey: string
  onRowsSettled?: () => void
  emptyMessage: ReactNode
  requests: ServiceRequestSummary[]
  onView: (request: ServiceRequestSummary) => void
  onCancelled: () => void
}) {
  const { formatDate } = useDatePreferences()
  return (
    <ClientRowTable
      items={requests}
      viewKey={viewKey}
      quickKey={quickKey}
      getKey={requestKey}
      caption="Your service requests"
      ariaLabel="Your service requests"
      columns={[
        { className: "w-[76px]", label: "Service icon" },
        { className: "w-[31%]", label: "Request" },
        { className: "w-[28%]", label: "Service and package" },
        { className: "w-[14%]", label: "Status" },
        { className: "w-[18%]", label: "Submitted" },
        { className: "w-[140px]", label: "Actions" },
      ]}
      emptyContent={emptyMessage}
      onRowsSettled={onRowsSettled}
      renderRow={(request) => {
        const visual = requestRowVisual(request.service.name)
        return (
          <>
            <td className="rounded-l-xl border-y border-l border-[#e1e7ef] bg-[#f4f7fb] px-3 py-2 align-middle">
              <span
                className={`request-icon-float mx-auto grid size-11 place-items-center rounded-2xl border-2 border-current ${visual.iconClassName}`}
              >
                <ServiceIcon iconKey={visual.iconKey} size={22} />
              </span>
            </td>
            <td className="border-y border-[#e1e7ef] bg-[#f4f7fb] px-4 py-2 align-middle">
              <button
                onClick={() => onView(request)}
                className="cursor-pointer rounded text-left font-semibold text-[#17243b] hover:underline focus-visible:outline-2 focus-visible:outline-[#294c96]"
              >
                {request.title || request.service.name}
              </button>
              <p className="mt-1 mb-0 break-all text-[10px] text-[#738096]">
                {request.referenceNumber || request.id}
              </p>
            </td>
            <td className="border-y border-l border-[#e7ebf1] bg-[#f4f7fb] px-4 py-2 align-middle">
              <span className="block break-words font-medium">
                {request.service.name}
              </span>
              <span className="mt-1 block text-[11px] text-[#738096]">
                {request.packageName ||
                  request.package?.name ||
                  "Standard service"}
              </span>
            </td>
            <td className="border-y border-[#e1e7ef] bg-[#f4f7fb] px-4 py-2 align-middle">
              <RequestStatus status={request.status} />
            </td>
            <td className="border-y border-[#e1e7ef] bg-[#f4f7fb] px-4 py-2 align-middle text-[#52627a]">
              <time dateTime={request.createdAt}>
                {formatDate(request.createdAt)}
              </time>
            </td>
            <td className="rounded-r-xl border-y border-r border-[#e1e7ef] bg-[#f4f7fb] px-3 py-2 align-middle">
              <RequestActions
                request={request}
                onView={onView}
                onCancelled={onCancelled}
                compact
              />
            </td>
          </>
        )
      }}
      renderMobileRow={(request) => (
        <article className="min-w-0 rounded-lg border border-[#e8ebef] bg-background p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="m-0 min-w-0 break-words text-sm font-semibold">
              {request.service.name}
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
              {formatDate(request.createdAt)}
            </time>
            <RequestActions
              request={request}
              onView={onView}
              onCancelled={onCancelled}
            />
          </div>
        </article>
      )}
    />
  )
}
