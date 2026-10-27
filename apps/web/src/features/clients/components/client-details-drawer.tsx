import { useEffect, useRef, useState, type ReactNode } from "react"
import { CloseIcon } from "@/components/layout/icons"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { panelIconButton } from "@/features/departments/styles/member-panel-styles"
import {
  getClientDetails,
  listClientProjects,
  listClientServiceRequests,
  type Client,
  type ClientDetails,
  type ClientPage,
  type ClientProject,
  type ClientServiceRequest,
} from "../api/clients-api"

export type ClientDetailsTab = "overview" | "service-requests" | "projects"

function DetailRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-1.5 border-b border-[#eceef1] py-3 last:border-0">
      <dt className="text-[11px] font-medium text-[#52627a]">{label}</dt>
      <dd className="m-0 min-w-0 break-all text-xs font-medium">{children}</dd>
    </div>
  )
}

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

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ")
}

function RelatedTable({
  kind,
  data,
}: {
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
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.id} className="border-t border-[#eceef1] align-top">
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
                  <Pill>{statusLabel(row.status)}</Pill>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        className="grid gap-2 min-[801px]:hidden"
        role="list"
        aria-label={requests ? "Service requests" : "Projects"}
      >
        {data.rows.map((row) => {
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
            <article
              key={row.id}
              role="listitem"
              className="grid gap-2 rounded-lg border border-[#e8ebef] p-3 text-xs"
            >
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
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#52627a]">Status</dt>
                  <dd className="m-0">
                    <Pill>{statusLabel(row.status)}</Pill>
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#52627a]">
                    {requests ? "Created" : "Created"}
                  </dt>
                  <dd className="m-0 text-right text-[#52627a]">
                    <time dateTime={date}>{dateLabel(date)}</time>
                  </dd>
                </div>
                {!requests && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#52627a]">Start date</dt>
                    <dd className="m-0 text-right text-[#52627a]">{detail}</dd>
                  </div>
                )}
              </dl>
            </article>
          )
        })}
      </div>
    </>
  )
}

