"use client"

import Link from "next/link"
import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { SearchField } from "@/components/ui/search-field"
import { FilterSelect } from "@/components/ui/filter-select"
import { TableSearchStatus } from "@/components/ui/table-search-status"
import { usePaginatedList } from "@/components/ui/use-paginated-list"
import { useAsyncResource } from "@/lib/use-async-resource"
import { WorkspaceListTable } from "@/features/project-workspace/components/workspace-list-table"
import { WorkspaceOverview } from "@/features/project-workspace/components/workspace-overview"
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
  const result = useAsyncResource(
    (signal) => getAdministrativeProject(id, signal),
    [id],
  )
  const project =
    !result.loading && !result.error ? result.data?.project : undefined
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
          <h2 className="mt-5 text-xl font-semibold">{project.name}</h2>
          <p>
            {statusLabel(project.status)} ·{" "}
            {project.department?.name ?? "No responsible department"} ·{" "}
            {project.capabilities.rename
              ? "Workspace metadata management"
              : "Read only"}
          </p>
          <p>
            Workspace: {project.workspaceGroup?.name ?? "Standalone project"} (
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
          <p className="my-4 text-sm">{project.workstreams[0]?.description}</p>
          <WorkspaceOverview
            workspace={project}
            busy={false}
            onUpdated={noop}
            onEditPlan={noop}
            readOnly
          />
          <h3 className="mt-6 font-semibold">Assignments</h3>
          <ul>
            {project.workstreams
              .flatMap((stream) => stream.staff ?? [])
              .map((person) => (
                <li key={person.id}>
                  {person.fullName} · {person.position ?? "Staff"} ·{" "}
                  {person.status}
                  {person.isTeamLead ? " · Team lead" : ""}
                </li>
              ))}
          </ul>
          <h3 className="mt-6 font-semibold">Milestones</h3>
          <ul>
            {project.workstreams
              .flatMap((stream) => stream.milestones ?? [])
              .map((milestone) => (
                <li key={milestone.id}>
                  {milestone.title} · {milestone.deliveryStatus} ·{" "}
                  {milestone.completedAt ? "Complete" : "Incomplete"}
                </li>
              ))}
          </ul>
        </>
      )}
    </section>
  )
}
