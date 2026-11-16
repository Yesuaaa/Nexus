"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { MemberIdentity } from "@/components/ui/member-identity"
import { Pill } from "@/components/ui/pill"
import { SearchField } from "@/components/ui/search-field"
import { FilterSelect } from "@/components/ui/filter-select"
import { TableSearchStatus } from "@/components/ui/table-search-status"
import { usePaginatedList } from "@/components/ui/use-paginated-list"
import { useAsyncResource } from "@/lib/use-async-resource"
import { useBreadcrumbLabel } from "@/components/layout/breadcrumbs"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { WorkspaceActivity } from "@/features/project-workspace/components/workspace-activity"
import { WorkspaceDeliverables } from "@/features/project-workspace/components/workspace-deliverables"
import { WorkspaceListTable } from "@/features/project-workspace/components/workspace-list-table"
import { WorkspaceOverview } from "@/features/project-workspace/components/workspace-overview"
import { ProjectSummary } from "@/features/project-workspace/components/project-summary"
import {
  getAdminProjectManagementWorkspaceDetails,
  type AdminProjectManagementWorkspaceDetails,
  type ProjectWorkspaceDetail,
} from "@/features/project-workspace/api/project-workspace-api"
import { statusLabel } from "../model/project-status"
import { AdministrativeWorkspaceName } from "../components/administrative-workspace-name"
import {
  getAdministrativeProject,
  listAdministrativeProjects,
  type AdministrativeProject,
} from "../api/administrative-projects-api"

const root = "/module/project-management"
const href = (id: string) => `${root}?project=${encodeURIComponent(id)}`
const noop = () => {}
const projectSections = [
  "overview",
  "work",
  "deliverables",
  "notes",
  "requests",
  "team",
  "activity",
] as const
type ProjectSection = (typeof projectSections)[number]

function readProjectSection(value: string | null): ProjectSection {
  const normalized = value?.toLowerCase()
  return projectSections.includes(normalized as ProjectSection)
    ? (normalized as ProjectSection)
    : "overview"
}

function AdministrativeSectionUnavailable({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <EmptyState
      role="status"
      title={`${title} aren't available in project inspection`}
      description={description}
      size="md"
    />
  )
}