export function ClientDetailsDrawer({
  client,
  initialTab = "overview",
  onClose,
}: {
  client: Client
  initialTab?: ClientDetailsTab
  onClose: () => void
}) {
  const openerRef = useRef(
    typeof document === "undefined" ? null : document.activeElement,
  )
  const [details, setDetails] = useState<ClientDetails | null>(null)
  const [counts, setCounts] = useState({ serviceRequests: 0, projects: 0 })
  const [detailsResolvedKey, setDetailsResolvedKey] = useState("")
  const [detailsError, setDetailsError] = useState("")
  const [detailsRevision, setDetailsRevision] = useState(0)
  const [tab, setTab] = useState<ClientDetailsTab>(initialTab)
  const [page, setPage] = useState(1)
  const [relatedData, setRelatedData] = useState<
    ClientPage<ClientServiceRequest> | ClientPage<ClientProject> | null
  >(null)
  const [relatedResolvedKey, setRelatedResolvedKey] = useState("")
  const [relatedError, setRelatedError] = useState("")
  const [relatedRevision, setRelatedRevision] = useState(0)
  const name =
    details?.fullName?.trim() || (details ? "Name not provided" : "Client")
  const detailsRequestKey = `${client.id}:${detailsRevision}`
  const detailsLoading = detailsResolvedKey !== detailsRequestKey
  const relatedRequestKey =
    tab === "overview"
      ? ""
      : JSON.stringify({ id: client.id, tab, page, revision: relatedRevision })
  const relatedLoading =
    tab !== "overview" &&
    !detailsError &&
    (!details || relatedResolvedKey !== relatedRequestKey)
  const currentRelatedData =
    relatedResolvedKey === relatedRequestKey ? relatedData : null
  const currentRelatedError =
    relatedResolvedKey === relatedRequestKey ? relatedError : ""

  useEffect(() => {
    let active = true
    getClientDetails(client.id)
      .then((result) => {
        if (!active) return
        setDetails(result.client)
        setCounts({
          serviceRequests: result.serviceRequestCount,
          projects: result.projectCount,
        })
        setDetailsError("")
      })
      .catch((reason: unknown) => {
        if (!active) return
        setDetails(null)
        setDetailsError(
          reason instanceof Error
            ? reason.message
            : "Could not load this client's details.",
        )
      })
      .finally(() => {
        if (active) setDetailsResolvedKey(detailsRequestKey)
      })
    return () => {
      active = false
    }
  }, [client.id, detailsRequestKey])

  useEffect(() => {
    if (tab === "overview" || !details) return
    let active = true
    const request =
      tab === "service-requests"
        ? listClientServiceRequests(client.id, page)
        : listClientProjects(client.id, page)
    request
      .then((data) => {
        if (!active) return
        const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize))
        if (page > lastPage) {
          setPage(lastPage)
          return
        }
        setRelatedData(data)
        setRelatedError("")
      })
      .catch((reason: unknown) => {
        if (active)
          setRelatedError(
            reason instanceof Error
              ? reason.message
              : "Could not load related records.",
          )
      })
      .finally(() => {
        if (active) setRelatedResolvedKey(relatedRequestKey)
      })
    return () => {
      active = false
    }
  }, [client.id, details, relatedRequestKey, page, tab])

  function changeTab(value: string) {
    setTab(value as ClientDetailsTab)
    setPage(1)
    setRelatedData(null)
    setRelatedError("")
    setRelatedResolvedKey("")
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        showCloseButton={false}
        overlayClassName="bg-[rgb(13_28_57_/_40%)]"
        className="inset-y-auto top-[15px] right-[15px] flex h-[calc(100dvh-30px)] max-h-none w-[min(600px,calc(100vw-30px))] max-w-none flex-col gap-0 overflow-hidden rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_16px_60px_rgb(18_36_73_/_18%)] sm:max-w-none max-[560px]:top-0 max-[560px]:right-0 max-[560px]:h-dvh max-[560px]:w-full max-[560px]:rounded-none max-[560px]:border-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const opener = openerRef.current
          if (opener instanceof HTMLElement && opener.isConnected)
            opener.focus()
          else
            (
              document.getElementById(`client-view-${client.id}`) ??
              document.getElementById("client-directory-heading")
            )?.focus()
        }}
      >
        <header className="flex flex-none items-start justify-between gap-4 border-b border-[#eceef1] px-6 pt-6 pb-5 max-[560px]:px-5">
          <div className="min-w-0">
            <SheetTitle className="m-0 text-[22px] leading-[1.25] font-[650] tracking-[-0.03em]">
              Client details
            </SheetTitle>
            <SheetDescription className="mt-1 text-xs text-[#52627a]">
              Read-only
            </SheetDescription>
            <p
              className="mt-2 mb-0 truncate text-xs font-medium text-[#52627a]"
              aria-live="polite"
            >
              {detailsLoading
                ? "Loading client details…"
                : detailsError
                  ? "Details unavailable"
                  : name}
            </p>
          </div>
          <SheetClose asChild>
            <Button
              type="button"
              variant="outline"
              className={`${panelIconButton} max-[560px]:size-11`}
              aria-label="Close client details"
            >
              <CloseIcon width="16" height="16" />
            </Button>
          </SheetClose>
        </header>
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
                className="h-10 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-[#203f8c] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="service-requests"
                aria-label="Service requests"
                className="h-10 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-[#203f8c] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Service requests{" "}
                <span className="ml-1 text-[#52627a]">
                  {details ? counts.serviceRequests : ""}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="projects"
                aria-label="Projects"
                className="h-10 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-[#203f8c] data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Projects{" "}
                <span className="ml-1 text-[#52627a]">
                  {details ? counts.projects : ""}
                </span>
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 max-[560px]:px-5">
            <TabsContent value="overview" className="mt-0 outline-none">
              {detailsLoading ? (
                <div
                  role="status"
                  className="grid min-h-40 place-content-center text-xs text-[#52627a]"
                >
                  Loading client details…
                </div>
              ) : detailsError ? (
                <div
                  role="alert"
                  className="grid min-h-40 place-content-center justify-items-center gap-3 text-center text-xs text-[#52627a]"
                >
                  <p className="m-0">{detailsError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-xs"
                    onClick={() => {
                      setDetails(null)
                      setCounts({ serviceRequests: 0, projects: 0 })
                      setDetailsError("")
                      setDetailsRevision((value) => value + 1)
                    }}
                  >
                    Try again
                  </Button>
                </div>
              ) : details ? (
                <>
                  <div className="mb-6 flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="grid size-11 flex-none place-items-center rounded-full bg-[#eef0f3] text-sm font-medium text-[#52627a]"
                    >
                      {(details.fullName?.trim() ||
                        details.email)[0].toUpperCase()}
                    </span>
                    <p className="m-0 min-w-0 break-words text-sm font-semibold">
                      {name}
                    </p>
                    <Pill
                      className={
                        details.isActive
                          ? "ml-auto flex-none bg-[#e5f4ed] text-[#116348]"
                          : "ml-auto flex-none bg-[#e9edf2] text-[#52627a]"
                      }
                    >
                      {details.isActive ? "Active" : "Inactive"}
                    </Pill>
                  </div>
                  <section aria-label="Personal information">
                    <h3 className="m-0 text-xs font-semibold">
                      Personal information
                    </h3>
                    <dl className="m-0 divide-y divide-[#eceef1] rounded-lg border border-[#e8ebef] px-3">
                      <DetailRow label="Full name">{name}</DetailRow>
                      <DetailRow label="Email address">
                        {details.email}
                      </DetailRow>
                      <DetailRow label="Contact number">
                        {details.contactNumber?.trim() || "Not provided"}
                      </DetailRow>
                    </dl>
                  </section>
                  <section aria-label="Related records" className="mt-6">
                    <h3 className="m-0 text-xs font-semibold">
                      Related records
                    </h3>
                    <div className="mt-3 divide-y divide-[#eceef1] rounded-lg border border-[#e8ebef] px-3">
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
                          variant="outline"
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
                          variant="outline"
                          className="h-9 flex-none text-xs"
                          onClick={() => changeTab("projects")}
                        >
                          View projects
                        </Button>
                      </div>
                    </div>
                  </section>
                  <section aria-label="Account information" className="mt-6">
                    <h3 className="m-0 text-xs font-semibold">
                      Account information
                    </h3>
                    <dl className="m-0 divide-y divide-[#eceef1] rounded-lg border border-[#e8ebef] px-3">
                      <DetailRow label="Role">Client</DetailRow>
                      <DetailRow label="Account status">
                        {details.isActive ? "Active" : "Inactive"}
                      </DetailRow>
                      <DetailRow label="Date registered">
                        <time dateTime={details.createdAt}>
                          {dateLabel(details.createdAt)}
                        </time>
                      </DetailRow>
                    </dl>
                  </section>
                </>
              ) : null}
            </TabsContent>
            <TabsContent value="service-requests" className="mt-0 outline-none">
              <RelatedPanel
                kind="service-requests"
                loading={detailsLoading || relatedLoading}
                error={detailsError || currentRelatedError}
                data={
                  currentRelatedData as ClientPage<ClientServiceRequest> | null
                }
                page={page}
                onRetry={() => {
                  if (detailsError) {
                    setDetails(null)
                    setDetailsError("")
                    setDetailsRevision((v) => v + 1)
                  } else {
                    setRelatedRevision((v) => v + 1)
                  }
                }}
                onPage={(value) => {
                  setRelatedData(null)
                  setPage(value)
                }}
              />
            </TabsContent>
            <TabsContent value="projects" className="mt-0 outline-none">
              <RelatedPanel
                kind="projects"
                loading={detailsLoading || relatedLoading}
                error={detailsError || currentRelatedError}
                data={currentRelatedData as ClientPage<ClientProject> | null}
                page={page}
                onRetry={() => {
                  if (detailsError) {
                    setDetails(null)
                    setDetailsError("")
                    setDetailsRevision((v) => v + 1)
                  } else {
                    setRelatedRevision((v) => v + 1)
                  }
                }}
                onPage={(value) => {
                  setRelatedData(null)
                  setPage(value)
                }}
              />
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

function RelatedPanel({
  kind,
  loading,
  error,
  data,
  page,
  onRetry,
  onPage,
}: {
  kind: "service-requests" | "projects"
  loading: boolean
  error: string
  data: ClientPage<ClientServiceRequest> | ClientPage<ClientProject> | null
  page: number
  onRetry: () => void
  onPage: (page: number) => void
}) {
  const label = kind === "service-requests" ? "service requests" : "projects"
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  if (loading)
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
      <div
        role="alert"
        className="grid min-h-40 place-content-center justify-items-center gap-3 text-center text-xs text-[#52627a]"
      >
        <p className="m-0">
          Could not load {label}. {error}
        </p>
        <Button
          type="button"
          variant="outline"
          className="text-xs"
          onClick={onRetry}
        >
          Try again
        </Button>
      </div>
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
  if (page > pages)
    return (
      <div
        role="status"
        className="grid min-h-40 place-content-center text-xs text-[#52627a]"
      >
        Loading {label}…
      </div>
    )
  const first = (data.page - 1) * data.pageSize + 1
  const last = Math.min(data.page * data.pageSize, data.total)
  return (
    <div className="grid gap-3">
      <RelatedTable kind={kind} data={data} />
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#52627a]">
        <span role="status" aria-live="polite">
          Showing {first}–{last} of {data.total}
        </span>
        <nav
          aria-label={`${kind === "service-requests" ? "Service request" : "Project"} pages`}
          className="flex items-center gap-2"
        >
          <Button
            type="button"
            variant="outline"
            className="h-9 text-xs"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            Back
          </Button>
          <span aria-current="page">
            Page {data.page} of {pages}
          </span>
          <Button
            type="button"
            variant="outline"
            className="h-9 text-xs"
            disabled={page >= pages}
            onClick={() => onPage(page + 1)}
          >
            Next
          </Button>
        </nav>
      </div>
    </div>
  )
}
