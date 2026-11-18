"use client"

import { PageHeader } from "@/components/layout/page-header"
import { PageHeaderLink } from "@/components/layout/page-header-link"
import { contentClass } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import { FiguresRow, ItemList, Section } from "@/components/ui/overview-panel"
import { requestDate } from "@/features/services/model/service-request-status"
import { useAsyncResource } from "@/lib/use-async-resource"
import { cn } from "@/lib/utils"
import { getInboxOverview } from "../api/request-inbox-api"

const statusLabels: Record<string, string> = {
  SUBMITTED: "Pending",
  UNDER_REVIEW: "Under Review",
  ACTIVATED: "Activated",
  CONCLUDED: "Concluded",
  AWAITING_CLIENT_INFO: "Awaiting client information",
  READY_FOR_QUOTATION: "Ready for quotation",
  CLOSED: "Cancelled",
  CANCELLED: "Cancelled",
}

export function RequestInboxOverviewPage() {
  const overview = useAsyncResource(getInboxOverview, [], {
    fallbackError: "Couldn't load the request overview.",
  })
  const data = overview.data
  const count = (status: string) => data?.statusCounts[status] ?? 0
  const pending = count("SUBMITTED")
  const underReview = count("UNDER_REVIEW")
  const activated = count("ACTIVATED")

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Request overview"
    >
      <PageHeader
        title="Request Overview"
        description={`A department-only summary for ${
          data?.department.name ?? "your inbox"
        }.`}
        actions={
          <PageHeaderLink href="/request-inbox">Open inbox</PageHeaderLink>
        }
      />
      {overview.error && (
        <Alert className="mt-[18px]">
          {overview.error}{" "}
          <button
            type="button"
            className="cursor-pointer font-semibold underline"
            onClick={overview.retry}
          >
            Try again
          </button>
        </Alert>
      )}
      <FiguresRow
        label="Department request figures"
        loading={overview.loading}
        items={[
          {
            label: "Awaiting action",
            value: String(pending),
            note: pending ? "Needs review" : undefined,
            tone: pending ? "warning" : undefined,
          },
          { label: "Under review", value: String(underReview) },
          { label: "Active", value: String(activated) },
          { label: "Total visible", value: String(data?.total ?? 0) },
        ]}
      />
      <Section
        title="Recent inbox requests"
        aside={data ? `${data.total} total visible` : undefined}
        description="Latest requests that are visible to your department."
        className="mt-7"
      >
        <ItemList
          loading={overview.loading}
          empty={
            overview.error
              ? "Recent requests are unavailable."
              : "No requests are visible to your department."
          }
          rows={(data?.recentRequests ?? []).map((request) => ({
            id: request.id,
            label: `${request.service.name} · ${
              request.referenceNumber ?? request.id
            }`,
            note: `${
              statusLabels[request.status] ?? request.status
            } · ${requestDate(request.createdAt)}`,
            tone:
              request.status === "SUBMITTED"
                ? "warning"
                : request.status === "CLOSED" || request.status === "CANCELLED"
                  ? "danger"
                  : "muted",
          }))}
          emptyTone="success"
        />
      </Section>
    </main>
  )
}
