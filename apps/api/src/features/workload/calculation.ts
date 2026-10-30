export type Interval = { startsAt: Date; endsAt: Date }
export type Schedule = {
  weekday: number
  startMinute: number
  endMinute: number
}
export type Allocation = Interval & {
  id: string
  estimatedHours: number
  status: string
  pending?: boolean
}
export type CapacityEmployee = {
  status: string
  startDate?: Date | null
  workingSchedule: Schedule[]
  commitments: Interval[]
  workAssignments: Allocation[]
}
const hour = 3_600_000
const day = 24 * hour
const manilaOffset = 8 * hour
export const roundHours = (value: number) => Math.round(value * 100) / 100
export const overlaps = (a: Interval, b: Interval) =>
  a.startsAt < b.endsAt && b.startsAt < a.endsAt
const duration = (a: Interval) =>
  Math.max(0, a.endsAt.getTime() - a.startsAt.getTime()) / hour

function intersection(a: Interval, b: Interval): Interval {
  return {
    startsAt: new Date(Math.max(+a.startsAt, +b.startsAt)),
    endsAt: new Date(Math.min(+a.endsAt, +b.endsAt)),
  }
}

// Merge blocked intervals before subtracting so overlapping leave/appointments
// never deduct the same working time twice.
function blockedHours(window: Interval, blocks: Interval[]) {
  const parts = blocks
    .filter((block) => overlaps(window, block))
    .map((block) => intersection(window, block))
    .sort((a, b) => +a.startsAt - +b.startsAt)
  let total = 0
  let end = -Infinity
  for (const part of parts) {
    total += Math.max(0, +part.endsAt - Math.max(end, +part.startsAt)) / hour
    end = Math.max(end, +part.endsAt)
  }
  return total
}

export function scheduledWindows(schedule: Schedule[], range: Interval) {
  const windows: Interval[] = []
  const first =
    Math.floor((+range.startsAt + manilaOffset) / day) * day - manilaOffset
  for (let date = first; date < +range.endsAt; date += day) {
    const weekday = new Date(date + manilaOffset).getUTCDay()
    for (const shift of schedule.filter((shift) => shift.weekday === weekday)) {
      const window = intersection(range, {
        startsAt: new Date(date + shift.startMinute * 60_000),
        endsAt: new Date(date + shift.endMinute * 60_000),
      })
      if (duration(window) > 0) windows.push(window)
    }
  }
  return windows
}

export function calculateCapacity(
  employee: CapacityEmployee,
  range: Interval,
  now = new Date(),
) {
  const employmentStart = employee.startDate
    ? new Date(
        `${new Date(+employee.startDate + manilaOffset).toISOString().slice(0, 10)}T00:00:00+08:00`,
      )
    : range.startsAt
  const effectiveRange = {
    startsAt: new Date(Math.max(+range.startsAt, +employmentStart)),
    endsAt: range.endsAt,
  }
  const windows = scheduledWindows(employee.workingSchedule, effectiveRange)
  const scheduledHours = windows.reduce(
    (total, window) => total + duration(window),
    0,
  )
  const blocked = windows.reduce(
    (total, window) => total + blockedHours(window, employee.commitments),
    0,
  )
  const capacityHours =
    employee.status === "ACTIVE" ? Math.max(0, scheduledHours - blocked) : 0
  const assignments = employee.workAssignments.filter(
    (a) => a.status === "CONFIRMED" && overlaps(a, range),
  )
  // Estimated effort is spread uniformly across the explicit scheduled block.
  // Capacity outside that block can never disguise a conflict within the block.
  const allocatedHours = assignments.reduce(
    (total, a) =>
      total +
      (a.estimatedHours * duration(intersection(a, range))) / duration(a),
    0,
  )
  const conflicts = new Set<string>()
  for (const assignment of assignments) {
    const window = intersection(assignment, range)
    const workingHours = scheduledWindows(
      employee.workingSchedule,
      intersection(window, effectiveRange),
    ).reduce((total, w) => total + duration(w), 0)
    if (
      employee.status !== "ACTIVE" ||
      workingHours + 0.00001 < duration(window) ||
      employee.commitments.some((block) => overlaps(window, block))
    )
      conflicts.add(assignment.id)
    for (const other of assignments) {
      if (other.id !== assignment.id && overlaps(window, other))
        conflicts.add(assignment.id)
    }
  }
  const utilization =
    capacityHours > 0
      ? (allocatedHours / capacityHours) * 100
      : allocatedHours > 0
        ? null
        : 0
  const workload =
    allocatedHours > capacityHours + 0.00001
      ? "OVER_CAPACITY"
      : capacityHours === 0
        ? "UNAVAILABLE"
        : allocatedHours >= capacityHours - 0.00001
          ? "FULLY_ALLOCATED"
          : utilization !== null && utilization >= 80
            ? "HIGH"
            : utilization !== null && utilization >= 50
              ? "MODERATE"
              : "AVAILABLE"
  const status =
    capacityHours === 0
      ? "UNAVAILABLE"
      : allocatedHours >= capacityHours - 0.00001
        ? "FULLY_ALLOCATED"
        : allocatedHours > 0 || blocked > 0
          ? "PARTIALLY_AVAILABLE"
          : "AVAILABLE"
  return {
    scheduledHours: roundHours(scheduledHours),
    blockedHours: roundHours(blocked),
    capacityHours: roundHours(capacityHours),
    allocatedHours: roundHours(allocatedHours),
    remainingHours: roundHours(Math.max(0, capacityHours - allocatedHours)),
    utilization:
      utilization === null ? null : Math.round(utilization * 10) / 10,
    status,
    workload,
    conflicts: [...conflicts],
    scheduleConfigured: employee.workingSchedule.length > 0,
    activeAssignments: assignments.filter(
      (a) => a.startsAt <= now && a.endsAt > now,
    ).length,
    upcomingAssignments: assignments.filter((a) => a.startsAt > now).length,
    assignmentCount: assignments.length,
    pendingAssignments: assignments.filter((a) => a.pending).length,
  }
}

export function calendarDays(employee: CapacityEmployee, range: Interval) {
  const days = []
  for (let date = +range.startsAt; date < +range.endsAt; date += day) {
    const window = {
      startsAt: new Date(date),
      endsAt: new Date(Math.min(date + day, +range.endsAt)),
    }
    days.push({
      date: new Date(date + manilaOffset).toISOString().slice(0, 10),
      ...calculateCapacity(employee, window),
      assignments: employee.workAssignments
        .filter((a) => overlaps(a, window) && a.status === "CONFIRMED")
        .map((a) => a.id),
    })
  }
  return days
}
