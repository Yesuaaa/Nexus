"use client"

import { useState } from "react"
import { Activity, CheckCircle2, FilePenLine, UsersRound } from "lucide-react"
import { SearchField } from "@/components/ui/search-field"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterSelect } from "@/components/ui/filter-select"
import type { ProjectWorkspaceDetail } from "../api/project-workspace-api"

function category(type: string) {
  if (type === "STAFFING_APPROVED") return "staffing"
  if (type.includes("TASK") || type.includes("MILESTONE")) return "work"
  return "project"
}

export function WorkspaceActivity({
  workspace,
}: {
  workspace: ProjectWorkspaceDetail
}) {
  const [search, setSearch] = useState("")
  const [kind, setKind] = useState("all")
  const [actor, setActor] = useState("all")
  const [sort, setSort] = useState("newest")
  const actors = [
    ...new Set(
      workspace.activity.map((event) => event.actor?.fullName || "System"),
    ),
  ]
  const visible = workspace.activity
    .filter(
      (event) =>
        (kind === "all" || category(event.type) === kind) &&
        (actor === "all" || (event.actor?.fullName || "System") === actor) &&
        `${event.summary} ${event.actor?.fullName ?? "System"} ${event.projectName}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    )
    .sort(
      (a, b) =>
        (sort === "newest" ? -1 : 1) *
        (Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    )
  const groups = new Map<string, typeof visible>()
  for (const event of visible) {
    const day = new Date(event.createdAt).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    groups.set(day, [...(groups.get(day) ?? []), event])
  }
  return (
    <section aria-label="Project activity">
      <h2 className="m-0 text-sm font-semibold">Project activity</h2>
      <p className="mt-1 mb-4 text-xs text-[#738096]">
        Changes to project details, work plans, tasks, and staffing.
      </p>
      <div className="mb-4 flex flex-wrap gap-2.5">
        <SearchField
          label="Search activity"
          placeholder="Search activity..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {[
          {
            label: "Activity type",
            value: kind,
            set: setKind,
            options: [
              { value: "all", label: "All activity" },
              { value: "work", label: "Tasks & plans" },
              { value: "staffing", label: "Staffing" },
              { value: "project", label: "Project" },
            ],
          },
          {
            label: "Activity author",
            value: actor,
            set: setActor,
            options: [
              { value: "all", label: "All staff" },
              ...actors.map((name) => ({ value: name, label: name })),
            ],
          },
          {
            label: "Activity order",
            value: sort,
            set: setSort,
            options: [
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first" },
            ],
          },
        ].map((filter) => (
          <FilterSelect
            key={filter.label}
            label={filter.label}
            value={filter.value}
            options={filter.options}
            triggerClassName="w-[165px]"
            onChange={filter.set}
          />
        ))}
      </div>
      {visible.length ? (
        <div className="overflow-hidden rounded-xl border border-[#dfe5ec]">
          {[...groups.entries()].map(([day, events]) => (
            <section key={day} aria-label={day}>
              <h3 className="m-0 bg-[#edf1f5] px-5 py-3 text-xs font-semibold">
                {day}
              </h3>
              <ol className="m-0 list-none divide-y divide-[#edf0f4] p-0">
                {events.map((event) => {
                  const Icon =
                    category(event.type) === "staffing"
                      ? UsersRound
                      : category(event.type) === "work"
                        ? CheckCircle2
                        : FilePenLine
                  return (
                    <li
                      key={event.id}
                      className="flex items-start gap-3 px-5 py-4"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e9effc] text-[#294c96]">
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-xs font-semibold">
                          {event.actor?.fullName || "System"}
                        </p>
                        <p className="mt-1 mb-0 whitespace-pre-wrap break-words text-xs leading-5 text-[#60718c]">
                          {event.summary}
                        </p>
                        {workspace.workstreams.length > 1 && (
                          <p className="mt-1 mb-0 text-[10px] text-[#738096]">
                            {event.projectName}
                          </p>
                        )}
                      </div>
                      <time
                        dateTime={event.createdAt}
                        className="shrink-0 text-[11px] text-[#738096]"
                      >
                        {new Date(event.createdAt).toLocaleTimeString(
                          undefined,
                          { hour: "numeric", minute: "2-digit" },
                        )}
                      </time>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
          <p className="m-0 border-t border-[#edf0f4] px-5 py-3 text-[11px] text-[#738096]">
            Showing {visible.length} activities
          </p>
        </div>
      ) : (
        <EmptyState
          icon={Activity}
          title={
            workspace.activity.length
              ? "No matching activity"
              : "No activity yet"
          }
          description={
            workspace.activity.length
              ? "Try another search or clear your filters."
              : "Project changes will appear here as staff update the plan, tasks, and assignments."
          }
          action={
            workspace.activity.length > 0 && (
              <Button
                variant="outline"
                className="text-xs"
                onClick={() => {
                  setSearch("")
                  setKind("all")
                  setActor("all")
                }}
              >
                Clear filters
              </Button>
            )
          }
        />
      )}
    </section>
  )
}
