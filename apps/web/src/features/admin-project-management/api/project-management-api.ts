import { apiRequest } from "@/features/auth/api/auth-api"
import type { ProjectStatus } from "@/features/project-management/model/project-contracts"

export type ProjectManagementOverview = {
  totals: {
    totalProjects: number
    planned: number
    inProgress: number
    onHold: number
    completed: number
    cancelled: number
    workspaceGroups: number
    departmentsWithProjects: number
    projectsWithoutDepartment: number
    projectsWithTasks: number
    projectsWithoutTasks: number
    totalTasks: number
    completedTasks: number
    activeProjects: number
    activeProjectsWithoutLead: number
    activeProjectsWithoutTeam: number
    activeAssignments: number
  }
  statusDistribution: { status: ProjectStatus; count: number }[]
  departments: {
    departmentId: string | null
    departmentName: string
    projectCount: number
    planned: number
    inProgress: number
    onHold: number
    completed: number
    cancelled: number
    projectsWithTasks: number
    projectsWithoutTasks: number
    totalTasks: number
    completedTasks: number
  }[]
  topStaffAssignments: {
    employeeId: string
    fullName: string
    departmentName: string | null
    activeProjects: number
    leadProjects: number
  }[]
  recentlyUpdatedProjects: {
    id: string
    /** Typed group/project identity, retained even when database IDs collide. */
    identity: string
    name: string
    status: ProjectStatus
    updatedAt: string
    departmentId: string | null
    departmentName: string
  }[]
}

export const getProjectManagementOverview = (signal?: AbortSignal) =>
  apiRequest<ProjectManagementOverview>("/api/project-management/overview", {
    signal,
  })
