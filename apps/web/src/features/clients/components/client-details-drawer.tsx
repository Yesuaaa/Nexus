import { useState } from "react"
import { AnimatedSlotGridBody } from "@/components/ui/animated-data-row"
import { useTableFooter } from "@/components/ui/use-table-search"
import { AnimatedTableBody } from "@/components/ui/animated-table-body"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import {
  DetailItem,
  DetailList,
  SidePanel,
  SidePanelBody,
  SidePanelError,
  SidePanelHeader,
  SidePanelSection,
  useSidePanel,
} from "@/components/ui/side-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getClientDetails,
  listClientProjects,
  listClientServiceRequests,
  type Client,
  type ClientPage,
  type ClientProject,
  type ClientServiceRequest,
} from "../api/clients-api"
import { humanizeEnum } from "@/lib/format"
import { useAsyncResource } from "@/lib/use-async-resource"

export type ClientDetailsTab = "overview" | "service-requests" | "projects"

function dateLabel(value: string | null) {
  if (!value) return "Not scheduled"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "Not scheduled"
    : new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "Asia/Manila",
      }).format(date)
}

const relatedRowKey = (row: { id: string }) => row.id

function RelatedTable({
  kind,
  data,
  onRowsSettled,
}: {
  onRowsSettled: () => void
  kind: "service-requests" | "projects"
  data: ClientPage<ClientServiceRequest> | ClientPage<ClientProject>
}) {
  const requests = kind === "service-requests"
  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-[#e8ebef] min-[801px]:block">
        <table className="w-full table-fixed border-collapse text-left text-xs">
          <thead className="bg-[#e8eef2] text-[#52627a]">
            <tr>
              <th scope="col" className="px-3 py-2.5 font-medium">
                {requests ? "Request" : "Project"}
              </th>
              {requests && (
                <th scope="col" className="px-3 py-2.5 font-medium">
                  Service
                </th>
              )}
              <th scope="col" className="px-3 py-2.5 font-medium">
                Status
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                {requests ? "Created" : "Start date"}
              </th>
            </tr>
          </thead>
          <AnimatedTableBody<ClientServiceRequest | ClientProject>
            items={data.rows}
            viewKey={`${kind}:${data.page}`}
            onRowsSettled={onRowsSettled}
            columns={requests ? 4 : 3}
            rowClassName="border-t border-[#eceef1] align-top"
            emptyContent="No related records."
            renderRow={(row) => (
              <>
                {" "}
                <td className="max-w-[200px] break-all px-3 py-3 font-medium">
                  {requests
                    ? (row as ClientServiceRequest).title
                    : (row as ClientProject).name}
                </td>
                {requests && (
                  <td className="max-w-[150px] break-all px-3 py-3 text-[#52627a]">
                    {(row as ClientServiceRequest).service.name}
                  </td>
                )}
                <td className="px-3 py-3">
                  <Pill>{humanizeEnum(row.status)}</Pill>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-[#52627a]">
                  <time
                    dateTime={
                      requests
                        ? row.createdAt
                        : ((row as ClientProject).startDate ?? undefined)
                    }
                  >
                    {dateLabel(
                      requests
                        ? row.createdAt
                        : (row as ClientProject).startDate,
                    )}
                  </time>
                </td>
              </>
            )}
          />
        </table>
      </div>
      <div
        className="grid gap-2 min-[801px]:hidden"
        role="list"
        aria-label={requests ? "Service requests" : "Projects"}
      >
        <AnimatedSlotGridBody<ClientServiceRequest | ClientProject>
          items={data.rows}
          viewKey={`${kind}:${data.page}`}
          animateRows
          onRowsSettled={onRowsSettled}
          getKey={relatedRowKey}
          bodyRole="presentation"
          rowRole="listitem"
          rowClassName={() =>
            "grid gap-2 rounded-lg border border-[#e8ebef] p-3 mb-2 text-xs"
          }
          emptyContent="No related records."
          renderRow={(row) => {
            const title = requests
              ? (row as ClientServiceRequest).title
              : (row as ClientProject).name
            const detail = requests
              ? (row as ClientServiceRequest).service.name
              : dateLabel((row as ClientProject).startDate)
            const detailLabel = requests ? "Service" : "Start date"
            const date = requests
              ? row.createdAt
              : (row as ClientProject).createdAt
            return (
              <>
                {" "}
                <h3 className="m-0 break-all font-semibold">{title}</h3>
                <dl className="m-0 grid gap-2">
                  {requests && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#52627a]">{detailLabel}</dt>
                      <dd className="m-0 min-w-0 break-all text-right">
                        {detail}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#52627a]">Status</dt>
                    <dd className="m-0">
                      <Pill>{humanizeEnum(row.status)}</Pill>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#52627a]">Created</dt>
                    <dd className="m-0 text-right text-[#52627a]">
                      <time dateTime={date}>{dateLabel(date)}</time>
                    </dd>
                  </div>
                  {!requests && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#52627a]">Start date</dt>
                      <dd className="m-0 text-right text-[#52627a]">
                        {detail}
                      </dd>
                    </div>
                  )}
                </dl>
              </>
            )
          }}
        />
      </div>
    </>
  )
}

type RelatedKind = Exclude<ClientDetailsTab, "overview">
type RelatedPage = ClientPage<ClientServiceRequest> | ClientPage<ClientProject>

const triggerClass =
  "h-10 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-[#203f8c] data-[state=active]:bg-transparent data-[state=active]:shadow-none"

export function ClientDetailsDrawer({
  client,
  initialTab = "overview",
  onClose,
}: {
  client: Client
  initialTab?: ClientDetailsTab
  onClose: () => void
}) {
  const panel = useSidePanel(onClose)
  const [tab, setTab] = useState<ClientDetailsTab>(initialTab)
  const [page, setPage] = useState(1)
  const details = useAsyncResource(
    (signal) => getClientDetails(client.id, signal),
    [client.id],
    { fallbackError: "Could not load this client's details." },
  )
  const profile = details.data?.client
  const counts = {
    serviceRequests: details.data?.serviceRequestCount ?? 0,
    projects: details.data?.projectCount ?? 0,
  }
  const related = useAsyncResource(
    async (signal): Promise<{ kind: RelatedKind; data: RelatedPage }> => {
      const kind: RelatedKind =
        tab === "projects" ? "projects" : "service-requests"
      const load = (target: number) =>
        kind === "projects"
          ? listClientProjects(client.id, target, signal)
          : listClientServiceRequests(client.id, target, signal)
      const data = await load(page)
      // Records were removed since the page was chosen: show the last page.
      const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize))
      return { kind, data: page > lastPage ? await load(lastPage) : data }
    },
    [client.id, tab, page],
    {
      enabled: tab !== "overview" && Boolean(profile),
      fallbackError: "Could not load related records.",
    },
  )
  const relatedData = related.data?.kind === tab ? related.data.data : null
  const name =
    profile?.fullName?.trim() || (profile ? "Name not provided" : "Client")

  function changeTab(value: string) {
    setTab(value as ClientDetailsTab)
    setPage(1)
  }

  function relatedPanel(kind: RelatedKind) {
    return (
      <RelatedPanel
        kind={kind}
        loading={details.loading || related.loading}
        error={details.error || related.error}
        data={relatedData}
        onRetry={details.error ? details.retry : related.retry}
        onPage={setPage}
      />
    )
  }

  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      fallbackFocus={() =>
        document.getElementById(`client-view-${client.id}`) ??
        document.getElementById("client-directory-heading")
      }
    >
      <SidePanelHeader
        title="Client details"
        description={profile ? `${name} · Read-only` : "Read-only"}
        closeLabel="Close client details"
      />
      <Tabs
        value={tab}
        onValueChange={changeTab}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex-none border-b border-[#eceef1] px-6 pt-3 max-[560px]:px-4">
          <TabsList
            aria-label="Client detail sections"
            className="h-10 max-w-full gap-1 rounded-none bg-transparent p-0"
          >
            <TabsTrigger
              value="overview"
              aria-label="Overview"
              className={triggerClass}
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="service-requests"
              aria-label="Service requests"
              className={triggerClass}
            >
              Service requests{" "}
              <span className="ml-1 text-[#52627a]">
                {profile ? counts.serviceRequests : ""}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="projects"
              aria-label="Projects"
              className={triggerClass}
            >
              Projects{" "}
              <span className="ml-1 text-[#52627a]">
                {profile ? counts.projects : ""}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>
        <SidePanelBody>
          <TabsContent
            value="overview"
            className="mt-0 grid gap-5 outline-none"
          >
            {details.loading ? (
              <div
                role="status"
                className="grid min-h-40 place-content-center text-xs text-[#52627a]"
              >
                Loading client details…
              </div>
            ) : details.error ? (
              <SidePanelError message={details.error} onRetry={details.retry} />
            ) : profile ? (
              <>
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    name={profile.fullName?.trim() || profile.email}
                    className="size-11 text-sm"
                  />
                  <p className="m-0 min-w-0 text-sm font-semibold break-words">
                    {name}
                  </p>
                  <Pill
                    tone={profile.isActive ? "success" : "danger"}
                    className="ml-auto flex-none"
                  >
                    {profile.isActive ? "Active" : "Inactive"}
                  </Pill>
                </div>
                <SidePanelSection title="Personal information">
                  <DetailList>
                    <DetailItem label="Full name">{name}</DetailItem>
                    <DetailItem label="Email address">
                      {profile.email}
                    </DetailItem>
                    <DetailItem label="Contact number">
                      {profile.contactNumber?.trim()}
                    </DetailItem>
                  </DetailList>
                </SidePanelSection>
                <SidePanelSection title="Related records">
                  <div className="divide-y divide-[#eceef1] rounded-lg border border-[#e8ebef] px-3">
                    <div className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <p className="m-0 text-xs font-medium">
                          Service requests
                        </p>
                        <p className="mt-1 mb-0 text-[11px] text-[#52627a]">
                          {counts.serviceRequests}{" "}
                          {counts.serviceRequests === 1
                            ? "request"
                            : "requests"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="brand"
                        className="h-9 flex-none text-xs"
                        onClick={() => changeTab("service-requests")}
                      >
                        View service requests
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <p className="m-0 text-xs font-medium">Projects</p>
                        <p className="mt-1 mb-0 text-[11px] text-[#52627a]">
                          {counts.projects}{" "}
                          {counts.projects === 1 ? "project" : "projects"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="brand"
                        className="h-9 flex-none text-xs"
                        onClick={() => changeTab("projects")}
                      >
                        View projects
                      </Button>
                    </div>
                  </div>
                </SidePanelSection>
                <SidePanelSection title="Account information">
                  <DetailList>
                    <DetailItem label="Role">Client</DetailItem>
                    <DetailItem label="Account status">
                      {profile.isActive ? "Active" : "Inactive"}
                    </DetailItem>
                    <DetailItem label="Date registered">
                      <time dateTime={profile.createdAt}>
                        {dateLabel(profile.createdAt)}
                      </time>
                    </DetailItem>
                  </DetailList>
                </SidePanelSection>
              </>
            ) : null}
          </TabsContent>
          <TabsContent value="service-requests" className="mt-0 outline-none">
            {relatedPanel("service-requests")}
          </TabsContent>
          <TabsContent value="projects" className="mt-0 outline-none">
            {relatedPanel("projects")}
          </TabsContent>
        </SidePanelBody>
      </Tabs>
    </SidePanel>
  )
}

function RelatedPanel({
  kind,
  loading,
  error,
  data,
  onRetry,
  onPage,
}: {
  kind: RelatedKind
  loading: boolean
  error: string
  data: RelatedPage | null
  onRetry: () => void
  onPage: (page: number) => void
}) {
  const { footer, onRowsSettled } = useTableFooter(data, loading)
  const label = kind === "service-requests" ? "service requests" : "projects"
  if (loading && !data)
    return (
      <div
        role="status"
        className="grid min-h-40 place-content-center text-xs text-[#52627a]"
      >
        Loading {label}…
      </div>
    )
  if (error)
    return (
      <SidePanelError
        message={`Could not load ${label}. ${error}`}
        onRetry={onRetry}
      />
    )
  if (!data || data.total === 0)
    return (
      <p
        role="status"
        className="grid min-h-40 place-content-center text-center text-xs text-[#52627a]"
      >
        No {label} are linked to this client yet.
      </p>
    )
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize))
  const summary = footer ?? data
  const first = (summary.page - 1) * summary.pageSize + 1
  const last = Math.min(summary.page * summary.pageSize, summary.total)
  const settled = !loading && footer === data
  return (
    <div className="grid gap-3">
      <RelatedTable kind={kind} data={data} onRowsSettled={onRowsSettled} />
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#52627a]">
        <span role="status" aria-live="polite">
          Showing {first}–{last} of {summary.total}
        </span>
        <nav
          aria-label={`${kind === "service-requests" ? "Service request" : "Project"} pages`}
          className="flex items-center gap-2"
        >
          <Button
            type="button"
            variant="outline"
            className="h-9 text-xs"
            disabled={!settled || data.page <= 1}
            onClick={() => onPage(data.page - 1)}
          >
            Back
          </Button>
          <span aria-current="page">
            Page {summary.page} of{" "}
            {Math.max(1, Math.ceil(summary.total / summary.pageSize))}
          </span>
          <Button
            type="button"
            variant="outline"
            className="h-9 text-xs"
            disabled={!settled || data.page >= pages}
            onClick={() => onPage(data.page + 1)}
          >
            Next
          </Button>
        </nav>
      </div>
    </div>
  )
}
