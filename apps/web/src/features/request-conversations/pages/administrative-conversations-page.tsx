"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { contentClass, focusRing } from "@/components/layout/styles"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { SearchField } from "@/components/ui/search-field"
import { FilterSelect } from "@/components/ui/filter-select"
import { TableSkeletonBody } from "@/components/ui/data-table-skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  pageRange,
  TablePaginationFooter,
} from "@/components/ui/table-pagination-footer"
import { RequestDetailsBody } from "@/features/bookings/components/request-details-body"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { useAsyncResource } from "@/lib/use-async-resource"
import {
  getAdministrativeConversation,
  listAdministrativeConversations,
  type BusinessConversationKind,
} from "../api/administrative-conversations-api"

const root = "/messages/oversight"
const metadataNote =
  "Metadata only. Message content, attachments, private direct messages and participant actions remain unavailable."

export function AdministrativeConversationsPage() {
  const params = useSearchParams()
  const id = params.get("conversation")
  const kind = params.get("kind") === "project" ? "project" : "service"
  return (
    <main
      aria-label="Business conversation oversight"
      className={`${contentClass} p-[clamp(16px,2.1vw,32px)]`}
    >
      <PageHeader
        title="Business conversation oversight"
        description="Organization-wide business conversation metadata · Read only"
        actions={
          <Link
            href="/messages"
            className={`text-xs text-[#294a9b] ${focusRing}`}
          >
            My conversations
          </Link>
        }
      />
      <div className="mt-5">
        {id ? (
          <ConversationDetails key={`${kind}:${id}`} id={id} kind={kind} />
        ) : (
          <ConversationList />
        )}
      </div>
    </main>
  )
}

