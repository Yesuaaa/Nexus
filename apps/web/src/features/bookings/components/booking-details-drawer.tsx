"use client"

import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { BriefcaseBusiness } from "lucide-react"

import type { ReactNode } from "react"
import { getBooking, type BookingDetails } from "../api/bookings-api"
import { BookingStatusPill } from "./booking-status-pill"
import { RequestDetailsBody } from "./request-details-body"
import { RequestDetailsDrawer } from "./request-details-drawer"
import { serviceRequestStatuses } from "../../services/model/service-request-status"

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
  panelStyle = "booking",
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
  /** Uses the Service Management-style header and detail layout for staff inboxes. */
  panelStyle?: "booking" | "management"
}) {
  const { formatDate } = useDatePreferences()
  const managementStyle = panelStyle === "management"
  return (
    <RequestDetailsDrawer
      id={id}
      onClose={onClose}
      loadDetails={loadDetails}
      title={
        managementStyle ? (details) => details.service.name : "Booking details"
      }
      description={
        managementStyle
          ? (details) =>
              `${details.referenceNumber || details.id} Â· Service request`
          : description
      }
      fallbackTitle={managementStyle ? "Request details" : "Booking details"}
      fallbackDescription={
        managementStyle ? "Loading service request detailsâ€¦" : description
      }
      leading={
        managementStyle ? (
          <span
            className="grid size-11 flex-none place-items-center rounded-xl bg-[#e5edff] text-[#2058d4]"
            aria-hidden="true"
          >
            <BriefcaseBusiness size={20} />
          </span>
        ) : undefined
      }
      meta={
        managementStyle
          ? (details) => (
              <BookingStatusPill
                status={details.status}
                label={statusLabels?.[details.status]}
              />
            )
          : undefined
      }
      closeLabel={
        managementStyle ? "Close request details" : "Close booking details"
      }
      closeDisabled={closeDisabled}
      fallbackFocusId={fallbackFocusId}
      refreshKey={refreshKey}
      onLoaded={onLoaded}
      renderActions={renderActions}
      renderBody={(details) => (
        <RequestDetailsBody
          title={details.service.name}
          statusNote={serviceRequestStatuses[details.status].description}
          status={
            <BookingStatusPill
              status={details.status}
              label={statusLabels?.[details.status]}
            />
          }
          fields={[
            ...additionalFields,
            ["Request reference", details.referenceNumber || details.id],
            ...(managementStyle
              ? [
                  [
                    "Status",
                    <BookingStatusPill
                      key="status"
                      status={details.status}
                      label={statusLabels?.[details.status]}
                    />,
                  ] as [string, ReactNode],
                ]
              : []),
            ["Package", details.packageName || "Standard service"],
            ["Date requested", formatDate(details.createdAt)],
            ["Last updated", formatDate(details.updatedAt)],
            ["Expected timeline", details.expectedTimeline || "Not specified"],
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
          detailLayout={managementStyle ? "inline" : "stacked"}
          detailSectionTitle={
            managementStyle ? "Request information" : undefined
          }
          showIntro={!managementStyle}
          note={
            managementStyle
              ? "Specialist preferences are subject to availability and department approval. An expected timeline is the client's requested schedule."
              : "Specialist preferences are subject to availability and department approval. An expected timeline is your requested schedule."
          }
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
      )}
    />
  )
}