function AdministrativeProjectTeam({
  project,
  details,
  detailsLoading,
  detailsError,
}: {
  project: AdministrativeProject
  details: AdminProjectManagementWorkspaceDetails | null
  detailsLoading: boolean
  detailsError: string
}) {
  const { formatDate } = useDatePreferences()
  const members = project.workstreams.flatMap((stream) => stream.staff ?? [])
  const head = details?.department.head

  return (
    <section aria-label="Project team" className="space-y-5">
      <header>
        <h3 className="m-0 text-sm font-semibold">Project team</h3>
        <p className="mt-1 mb-0 text-xs text-[#65718a]">
          Assigned personnel and department information.
        </p>
      </header>
      <section className="rounded-xl border border-[#dfe4ec] p-4 sm:p-5">
        <h4 className="m-0 text-xs font-semibold">Department</h4>
        <p className="mt-2 mb-0 text-xs text-[#52627a]">
          {project.department?.name ?? "No responsible department"}
        </p>
        <div className="mt-4 border-t border-[#eceef1] pt-4">
          <h4 className="m-0 text-xs font-semibold">Department head</h4>
          {detailsLoading ? (
            <p role="status" className="mt-2 mb-0 text-xs text-[#65718a]">
              Loading department details…
            </p>
          ) : detailsError ? (
            <p className="mt-2 mb-0 text-xs text-[#65718a]">
              Department head details could not be loaded.
            </p>
          ) : head ? (
            <div className="mt-3">
              <MemberIdentity
                member={{ fullName: head.fullName, email: head.email }}
                secondaryText={head.position || "Department Head"}
                nameAdornment={<Pill>Department Head</Pill>}
              />
            </div>
          ) : (
            <p className="mt-2 mb-0 text-xs text-[#65718a]">
              {project.department
                ? "No department head is assigned."
                : "Department head details are unavailable without a responsible department."}
            </p>
          )}
        </div>
      </section>
      {members.length ? (
        <ul className="m-0 list-none divide-y divide-[#eceef1] rounded-xl border border-[#dfe4ec] p-0">
          {members.map((member) => (
            <li
              key={`${member.id}-${member.approvedAt}`}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
            >
              <MemberIdentity
                member={{ fullName: member.fullName }}
                secondaryText={member.position || "Staff"}
                nameAdornment={
                  member.isTeamLead ? <Pill>Team Lead</Pill> : undefined
                }
              />
              <span className="text-right text-[11px] text-[#65718a]">
                {member.status} · Assigned{" "}
                <time dateTime={member.approvedAt}>
                  {formatDate(member.approvedAt)}
                </time>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No staff are assigned to this project"
          size="sm"
          role="status"
        />
      )}
    </section>
  )
}

function matchesAdministrativeProject(
  project: AdministrativeProject,
  query: string,
) {
  const needle = query.trim().toLocaleLowerCase()
  return [
    project.name,
    project.client.fullName,
    ...project.workstreams.flatMap((workstream) => [
      workstream.name,
      workstream.serviceName,
      workstream.referenceNumber,
    ]),
  ].some((value) => value?.toLocaleLowerCase().includes(needle))
}

export function AdministrativeProjectsOverview() {
  const id = useSearchParams().get("project")
  return id ? (
    <AdministrativeProjectDetails id={id} />
  ) : (
    <AdministrativeProjectList />
  )
}

function AdministrativeProjectList() {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const result = usePaginatedList({
    params: { search, status, departmentId },
    load: ({ page, signal }) =>
      listAdministrativeProjects(
        { search, status, departmentId, page },
        signal,
      ),
    rows: (response) =>
      response.projects.filter((project) => project.capabilities.read),
    matches: matchesAdministrativeProject,
    initial: null,
    fallbackError: "Something went wrong. Try again.",
  })
  const data = result.data
  const { page, setPage } = result
  return (
    <section aria-label="Organization projects">
      <p className="mb-4 text-sm text-muted-foreground">
        Organization-wide project inspection
      </p>
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchField
          label="Search projects or clients"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          placeholder="Search projects or clients"
        />
        <FilterSelect
          label="Project status"
          value={status}
          onChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
          options={[
            { value: "", label: "All statuses" },
            ...[
              "PLANNED",
              "IN_PROGRESS",
              "ON_HOLD",
              "COMPLETED",
              "CANCELLED",
            ].map((value) => ({ value, label: statusLabel(value) })),
          ]}
        />
        <FilterSelect
          label="Department"
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
      {result.error ? (
        <p role="alert">
          {result.error} <Button onClick={result.retry}>Retry</Button>
        </p>
      ) : (
        <>
          <WorkspaceListTable
            workspaces={result.rows}
            loading={result.loading}
            initialLoading={
              result.searchSkeleton ||
              (result.loading && !result.hasCurrentData && !result.previewing)
            }
            searching={result.previewing}
            viewKey={result.tableViewKey}
            quickKey={search}
            onRowsSettled={result.onRowsSettled}
            archiveView={false}
            onChanged={noop}
            readOnly
            projectHref={href}
          />
          <TableSearchStatus
            active={
              result.loading &&
              result.previewing &&
              Boolean(result.preview?.length)
            }
            label="projects"
          />
          {result.footer && (
            <div className="mt-4 flex items-center gap-3">
              <Button
                variant="outline"
                disabled={result.footer.page === 1 || result.loading}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span>
                Page {result.footer.page} · {result.footer.total} projects
              </span>
              <Button
                variant="outline"
                disabled={
                  result.footer.page >= result.footer.totalPages ||
                  result.loading
                }
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function AdministrativeProjectDetails({ id }: { id: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const result = useAsyncResource(
    (signal) => getAdministrativeProject(id, signal),
    [id],
  )
  const project =
    !result.loading && !result.error ? result.data?.project : undefined
  const section = readProjectSection(searchParams.get("tab"))
  const workspaceIdentity = project
    ? project.workspaceGroup
      ? `group:${project.workspaceGroup.id}`
      : `ungrouped-project:${project.id}`
    : null
  const departmentId = project?.department?.id ?? null
  const details =
    useAsyncResource<AdminProjectManagementWorkspaceDetails | null>(
      (signal) =>
        departmentId && workspaceIdentity
          ? getAdminProjectManagementWorkspaceDetails(
              departmentId,
              workspaceIdentity,
              signal,
            )
          : Promise.resolve(null),
      [departmentId, workspaceIdentity],
      {
        enabled: Boolean(
          departmentId &&
          workspaceIdentity &&
          (section === "team" || section === "activity"),
        ),
        fallbackError: "Couldn't load department project details.",
      },
    )
  useBreadcrumbLabel(id, project?.name)

  function setSection(next: ProjectSection) {
    const query = new URLSearchParams(searchParams.toString())
    query.set("project", id)
    if (next === "overview") query.delete("tab")
    else query.set("tab", next)
    router.push(`${root}?${query}`, { scroll: false })
  }

  const activityWorkspace: ProjectWorkspaceDetail | null =
    project && details.data
      ? {
          ...project,
          activity: details.data.activity
            .filter((event) => event.projectId === project.id)
            .map((event) => ({
              id: event.id,
              type: event.type,
              summary: event.summary,
              createdAt: event.createdAt,
              actor: event.actor,
              projectName: event.projectName,
            })),
        }
      : null

  return (
    <section aria-label="Administrative project details">
      <Link href={root}>Back to all projects</Link>
      {result.loading && <p role="status">Loading project…</p>}
      {result.error && (
        <p role="alert">
          {result.error} <Button onClick={result.retry}>Retry</Button>
        </p>
      )}
      {project?.capabilities.read && (
        <>
          <header className="mt-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="m-0 text-xl font-semibold">{project.name}</h2>
              <p className="mt-1 mb-0 text-sm text-muted-foreground">
                {statusLabel(project.status)} ·{" "}
                {project.department?.name ?? "No responsible department"} ·{" "}
                {project.capabilities.rename
                  ? "Workspace metadata management"
                  : "Read only"}
              </p>
            </div>
          </header>
          {section === "overview" ? (
            <div className="mt-5 space-y-4">
              <section className="rounded-xl border border-[#dfe4ec] p-4 sm:p-5">
                <p className="m-0 text-xs text-[#65718a]">
                  Workspace:{" "}
                  {project.workspaceGroup?.name ?? "Standalone project"} (
                  {project.workspaceGroup?.structure ?? "SEPARATE"})
                </p>
                {project.capabilities.rename && (
                  <AdministrativeWorkspaceName
                    key={project.workspaceGroup?.name ?? project.name}
                    projectId={project.id}
                    name={project.workspaceGroup?.name ?? project.name}
                    grouped={Boolean(project.workspaceGroup)}
                    onSaved={result.retry}
                  />
                )}
                {project.workstreams[0]?.description && (
                  <p className="mt-4 mb-0 whitespace-pre-wrap text-sm leading-6 text-[#52627a]">
                    {project.workstreams[0].description}
                  </p>
                )}
              </section>
              <ProjectSummary
                workspace={project}
                readOnly
                onViewTeam={() => setSection("team")}
                onViewDeliverables={() => setSection("deliverables")}
              />
            </div>
          ) : section === "work" ? (
            <div className="mt-5">
              <WorkspaceOverview
                workspace={project}
                busy={false}
                onUpdated={noop}
                onEditPlan={noop}
                readOnly
              />
            </div>
          ) : section === "deliverables" ? (
            <div className="mt-5">
              <p className="mb-4 text-xs text-[#65718a]">
                Organization-wide project inspection includes milestone details
                and delivery status. Attachment files, submitted versions, and
                approval history are not exposed by the current read-only API.
              </p>
              <WorkspaceDeliverables
                workspace={project}
                onUpdated={noop}
                administrativeReadOnly
              />
            </div>
          ) : section === "notes" ? (
            <div className="mt-5">
              <AdministrativeSectionUnavailable
                title="Project notes"
                description="The organization-wide project API does not include project notes, revision history, review statuses, or publication status."
              />
            </div>
          ) : section === "requests" ? (
            <div className="mt-5">
              <AdministrativeSectionUnavailable
                title="Client project requests"
                description="The organization-wide project API does not include client change or cancellation requests or their decision history."
              />
            </div>
          ) : section === "team" ? (
            <div className="mt-5">
              <AdministrativeProjectTeam
                project={project}
                details={details.data ?? null}
                detailsLoading={details.loading}
                detailsError={details.error}
              />
            </div>
          ) : (
            <div className="mt-5">
              {details.loading ? (
                <p role="status" className="text-xs text-[#65718a]">
                  Loading project activity…
                </p>
              ) : details.error ? (
                <p role="alert" className="text-xs text-[#65718a]">
                  {details.error}{" "}
                  <Button variant="outline" size="sm" onClick={details.retry}>
                    Retry
                  </Button>
                </p>
              ) : activityWorkspace ? (
                <WorkspaceActivity workspace={activityWorkspace} />
              ) : (
                <AdministrativeSectionUnavailable
                  title="Project activity"
                  description="The existing activity endpoint requires an assigned department. This project has no responsible department, so activity records are unavailable in this view."
                />
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}
