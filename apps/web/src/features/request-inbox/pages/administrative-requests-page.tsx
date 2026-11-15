"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { SearchField } from "@/components/ui/search-field"
import { FilterSelect, filterBarClass } from "@/components/ui/filter-select"
import { TablePaginationFooter } from "@/components/ui/table-pagination-footer"
import { usePaginatedList } from "@/components/ui/use-paginated-list"
import { TableSearchStatus } from "@/components/ui/table-search-status"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { RequestDetailsBody } from "@/features/bookings/components/request-details-body"
import { RequestDetailsDrawer } from "@/features/bookings/components/request-details-drawer"
import { BookingStatusPill } from "@/features/bookings/components/booking-status-pill"
import { AdministrativeWorkflowProgress } from "@/features/request-workflow/components/administrative-workflow-progress"
import { serviceRequestStatusValues } from "@/features/service-operations/model/service-request-contracts"
import { serviceRequestStatuses } from "@/features/services/model/service-request-status"
import { RequestInboxTable } from "../components/request-inbox-table"
import { SheetClose } from "@/components/ui/sheet"
import { SidePanelButton } from "@/components/ui/side-panel"
import { ServiceIcon } from "@/features/services/components/service-icon"
import type { InboxSort } from "../api/request-inbox-api"
import {
  getAdministrativeRequest,
  listAdministrativeRequests,
  type AdministrativeRequest,
} from "../api/administrative-requests-api"

const root = "/module/service-operations"
const noop = () => {}

function matchesTableSearch(request: AdministrativeRequest, query: string) {
  return [
    request.title,
    request.referenceNumber,
    request.service.name,
    request.client.fullName,
    request.client.email,
  ].some((value) => value?.toLowerCase().includes(query))
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
        active={list.loading && list.previewing}
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
        <>
          <RequestDetailsBody
            title={request.title}
            statusNote={serviceRequestStatuses[request.status].description}
            status={<BookingStatusPill status={request.status} />}
            showIntro={false}
            detailLayout="inline"
            detailSectionTitle="Request information"
            fields={[
              ["Request reference", request.referenceNumber || request.id],
              ["Service", request.service.name],
              ["Client", request.client.fullName || "Client"],
              ["Package", request.packageName || "Standard service"],
              [
                "Responsible department",
                request.acceptedDepartment?.name ?? "Not yet accepted",
              ],
              [
                "Routed departments",
                request.service.departments
                  .map((department) => department.name)
                  .join(", ") || "None",
              ],
              [
                "Current department head",
                request.acceptedDepartment?.head?.fullName ?? "Not assigned",
              ],
              ["Accepted by", request.acceptedBy?.fullName ?? "Not accepted"],
              [
                "Workflow stage",
                request.workflow?.state.replaceAll("_", " ") ?? "Not started",
              ],
              ["Requested", formatDate(request.createdAt)],
              ["Updated", formatDate(request.updatedAt)],
              [
                "Expected timeline",
                request.expectedTimeline || "Not specified",
              ],
              [
                "Specialist preference (not an assignment)",
                request.preferredSpecialistName || "Not specified",
              ],
              [
                "Assigned personnel",
                request.project?.staff
                  .map(
                    ({ employee, isTeamLead }) =>
                      `${employee.fullName}${employee.position ? ` (${employee.position})` : ""}${isTeamLead ? " · Team lead" : ""}`,
                  )
                  .join(", ") || "None",
              ],
              [
                "Related project",
                request.project
                  ? `${request.project.name} · ${request.project.status}`
                  : "Not created",
              ],
            ]}
            sections={[]}
            note="Administrative inspection only. Department actions, private conversations and restricted files remain unavailable."
            messagesRequestId={null}
          />
          {request.workflowInspection && (
            <AdministrativeWorkflowProgress
              workflow={request.workflowInspection}
            />
          )}
        </>
      )}
    />
  )
}
