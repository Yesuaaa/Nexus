"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { SearchField } from "@/components/ui/search-field"
import { FilterSelect } from "@/components/ui/filter-select"
import { TableSearchStatus } from "@/components/ui/table-search-status"
import { TablePaginationFooter } from "@/components/ui/table-pagination-footer"
import { usePaginatedList } from "@/components/ui/use-paginated-list"
import { useAsyncResource } from "@/lib/use-async-resource"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { RequestDetailsBody } from "@/features/bookings/components/request-details-body"
import { BookingStatusPill } from "@/features/bookings/components/booking-status-pill"
import { AdministrativeWorkflowProgress } from "@/features/request-workflow/components/administrative-workflow-progress"
import { serviceRequestStatusValues } from "@/features/service-operations/model/service-request-contracts"
import { RequestInboxTable } from "../components/request-inbox-table"
import type { InboxSort } from "../api/request-inbox-api"
import {
  getAdministrativeRequest,
  listAdministrativeRequests,
  type AdministrativeRequest,
} from "../api/administrative-requests-api"

const root = "/module/service-operations"
const noop = () => {}

function matchesAdministrativeRequest(
  request: AdministrativeRequest,
  query: string,
) {
  const needle = query.trim().toLocaleLowerCase()
  return [
    request.id,
    request.referenceNumber,
    request.title,
    request.service.name,
    request.client.fullName,
    request.client.email,
  ].some((value) => value?.toLocaleLowerCase().includes(needle))
}

export function AdministrativeRequestsPage() {
  const id = useSearchParams().get("request")
  return id ? (
    <AdministrativeRequestDetails id={id} />
  ) : (
    <AdministrativeRequestList />
  )
}

function AdministrativeRequestList() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const [sortBy, setSortBy] = useState<InboxSort>("createdAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const result = usePaginatedList({
    params: { search, status, departmentId, sortBy, sortDir },
    load: ({ page, signal }) =>
      listAdministrativeRequests(
        { search, status, departmentId, page, sortBy, sortDir },
        signal,
      ),
    rows: (response) =>
      response.serviceRequests.filter((request) => request.capabilities.read),
    matches: matchesAdministrativeRequest,
    initial: null,
    fallbackError: "Something went wrong. Try again.",
  })
  const data = result.data
  const { setPage } = result
  return (
    <section aria-label="Administrative service requests">
      <p className="mb-4 text-sm text-muted-foreground">
        Organization-wide service requests · Read only
      </p>
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchField
          label="Search service requests"
          placeholder="Search service requests"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
        <FilterSelect
          label="Request status"
          value={status}
          onChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
          options={[
            { value: "", label: "All statuses" },
            ...serviceRequestStatusValues.map((value) => ({
              value,
              label: value.replaceAll("_", " "),
            })),
          ]}
        />
        <FilterSelect
          label="Responsible or routed department"
          value={departmentId}
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
        requests={result.rows}
        loading={result.loading}
        error={result.error}
        viewKey={result.tableViewKey}
        quickKey={search}
        onRowsSettled={result.onRowsSettled}
        onRetry={result.retry}
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
          result.loading && result.previewing && Boolean(result.preview?.length)
        }
        label="service requests"
      />
      {result.footer && (
        <TablePaginationFooter
          {...result.footer}
          label="Administrative request pages"
          itemLabel="requests"
          onPageChange={setPage}
        />
      )}
    </section>
  )
}

function AdministrativeRequestDetails({ id }: { id: string }) {
  const { formatDate } = useDatePreferences()
  const result = useAsyncResource(
    (signal) => getAdministrativeRequest(id, signal),
    [id],
  )
  const request =
    !result.loading && !result.error ? result.data?.serviceRequest : undefined
  return (
    <section aria-label="Administrative request details">
      <Link href={root}>Back to service requests</Link>
      {result.loading && <p role="status">Loading request…</p>}
      {result.error && (
        <p role="alert">
          {result.error} <Button onClick={result.retry}>Retry</Button>
        </p>
      )}
      {request?.capabilities.read && (
        <div className="mt-5 space-y-4">
          <RequestDetailsBody
            title={request.title}
            status={<BookingStatusPill status={request.status} />}
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
        </div>
      )}
    </section>
  )
}
