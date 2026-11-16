"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { SearchField } from "@/components/ui/search-field"
import { FilterSelect, filterBarClass } from "@/components/ui/filter-select"
import { TablePaginationFooter } from "@/components/ui/table-pagination-footer"
import { usePaginatedList } from "@/components/ui/use-paginated-list"
import { TableSearchStatus } from "@/components/ui/table-search-status"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { RequestDetailsDrawer } from "@/features/bookings/components/request-details-drawer"
import { BookingStatusPill } from "@/features/bookings/components/booking-status-pill"
import {
  DetailItem,
  DetailList,
  SidePanelSection,
  SidePanelButton,
} from "@/components/ui/side-panel"
import { EmptyState } from "@/components/ui/empty-state"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WorkflowBadge } from "@/features/request-workflow/components/workflow-primitives"
import { serviceRequestStatusValues } from "@/features/service-operations/model/service-request-contracts"
import { serviceRequestStatuses } from "@/features/services/model/service-request-status"
import { RequestInboxTable } from "../components/request-inbox-table"
import { SheetClose } from "@/components/ui/sheet"
import { ServiceIcon } from "@/features/services/components/service-icon"
import type { InboxSort } from "../api/request-inbox-api"
import {
  AdministrativeWorkflowProgress,
  AdministrativeWorkflowRecords,
} from "@/features/request-workflow/components/administrative-workflow-progress"
import {
  getAdministrativeRequest,
  listAdministrativeRequests,
  type AdministrativeRequest,
} from "../api/administrative-requests-api"

const root = "/module/service-operations"
const noop = () => {}
const requestTabPanelClassName =
  "mt-0 grid min-h-0 min-w-0 flex-1 gap-5 overflow-y-auto overscroll-contain px-6 py-5 max-[560px]:px-5"

function expectedTimeline(value: string | null | undefined) {
  const timeline = value?.trim()
  if (!timeline) return "Not specified"
  if (/^dd$/i.test(timeline)) return "Not available"
  return timeline
}

function matchesTableSearch(request: AdministrativeRequest, query: string) {
  const needle = query.trim().toLocaleLowerCase()
  return [
    request.id,
    request.title,
    request.referenceNumber,
    request.service.name,
    request.client.fullName,
    request.client.email,
  ].some((value) => value?.toLocaleLowerCase().includes(needle))
}

async function loadAdministrativeDetails(id: string, signal: AbortSignal) {
  const { serviceRequest } = await getAdministrativeRequest(id, signal)
  if (!serviceRequest.capabilities.read)
    throw new Error(
      "This service request is no longer available for inspection.",
    )
  return serviceRequest
}

export function AdministrativeRequestsPage() {
  const id = useSearchParams().get("request")
  const router = useRouter()
  const [search, setSearch] = useState("")
  const query = search.trim()
  const [status, setStatus] = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const [sortBy, setSortBy] = useState<InboxSort>("createdAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const list = usePaginatedList({
    params: { search: query, status, departmentId, sortBy, sortDir },
    load: ({ page, signal }) =>
      listAdministrativeRequests(
        { search: query, status, departmentId, page, sortBy, sortDir },
        signal,
      ),
    rows: (result) =>
      result.serviceRequests.filter((request) => request.capabilities.read),
    matches: matchesTableSearch,
    initial: null,
    refresh: "poll",
    fallbackError: "Couldn't load service requests.",
  })
  const { setPage } = list
  const data = !list.error ? list.data : undefined
  return (
    <section aria-label="Administrative service requests">
      <div className={`${filterBarClass} mb-4`}>
        <SearchField
          label="Search service requests"
          placeholder="Search service requests"
          containerClassName="max-[560px]:h-11"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
        <FilterSelect
          label="Request status"
          value={status}
          triggerClassName="w-[170px]"
          onChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
          options={[
            { value: "", label: "All statuses" },
            ...serviceRequestStatusValues.map((value) => ({
              value,
              label: serviceRequestStatuses[value].label,
            })),
          ]}
        />
        <FilterSelect
          label="Responsible or routed department"
          value={departmentId}
          triggerClassName="w-[210px]"
          onChange={(value) => {
            setDepartmentId(value)
            setPage(1)
          }}
          options={[
            { value: "", label: "All departments" },
            ...(data?.departments ?? []).map((department) => ({
              value: department.id,
              label: department.name,
            })),
          ]}
        />
      </div>
      <RequestInboxTable
        requests={list.rows}
        loading={list.loading}
        error={list.error}
        viewKey={list.tableViewKey}
        onRowsSettled={list.onRowsSettled}
        quickKey={query}
        onRetry={list.retry}
        onView={(request) =>
          router.push(`${root}?request=${encodeURIComponent(request.id)}`)
        }
        onGoToChat={noop}
        onDelete={noop}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={(column) => {
          setSortDir(column === sortBy && sortDir === "asc" ? "desc" : "asc")
          setSortBy(column)
          setPage(1)
        }}
        readOnly
      />
      <TableSearchStatus
        active={
          list.loading && list.previewing && Boolean(list.preview?.length)
        }
        label="requests"
      />
      {list.footer && (
        <TablePaginationFooter
          {...list.footer}
          label="Administrative request pages"
          itemLabel="requests"
          onPageChange={setPage}
        />
      )}
      {id && (
        <AdministrativeRequestDetails
          key={id}
          id={id}
          onClose={() => router.replace(root, { scroll: false })}
        />
      )}
    </section>
  )
}

