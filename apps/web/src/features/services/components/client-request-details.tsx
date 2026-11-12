import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import {
  SidePanel,
  SidePanelBody,
  SidePanelHeader,
  useSidePanel,
} from "@/components/ui/side-panel"
import { RequestDetailsBody } from "@/features/bookings/components/request-details-body"
import type { ServiceRequestSummary } from "../api/client-services-api"
import { serviceRequestStatuses } from "../model/service-request-status"
import { RequestStatus } from "./client-requests-table"

export function ClientRequestDetails({
  request,
  onClose,
}: {
  request: ServiceRequestSummary
  onClose: () => void
}) {
  const { formatDate } = useDatePreferences()
  const panel = useSidePanel(onClose)
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
  const sections: [string, string | null][] = [
    ["Project goals", request.projectGoals],
    [
      "Project requirements",
      request.projectRequirements || request.description,
    ],
    ["Additional details", request.additionalDetails],
  ]

  return (
    <SidePanel open={panel.open} onOpenChange={panel.onOpenChange}>
      <SidePanelHeader
        title="Request details"
        description="Your submitted service request and preferences."
        closeLabel="Close"
      />
      <SidePanelBody>
        <RequestDetailsBody
          title={request.title || request.service.name}
          status={<RequestStatus status={request.status} />}
          statusNote={serviceRequestStatuses[request.status].description}
          fields={[
            ["Service", request.service.name],
            [
              "Package",
              request.packageName ||
                request.package?.name ||
                "Standard service",
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
          ]}
          sections={sections.filter(([, value]) => value)}
          note="Specialist preferences are subject to availability. The Department Manager makes the final assignment."
          messagesRequestId={request.id}
        />
      </SidePanelBody>
    </SidePanel>
  )
}
