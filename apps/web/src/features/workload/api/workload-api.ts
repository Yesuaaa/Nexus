import { apiRequest } from "@/features/auth/api/auth-api"

export type Department = { id: string; name: string }
export type Metrics = {
  scheduledHours: number
  blockedHours: number
  capacityHours: number
  allocatedHours: number
  remainingHours: number
  utilization: number | null
  status: string
  workload: string
  conflicts: string[]
  scheduleConfigured: boolean
  activeAssignments: number
  upcomingAssignments: number
  assignmentCount: number
  pendingAssignments: number
}
export type EmployeeWorkload = Metrics & {
  id: string
  employeeId: string
  fullName: string
  position: string | null
  employmentType: string
  employeeStatus: string
  skills: string[]
  department: Department | null
}
export type WorkBlock = {
  id: string
  title: string
  startsAt: string
  endsAt: string
  estimatedHours: number
  priority: string
  deadline: string | null
  requiredSkills: string[]
  status: string
  ownerDepartmentId: string
  serviceRequestId: string | null
  projectId: string | null
  taskId: string | null
}
export type Assignment = WorkBlock & {
  ownerDepartment: Department
  serviceRequest: { id: string; title: string; status: string } | null
  project: { id: string; name: string; status: string } | null
  task: {
    id: string
    title: string
    project: { id: string; name: string }
  } | null
}
export type Staffing = WorkBlock & {
  ownerDepartment: Department
  recipientDepartment: Department
  recipientDepartmentId: string
  assignment: {
    id: string
    status: string
    employee: { fullName: string }
  } | null
}
export type Schedule = {
  weekday: number
  startMinute: number
  endMinute: number
}
export type Commitment = {
  id: string
  kind: string
  title: string
  startsAt: string
  endsAt: string
  source: string
}
export type WorkloadDetail = EmployeeWorkload & {
  workingSchedule: Schedule[]
  calendar: (Metrics & { date: string; assignments: string[] })[]
  commitments: Commitment[]
  assignments: Assignment[]
  upcomingBeyondPeriod: Assignment[]
}
export type Overview = {
  department: Department
  employees: EmployeeWorkload[]
  staffing: Staffing[]
}
export type Options = {
  unallocatedProjects: { id: string; name: string }[]
  departments: Department[]
  serviceRequests: {
    id: string
    title: string
    preferredSpecialistName: string | null
  }[]
  projects: {
    id: string
    name: string
    tasks: { id: string; title: string }[]
  }[]
}
export type Range = { start: string; days: number }
const query = (range: Range) =>
  new URLSearchParams({ start: range.start, days: String(range.days) })
export const listWorkload = (range: Range) =>
  apiRequest<Overview>(`/api/workload?${query(range)}`)
export const workloadOptions = () =>
  apiRequest<Options>("/api/workload/options")
export const configureProject = (id: string) =>
  apiRequest(
    `/api/workload/projects/${encodeURIComponent(id)}/responsibility`,
    { method: "PUT" },
  )
export const createProjectTask = (id: string, title: string) =>
  apiRequest<{ id: string; title: string }>(
    `/api/workload/projects/${encodeURIComponent(id)}/tasks`,
    { method: "POST", body: JSON.stringify({ title }) },
  )
export const employeeWorkload = (id: string, range: Range) =>
  apiRequest<WorkloadDetail>(
    `/api/workload/employees/${encodeURIComponent(id)}?${query(range)}`,
  )
export const saveConfiguration = (
  id: string,
  skills: string[],
  workingSchedule: Schedule[],
) =>
  apiRequest(
    `/api/workload/employees/${encodeURIComponent(id)}/configuration`,
    { method: "PUT", body: JSON.stringify({ skills, workingSchedule }) },
  )
export const addCommitment = (
  id: string,
  input: { title: string; kind: string; startsAt: string; endsAt: string },
) =>
  apiRequest(`/api/workload/employees/${encodeURIComponent(id)}/commitments`, {
    method: "POST",
    body: JSON.stringify(input),
  })
export const removeCommitment = (id: string, commitmentId: string) =>
  apiRequest(
    `/api/workload/employees/${encodeURIComponent(id)}/commitments/${encodeURIComponent(commitmentId)}`,
    { method: "DELETE" },
  )
export const saveWork = (
  input: Record<string, unknown>,
  crossDepartment: boolean,
) =>
  apiRequest(
    `/api/workload/${crossDepartment ? "staffing-requests" : "assignments"}`,
    { method: "POST", body: JSON.stringify(input) },
  )
export const closeAssignment = (
  id: string,
  status: "COMPLETED" | "CANCELLED",
) =>
  apiRequest(`/api/workload/assignments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
export const decideStaffing = (
  id: string,
  decision: string,
  employeeId?: string,
) =>
  apiRequest(`/api/workload/staffing-requests/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ decision, employeeId }),
  })
