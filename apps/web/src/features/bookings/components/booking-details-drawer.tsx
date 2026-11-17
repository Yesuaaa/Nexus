"use client"

import { useDatePreferences } from "@/features/settings/providers/preferences-provider"

import type { ReactNode } from "react"
import {
  SidePanel,
  SidePanelBody,
  SidePanelError,
  SidePanelFooter,
  SidePanelHeader,
  useSidePanel,
} from "@/components/ui/side-panel"
import { useAsyncResource } from "@/lib/use-async-resource"
import { getBooking, type BookingDetails } from "../api/bookings-api"
import { BookingStatusPill } from "./booking-status-pill"
import { RequestDetailsBody } from "./request-details-body"

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
  statusLabels,
  onLoaded,
}: {
  id: string
  onClose: () => void
  loadDetails?: (id: string, signal?: AbortSignal) => Promise<BookingDetails>
  additionalFields?: [string, string][]
  renderActions?: (details: BookingDetails) => ReactNode
  description?: string
  /** Change to reload the details (e.g. after the list refreshes). */
  refreshKey?: number
  fallbackFocusId?: string
  /** Blocks every close path, e.g. while an action is saving. */
  closeDisabled?: boolean
  showMessagesLink?: boolean | ((details: BookingDetails) => boolean)
  onLoaded?: (details: BookingDetails) => void
  statusLabels?: Partial<Record<string, string>>
}) {
  const { formatDate } = useDatePreferences()
  const panel = useSidePanel(onClose)
  const {
    data: details,
    error,
    loading,
    retry,
  } = useAsyncResource(
    async (signal) => {
      const value = await loadDetails(id, signal)
      if (!signal.aborted) onLoaded?.(value)
      return value
    },
    [id, refreshKey],
    { fallbackError: "Couldn't load your booking." },
  )
  const ready = loading || error ? undefined : details

  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      busy={closeDisabled}
      fallbackFocus={() =>
        document.getElementById(`booking-view-${id}`) ??
        document.getElementById(fallbackFocusId)
      }
    >
      <SidePanelHeader
        title="Booking details"
        description={description}
        closeLabel="Close booking details"
        closeDisabled={closeDisabled}
      />
      <SidePanelBody>
        {loading ? (
          <p role="status" className="py-8 text-center text-xs text-[#52627a]">
            Loading booking details…
          </p>
        ) : error ? (
          <SidePanelError message={error} onRetry={retry} />
        ) : (
          details && (
            <RequestDetailsBody
              title={details.service.name}
              status={
                <BookingStatusPill
                  status={details.status}
                  label={statusLabels?.[details.status]}
                />
              }
              fields={[
                ...additionalFields,
                ["Request reference", details.referenceNumber || details.id],
                ["Package", details.packageName || "Standard service"],
                ["Date requested", formatDate(details.createdAt)],
                ["Last updated", formatDate(details.updatedAt)],
                [
                  "Expected timeline",
                  details.expectedTimeline || "Not specified",
                ],
                [
                  "Preferred specialist",
                  details.preferredSpecialistName || "Department to assign",
                ],
              ]}
              sections={[
                ["Project goals", details.projectGoals],
                ["Project requirements", details.projectRequirements],
                ["Additional details", details.additionalDetails],
              ]}
              note="Specialist preferences are subject to availability and department approval. An expected timeline is your requested schedule."
              messagesRequestId={
                (
                  typeof showMessagesLink === "function"
                    ? showMessagesLink(details)
                    : showMessagesLink
                )
                  ? details.id
                  : null
              }
            />
          )
        )}
      </SidePanelBody>
      {ready && renderActions && (
        <SidePanelFooter className="block">
          {renderActions(ready)}
        </SidePanelFooter>
      )}
    </SidePanel>
  )
}
