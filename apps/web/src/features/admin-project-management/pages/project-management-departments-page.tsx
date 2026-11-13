"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { DepartmentTable } from "@/features/departments/components/department-table"
import { useDepartments } from "@/features/departments/hooks/use-departments"
import {
  departmentDirectoryHref,
  parseDepartmentDirectoryState,
  serializeDepartmentDirectoryState,
  type DepartmentDirectoryState,
} from "../model/department-directory-state"
import { ProjectManagementDepartmentDetailsPanel } from "../components/project-management-department-details-panel"

export function ProjectManagementDepartmentsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawSearchParams = searchParams.toString()
  const directoryState = useMemo(
    () => parseDepartmentDirectoryState(new URLSearchParams(rawSearchParams)),
    [rawSearchParams],
  )
  const canonicalSearchParams =
    serializeDepartmentDirectoryState(directoryState)
  const departmentList = useDepartments({ projectManagement: true })
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<
    string | null
  >(null)
  const loading = departmentList.loading && !departmentList.data
  const updateDirectoryState = useCallback(
    (patch: Partial<DepartmentDirectoryState>) => {
      router.replace(departmentDirectoryHref({ ...directoryState, ...patch }), {
        scroll: false,
      })
    },
    [directoryState, router],
  )

  useEffect(() => {
    if (canonicalSearchParams !== rawSearchParams) {
      router.replace(
        canonicalSearchParams
          ? `/project-management?${canonicalSearchParams}`
          : "/project-management",
        { scroll: false },
      )
    }
  }, [canonicalSearchParams, rawSearchParams, router])

  return (
    <main
      className={`${contentClass} p-[clamp(16px,2.1vw,32px)]`}
      aria-label="Project Management"
    >
      <PageHeader
        title="Project Management"
        description="Browse projects by department. Counts include all project statuses, including archived projects."
      />
      <section
        className="mt-[18px] min-w-0 max-[560px]:mt-[14px]"
        aria-label="Departments"
      >
        <DepartmentTable
          variant="project-management"
          departments={departmentList.departments}
          loading={loading}
          error={departmentList.error}
          onViewProjects={(department) =>
            router.push(
              `/project-management/departments/${encodeURIComponent(department.id)}/projects`,
            )
          }
          onViewDetails={setSelectedDepartmentId}
          directoryState={directoryState}
          onDirectoryStateChange={updateDirectoryState}
          onRetry={departmentList.retry}
        />
      </section>
      {selectedDepartmentId && (
        <ProjectManagementDepartmentDetailsPanel
          departmentId={selectedDepartmentId}
          onClose={() => setSelectedDepartmentId(null)}
        />
      )}
    </main>
  )
}
