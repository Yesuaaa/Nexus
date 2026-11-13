"use client"

import { useState } from "react"
import { EmptyState } from "@/components/ui/empty-state"
import { MemberIdentity } from "@/components/ui/member-identity"
import { MemberRowSkeleton } from "@/components/ui/panel-loading"
import {
  SidePanel,
  SidePanelBody,
  SidePanelButton,
  SidePanelError,
  SidePanelFooter,
  SidePanelHeader,
  useSidePanel,
} from "@/components/ui/side-panel"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { roleLabels } from "@/features/auth/model/roles"
import { getProjectManagementDepartment } from "@/features/departments/api/departments-api"
import type { ProjectManagementDepartmentDetail } from "@/features/departments/api/departments-api"
import { useAsyncResource } from "@/lib/use-async-resource"

export function ProjectManagementDepartmentDetailsPanel({
  departmentId,
  onClose,
}: {
  departmentId: string
  onClose: () => void
}) {
  const panel = useSidePanel(onClose)
  const [revision, setRevision] = useState(0)
  const resource = useAsyncResource<ProjectManagementDepartmentDetail>(
    (signal) => getProjectManagementDepartment(departmentId, signal),
    [departmentId, revision],
    { fallbackError: "Couldn't load this department." },
  )
  const department = resource.data
  const loading = resource.loading && !department

  return (
    <SidePanel open={panel.open} onOpenChange={panel.onOpenChange}>
      <SidePanelHeader
        eyebrow="You're viewing"
        title={
          department?.name ??
          (loading ? "Loading department" : "Department details")
        }
        description="Read-only department details."
        meta={department?.code ? <Pill>{department.code}</Pill> : undefined}
        closeLabel="Close department details"
      />
      <SidePanelBody>
        {loading ? (
          <div className="grid gap-4" aria-busy="true">
            <span role="status" className="sr-only">
              Loading department details…
            </span>
            <Skeleton className="h-4 w-3/4" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
            <MemberRowSkeleton className="px-0 py-2" />
            <div className="divide-y divide-[#eceef1] rounded-lg border border-[#e8ebef]">
              {Array.from({ length: 3 }, (_, index) => (
                <MemberRowSkeleton key={index} className="px-4 py-3" />
              ))}
            </div>
          </div>
        ) : resource.error ? (
          <SidePanelError
            message={resource.error}
            onRetry={() => setRevision((current) => current + 1)}
          />
        ) : department ? (
          <>
            {department.description && (
              <p className="m-0 text-xs leading-5 text-[#52627a]">
                {department.description}
              </p>
            )}
            <dl className="m-0 grid grid-cols-2 gap-3">
              <div className="min-w-0 rounded-lg border border-[#e8ebef] px-3 py-2.5">
                <dt className="text-[11px] text-[#738096]">Members</dt>
                <dd className="mt-1 mb-0 text-sm font-semibold tabular-nums">
                  {department.memberCount}
                </dd>
              </div>
              <div className="min-w-0 rounded-lg border border-[#e8ebef] px-3 py-2.5">
                <dt className="text-[11px] text-[#738096]">
                  Projects (all statuses)
                </dt>
                <dd className="mt-1 mb-0 text-sm font-semibold tabular-nums">
                  {department.projectCount}
                </dd>
              </div>
            </dl>

            <section
              className="grid gap-3"
              aria-labelledby="department-head-label"
            >
              <div>
                <h3
                  id="department-head-label"
                  className="m-0 text-xs font-semibold"
                >
                  Department Head
                </h3>
              </div>
              {department.head ? (
                <MemberIdentity
                  member={{ fullName: department.head.fullName }}
                  secondaryText={
                    department.head.position || roleLabels[department.head.role]
                  }
                  nameAdornment={<Pill>Department Head</Pill>}
                />
              ) : (
                <p className="m-0 text-xs text-[#738096]">Unassigned</p>
              )}
            </section>

            <section
              className="grid gap-3"
              aria-labelledby="department-members-label"
            >
              <div>
                <h3
                  id="department-members-label"
                  className="m-0 text-xs font-semibold"
                >
                  Members
                </h3>
                <p className="mt-1 mb-0 text-[11px] text-[#738096]">
                  {department.memberCount} members
                </p>
              </div>
              {department.members.length ? (
                <ul className="m-0 list-none divide-y divide-[#eceef1] rounded-lg border border-[#e8ebef] p-0">
                  {department.members.map((member) => {
                    const details = [
                      member.user ? roleLabels[member.user.role] : null,
                      member.position,
                    ].filter(Boolean)
                    const isHead = member.userId === department.headId
                    return (
                      <li key={member.id} className="min-w-0 px-4 py-3">
                        <MemberIdentity
                          member={{ fullName: member.fullName }}
                          secondaryText={details.join(" · ") || null}
                          nameAdornment={
                            isHead ? <Pill>Department Head</Pill> : undefined
                          }
                        />
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <EmptyState
                  title="No department members"
                  size="sm"
                  className="rounded-lg"
                />
              )}
            </section>
          </>
        ) : (
          <EmptyState title="Department unavailable" size="sm" />
        )}
      </SidePanelBody>
      <SidePanelFooter>
        <SidePanelButton onClick={() => panel.close()}>Done</SidePanelButton>
      </SidePanelFooter>
    </SidePanel>
  )
}