function AdministrativeRequestDetails({
  id,
  onClose,
}: {
  id: string
  onClose: () => void
}) {
  const { formatDate } = useDatePreferences()
  return (
    <RequestDetailsDrawer
      id={id}
      onClose={onClose}
      loadDetails={loadAdministrativeDetails}
      title={(request) => request.title}
      description={(request) =>
        request.acceptedDepartment?.name ||
        request.service.departments
          .map((department) => department.name)
          .join(", ") ||
        "Organization-wide service request"
      }
      fallbackTitle="Request details"
      fallbackDescription="Organization-wide service request inspection. Read only."
      leading={
        <span
          className="grid size-11 flex-none place-items-center rounded-xl bg-[#e5edff] text-[#2058d4]"
          aria-hidden="true"
        >
          <ServiceIcon iconKey="business" size={20} />
        </span>
      }
      meta={(request) => <BookingStatusPill status={request.status} />}
      closeLabel="Close request details"
      loadingLabel="Loading request details…"
      fallbackError="Couldn't load this service request."
      fallbackFocusId="administrative-workspace-heading"
      bodyClassName="flex flex-col gap-0 overflow-hidden p-0"
      renderActions={() => (
        <div className="flex justify-end">
          <SheetClose asChild>
            <SidePanelButton aria-label="Done viewing request details">
              Done
            </SidePanelButton>
          </SheetClose>
        </div>
      )}
      renderBody={(request) => (
        <Tabs
          defaultValue="overview"
          className="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          <div className="flex-none px-6 max-[560px]:px-5">
            <TabsList aria-label="Request details sections" className="w-full">
              <TabsTrigger className="flex-1" value="overview">
                Overview
              </TabsTrigger>
              <TabsTrigger className="flex-1" value="workflow">
                Workflow
              </TabsTrigger>
              <TabsTrigger className="flex-1" value="records">
                Records
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="overview" className={requestTabPanelClassName}>
            <SidePanelSection title="Request information">
              <DetailList>
                <DetailItem label="Request reference">
                  {request.referenceNumber || request.id}
                </DetailItem>
                <DetailItem label="Service">{request.service.name}</DetailItem>
                <DetailItem label="Package">
                  {request.packageName || "Not available"}
                </DetailItem>
                <DetailItem label="Client">
                  {request.client.fullName || "Not available"}
                </DetailItem>
                <DetailItem label="Current status">
                  <BookingStatusPill status={request.status} />
                </DetailItem>
                <DetailItem label="Submitted">
                  {formatDate(request.createdAt)}
                </DetailItem>
                <DetailItem label="Last updated">
                  {formatDate(request.updatedAt)}
                </DetailItem>
                <DetailItem label="Expected timeline">
                  {expectedTimeline(request.expectedTimeline)}
                </DetailItem>
              </DetailList>
              <p className="m-0 text-xs leading-5 text-[#52627a]">
                {serviceRequestStatuses[request.status].description}
              </p>
            </SidePanelSection>
            <SidePanelSection title="Department and assignment">
              <DetailList>
                <DetailItem label="Responsible department">
                  {request.acceptedDepartment?.name ??
                    (request.status === "SUBMITTED"
                      ? "Not yet accepted"
                      : "Not available")}
                </DetailItem>
                <DetailItem label="Routed departments">
                  {request.service.departments
                    .map((department) => department.name)
                    .join(", ") || "None"}
                </DetailItem>
                <DetailItem label="Department Head">
                  {request.acceptedDepartment?.head?.fullName ?? "Not assigned"}
                </DetailItem>
                <DetailItem label="Accepted by">
                  {request.acceptedBy?.fullName ??
                    (request.status === "SUBMITTED"
                      ? "Not yet accepted"
                      : "Not available")}
                </DetailItem>
                <DetailItem label="Assigned personnel">
                  {request.project?.staff
                    .map(
                      ({ employee, isTeamLead }) =>
                        `${employee.fullName}${employee.position ? ` (${employee.position})` : ""}${isTeamLead ? " · Team lead" : ""}`,
                    )
                    .join(", ") || "Not assigned"}
                </DetailItem>
                <DetailItem label="Specialist preference">
                  {request.preferredSpecialistName || "Not specified"}
                  <span className="block text-[10px] font-normal text-[#738096]">
                    Preference only; this is not an assignment.
                  </span>
                </DetailItem>
              </DetailList>
            </SidePanelSection>
            <SidePanelSection title="Related project">
              {request.project ? (
                <DetailList>
                  <DetailItem label="Project reference">
                    {request.project.id}
                  </DetailItem>
                  <DetailItem label="Project name">
                    {request.project.name}
                  </DetailItem>
                  <DetailItem label="Project status">
                    <WorkflowBadge value={request.project.status} />
                  </DetailItem>
                </DetailList>
              ) : (
                <EmptyState
                  size="sm"
                  title="No project has been created yet."
                />
              )}
            </SidePanelSection>
            <p className="m-0 rounded-lg bg-[#f8fafd] p-3 text-[11px] leading-relaxed text-[#52627a]">
              Administrative inspection only. Department actions, private
              conversations, and restricted files remain unavailable.
            </p>
          </TabsContent>
          <TabsContent value="workflow" className={requestTabPanelClassName}>
            {request.workflowInspection ? (
              <AdministrativeWorkflowProgress
                workflow={request.workflowInspection}
                request={request}
              />
            ) : (
              <EmptyState
                role="status"
                size="sm"
                title="Workflow details are not available."
              />
            )}
          </TabsContent>
          <TabsContent value="records" className={requestTabPanelClassName}>
            {request.workflowInspection ? (
              <AdministrativeWorkflowRecords
                workflow={request.workflowInspection}
              />
            ) : (
              <EmptyState
                role="status"
                size="sm"
                title="Workflow records are not available."
              />
            )}
          </TabsContent>
        </Tabs>
      )}
    />
  )
}