function ConversationList() {
  const [kind, setKind] = useState<BusinessConversationKind>("service")
  const [search, setSearch] = useState("")
  const [settledSearch, setSettledSearch] = useState(search)
  const searchPending = search !== settledSearch
  useEffect(() => {
    if (!searchPending) return
    const timer = window.setTimeout(() => setSettledSearch(search), 200)
    return () => window.clearTimeout(timer)
  }, [search, searchPending])
  const [departmentId, setDepartmentId] = useState("")
  const [page, setPage] = useState(1)
  const { formatDate } = useDatePreferences()
  const result = useAsyncResource(
    async (signal) => ({
      search: settledSearch,
      data: await listAdministrativeConversations(
        { kind, search: settledSearch, departmentId, page },
        signal,
      ),
    }),
    [kind, settledSearch, departmentId, page],
    { enabled: !searchPending },
  )
  const data = result.error && !searchPending ? undefined : result.data?.data
  const searchLoading =
    searchPending || (result.loading && result.data?.search !== settledSearch)
  const showTable = Boolean(data) || result.loading || searchLoading
  return (
    <section aria-label="Business conversation metadata">
      <p className="mb-4 text-xs text-muted-foreground">{metadataNote}</p>
      <div className="mb-4 flex flex-wrap gap-3">
        <FilterSelect
          label="Conversation type"
          value={kind}
          onChange={(value) => {
            setKind(value === "project" ? "project" : "service")
            setPage(1)
          }}
          options={[
            { value: "service", label: "Service conversations" },
            { value: "project", label: "Project conversations" },
          ]}
        />
        <SearchField
          label="Search business conversations"
          placeholder="Search clients or business references"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
        <FilterSelect
          label="Conversation department"
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
      {result.error && !searchPending && (
        <p role="alert">
          {result.error} <Button onClick={result.retry}>Retry</Button>
        </p>
      )}
      {showTable && (
        <>
          <Table
            aria-label="Business conversations"
            aria-busy={result.loading || searchLoading}
          >
            <TableHeader>
              <TableRow>
                {[
                  "Conversation",
                  "Client",
                  "Department",
                  "Status",
                  "Updated",
                  "Actions",
                ].map((label) => (
                  <TableHead key={label}>{label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            {searchLoading || (result.loading && !data) ? (
              <TableSkeletonBody
                label="business conversations"
                columns={6}
                rows={5}
              />
            ) : data ? (
              <TableBody>
                {data.conversations
                  .filter((item) => item.capabilities.inspectMetadata)
                  .map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.client.fullName || "Client"}</TableCell>
                      <TableCell>
                        {item.department?.name ?? "No linked department"}
                      </TableCell>
                      <TableCell>
                        {item.status === "ARCHIVED" ? "Archived" : "Active"}
                      </TableCell>
                      <TableCell>{formatDate(item.updatedAt)}</TableCell>
                      <TableCell>
                        <Link
                          aria-label={`Inspect metadata for ${item.name}`}
                          className={`text-[#294a9b] ${focusRing}`}
                          href={`${root}?kind=${item.kind}&conversation=${encodeURIComponent(item.id)}`}
                        >
                          Inspect metadata
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                {!data.conversations.length && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      No business conversations found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            ) : null}
          </Table>
          {data && (
            <TablePaginationFooter
              {...pageRange(data.page, data.pageSize, data.total)}
              total={data.total}
              page={data.page}
              totalPages={Math.ceil(data.total / data.pageSize)}
              disabled={result.loading || searchLoading}
              label="Business conversation pages"
              itemLabel="conversations"
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </section>
  )
}

function ConversationDetails({
  id,
  kind,
}: {
  id: string
  kind: BusinessConversationKind
}) {
  const [page, setPage] = useState(1)
  const { formatDateTime } = useDatePreferences()
  const result = useAsyncResource(
    (signal) => getAdministrativeConversation(kind, id, page, signal),
    [kind, id, page],
  )
  const data = result.error ? undefined : result.data
  const row = data?.conversation
  const showRecords =
    (Boolean(data?.conversation.capabilities.inspectMetadata) &&
      Boolean(data)) ||
    (result.loading && !result.error && !data)
  return (
    <section aria-label="Conversation metadata details" className="space-y-5">
      <Link href={root} className={`text-xs text-[#294a9b] ${focusRing}`}>
        Back to business conversations
      </Link>
      {result.error && (
        <p role="alert">
          {result.error} <Button onClick={result.retry}>Retry</Button>
        </p>
      )}
      {row?.capabilities.inspectMetadata && data && (
        <>
          <RequestDetailsBody
            title={row.name}
            status={row.status === "ARCHIVED" ? "Archived" : "Active"}
            fields={[
              [
                "Conversation type",
                row.kind === "service"
                  ? "Client–department service conversation"
                  : "Project conversation",
              ],
              ["Client", row.client.fullName || "Client"],
              ["Department", row.department?.name ?? "No linked department"],
              [
                "Department head",
                row.department?.head?.fullName || "Not assigned",
              ],
              [
                "Project status",
                row.businessStatus?.replaceAll("_", " ") ?? "Not applicable",
              ],
              ["Created", formatDateTime(row.createdAt)],
              ["Updated", formatDateTime(row.updatedAt)],
              [
                "Latest shared message",
                row.lastMessageAt
                  ? formatDateTime(row.lastMessageAt)
                  : "No shared message recorded",
              ],
              [
                "Project started",
                row.startDate
                  ? formatDateTime(row.startDate)
                  : "Not applicable",
              ],
              ["Linked service requests", row.linkedRecordCount],
            ]}
            sections={[]}
            note={metadataNote}
            messagesRequestId={null}
          />
        </>
      )}
      {showRecords && (
        <>
          <Table
            aria-label="Linked business records"
            aria-busy={result.loading}
          >
            <TableHeader>
              <TableRow>
                {["Request", "Service", "Request status", "Project"].map(
                  (label) => (
                    <TableHead key={label}>{label}</TableHead>
                  ),
                )}
              </TableRow>
            </TableHeader>
            {data ? (
              <TableBody>
                {data.linkedRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {record.referenceNumber || record.id}
                      <p className="mt-1 text-muted-foreground">
                        {record.title}
                      </p>
                    </TableCell>
                    <TableCell>{record.serviceName}</TableCell>
                    <TableCell>{record.status.replaceAll("_", " ")}</TableCell>
                    <TableCell>
                      {record.project
                        ? `${record.project.name} · ${record.project.status.replaceAll("_", " ")}`
                        : "Not created"}
                    </TableCell>
                  </TableRow>
                ))}
                {!data.linkedRecords.length && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      No linked business records.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            ) : (
              <TableSkeletonBody
                label="linked business records"
                columns={4}
                rows={5}
              />
            )}
          </Table>
          {data && (
            <TablePaginationFooter
              {...pageRange(data.page, data.pageSize, data.total)}
              total={data.total}
              page={data.page}
              totalPages={Math.ceil(data.total / data.pageSize)}
              disabled={result.loading}
              label="Linked business record pages"
              itemLabel="requests"
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </section>
  )
}
