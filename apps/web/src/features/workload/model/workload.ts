export type WorkloadAssignment = {
  id: string
  projectId: string
  employeeId: string
  weeklyHours: number | null
  allocationStart: string | null
  allocationEnd: string | null
  project: { id: string; name: string; status: string }
}

export type WorkloadStaff = {
  id: string
  fullName: string
  position: string | null
  status: string
  profileSpecialties: string[]
  team: { id: string; name: string } | null
  capacity: { scheduledHours: number; timeOffHours: number } | null
  assignments: WorkloadAssignment[]
  planning?: WorkloadPlanning
}

export type WorkloadPlanning = {
  requirement: {
    totalHours: number | null
    knownHours: number
    days: {
      workDate: string
      requiredMinutes: number | null
      isWorkingDay: boolean | null
      policyName: string | null
      timeZone: string | null
    }[]
  }
  confirmedAvailableSlots: null
  commitments: {
    id: string
    title: string
    startsAt: string
    endsAt: string
  }[]
  overlaps: { firstId: string; secondId: string }[]
}

export function getWorkloadMetrics(s: WorkloadStaff) {
  const capacity = s.capacity
    ? Math.max(0, s.capacity.scheduledHours - s.capacity.timeOffHours)
    : null
  const assigned = s.assignments.reduce((n, a) => n + (a.weeklyHours ?? 0), 0)
  const unknown = s.assignments.some((a) => a.weeklyHours === null)
  const utilization =
    capacity !== null && capacity > 0
      ? Math.round((assigned / capacity) * 100)
      : null
  const availability =
    s.status !== "ACTIVE"
      ? s.status === "ON_LEAVE"
        ? "On leave"
        : "Inactive"
      : capacity === null || unknown
        ? "Needs setup"
        : assigned > (capacity ?? 0)
          ? "Overloaded"
          : capacity === 0
            ? "Unavailable"
            : (utilization ?? 0) >= 90
              ? "Near capacity"
              : "Available"
  return { capacity, assigned, unknown, utilization, availability }
}
