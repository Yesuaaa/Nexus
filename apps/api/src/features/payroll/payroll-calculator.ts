import { attendanceWorkedMilliseconds } from "../attendance/attendance.validation.js"
import { attendanceWorkDate } from "../attendance/attendance.validation.js"

type PayType = "MONTHLY" | "DAILY" | "HOURLY"
type Frequency = "MONTHLY" | "SEMI_MONTHLY"
type EmployeeStatus = "ACTIVE" | "INACTIVE" | "ON_LEAVE"
type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN"
type ComponentType = "ALLOWANCE" | "RECURRING_DEDUCTION"
type AdjustmentStatus = "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED"
type Instant = Date | string

export type PayrollCompensationComponentInput = {
  id: string
  type: ComponentType
  name: string
  amount: string
  calculationType: "FIXED"
}

export type PayrollCompensationVersionInput = {
  id: string
  payType: PayType
  baseRate: string
  currency: string
  effectiveFrom: string
  effectiveTo: string | null
  components: PayrollCompensationComponentInput[]
}

export type PayrollAttendanceSessionInput = {
  id: string
  startedAt: Instant
  endedAt: Instant | null
  breaks: {
    id: string
    startedAt: Instant
    endedAt: Instant | null
    isPaid: boolean
  }[]
  pendingCorrections: string[]
}

export type PayrollEmployeeCalculationInput = {
  period: {
    startDate: string
    endDate: string
    frequency: Frequency
    currency: string
  }
  employee: {
    id: string
    employeeNumber: string
    fullName: string
    employmentType: EmploymentType
    status: EmployeeStatus
    startDate: string | null
  }
  compensationVersions: PayrollCompensationVersionInput[]
  attendance: {
    policyMissing: boolean
    expectedWorkdays: {
      workDate: string
      assignmentId: string
      policyId: string
      policyName: string
      isWorkingDay: boolean
      requiredMinutes: number
    }[]
    workdays: {
      id: string
      workDate: string
      assignmentId: string
      policyId: string
      policyName: string
      timeZone: string
      isWorkingDay: boolean
      requiredMinutes: number
      unpaidBreaksEnabled: boolean
      overnightRequiresReview: boolean
      sessions: PayrollAttendanceSessionInput[]
    }[]
    overtimeAdjustments: {
      id: string
      status: AdjustmentStatus
      overtimeMinutes: number
    }[]
  }
}

export type PayrollCalculationIssue = {
  code: string
  message: string
  reference?: string
}

export type PayrollCalculationComponent = {
  componentType: "BASE_EARNING" | "ALLOWANCE" | "DEDUCTION"
  status: "CALCULATED" | "UNRESOLVED"
  sourceId: string | null
  name: string
  amount: string | null
  metadata: Record<string, string | number | boolean | null>
}

export type PayrollEmployeeCalculationResult = {
  employee: PayrollEmployeeCalculationInput["employee"]
  status: "CALCULATED" | "REVIEW_REQUIRED" | "BLOCKED"
  currency: string
  grossAmount: string | null
  deductionsAmount: string | null
  netAmount: string | null
  components: PayrollCalculationComponent[]
  warnings: PayrollCalculationIssue[]
  blocks: PayrollCalculationIssue[]
  compensationSnapshot: PayrollCompensationVersionInput[]
  attendanceSnapshot: PayrollEmployeeCalculationInput["attendance"]
}

const MAX_CENTS = 99_999_999_999_999n
const moneyPattern = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/

function cents(value: string): bigint | null {
  if (!moneyPattern.test(value)) return null
  const [whole, fraction = ""] = value.split(".")
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"))
  return result <= MAX_CENTS ? result : null
}

function money(value: bigint): string {
  const absolute = value < 0n ? -value : value
  const sign = value < 0n ? "-" : ""
  return `${sign}${(absolute / 100n).toString()}.${(absolute % 100n)
    .toString()
    .padStart(2, "0")}`
}

function roundedQuotient(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator
  const remainder = numerator % denominator
  return remainder * 2n >= denominator ? quotient + 1n : quotient
}

function validDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  )
}

function dateIsCovered(
  version: PayrollCompensationVersionInput,
  date: string,
): boolean {
  return (
    version.effectiveFrom <= date &&
    (version.effectiveTo === null || version.effectiveTo >= date)
  )
}

function periodIsFullCalendarMonth(startDate: string, endDate: string) {
  if (!validDateKey(startDate) || !validDateKey(endDate)) return false
  const start = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(`${endDate}T00:00:00.000Z`)
  const lastDay = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  )
  return (
    start.getUTCDate() === 1 &&
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth() &&
    end.getTime() === lastDay.getTime()
  )
}

function issue(code: string, message: string, reference?: string) {
  return reference === undefined
    ? { code, message }
    : { code, message, reference }
}

function addIssue(
  target: PayrollCalculationIssue[],
  value: PayrollCalculationIssue,
) {
  if (
    !target.some(
      (existing) =>
        existing.code === value.code && existing.reference === value.reference,
    )
  )
    target.push(value)
}

function instant(value: Instant): Date {
  return value instanceof Date ? value : new Date(value)
}

function normalizedCompensation(
  versions: PayrollCompensationVersionInput[],
): PayrollCompensationVersionInput[] {
  return [...versions]
    .map((version) => ({
      ...version,
      baseRate:
        cents(version.baseRate) === null
          ? version.baseRate
          : money(cents(version.baseRate)!),
      components: [...version.components]
        .map((component) => ({
          ...component,
          amount:
            cents(component.amount) === null
              ? component.amount
              : money(cents(component.amount)!),
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort(
      (a, b) =>
        a.effectiveFrom.localeCompare(b.effectiveFrom) ||
        a.id.localeCompare(b.id),
    )
}

function normalizeAttendance(
  attendance: PayrollEmployeeCalculationInput["attendance"],
): PayrollEmployeeCalculationInput["attendance"] {
  return {
    policyMissing: attendance.policyMissing,
    expectedWorkdays: [...attendance.expectedWorkdays].sort((a, b) =>
      a.workDate.localeCompare(b.workDate),
    ),
    workdays: [...attendance.workdays]
      .map((day) => ({
        ...day,
        sessions: [...day.sessions]
          .map((session) => ({
            ...session,
            startedAt: instant(session.startedAt).toISOString(),
            endedAt: session.endedAt
              ? instant(session.endedAt).toISOString()
              : null,
            breaks: [...session.breaks]
              .map((pause) => ({
                ...pause,
                startedAt: instant(pause.startedAt).toISOString(),
                endedAt: pause.endedAt
                  ? instant(pause.endedAt).toISOString()
                  : null,
              }))
              .sort(
                (a, b) =>
                  a.startedAt.localeCompare(b.startedAt) ||
                  a.id.localeCompare(b.id),
              ),
          }))
          .sort(
            (a, b) =>
              instant(a.startedAt).getTime() - instant(b.startedAt).getTime() ||
              a.id.localeCompare(b.id),
          ),
      }))
      .sort(
        (a, b) =>
          a.workDate.localeCompare(b.workDate) || a.id.localeCompare(b.id),
      ),
    overtimeAdjustments: [...attendance.overtimeAdjustments].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
  }
}

function dayWorkMilliseconds(
  day: PayrollEmployeeCalculationInput["attendance"]["workdays"][number],
  blocks: PayrollCalculationIssue[],
  warnings: PayrollCalculationIssue[],
  attendanceAffectsPay: boolean,
): number | null {
  const closedSessions = day.sessions.filter((session) => {
    const closed =
      session.endedAt !== null && session.breaks.every((pause) => pause.endedAt)
    if (!closed)
      addIssue(
        warnings,
        issue(
          "ATTENDANCE_INCOMPLETE",
          "An attendance session or break is still open; its time needs review.",
          day.workDate,
        ),
      )
    return closed
  })

  for (const session of closedSessions) {
    if (session.pendingCorrections.length)
      addIssue(
        warnings,
        issue(
          "ATTENDANCE_CORRECTION_REVIEW",
          "A pending or verified attendance correction needs review.",
          session.id,
        ),
      )
  }

  if (day.sessions.length === 0) return 0
  if (closedSessions.length === 0) return null
  try {
    return attendanceWorkedMilliseconds(
      closedSessions.map((session) => ({
        startedAt: instant(session.startedAt),
        endedAt: instant(session.endedAt!),
        breaks: session.breaks.map((pause) => ({
          startedAt: instant(pause.startedAt),
          endedAt: instant(pause.endedAt!),
          isPaid: pause.isPaid,
        })),
      })),
    )
  } catch {
    addIssue(
      attendanceAffectsPay ? blocks : warnings,
      issue(
        "ATTENDANCE_DATA_INVALID",
        attendanceAffectsPay
          ? "Overlapping or invalid attendance intervals prevent a safe daily or hourly calculation."
          : "Overlapping or invalid attendance intervals need review; fixed monthly pay is not based on these hours.",
        day.workDate,
      ),
    )
    return null
  }
}

export function calculatePayrollEmployee(
  input: PayrollEmployeeCalculationInput,
): PayrollEmployeeCalculationResult {
  const compensationSnapshot = normalizedCompensation(
    input.compensationVersions,
  )
  const attendanceSnapshot = normalizeAttendance(input.attendance)
  const attendanceAffectsPay = compensationSnapshot.some(
    (version) => version.payType !== "MONTHLY",
  )
  const components: PayrollCalculationComponent[] = []
  const warnings: PayrollCalculationIssue[] = []
  const blocks: PayrollCalculationIssue[] = []
  const employee = { ...input.employee }
  const { startDate, endDate, frequency, currency } = input.period
  const validPeriod =
    validDateKey(startDate) && validDateKey(endDate) && startDate <= endDate

  if (!validPeriod)
    addIssue(
      blocks,
      issue("PAYROLL_PERIOD_INVALID", "The payroll period dates are invalid."),
    )
  if (currency !== "PHP")
    addIssue(
      blocks,
      issue("PAYROLL_CURRENCY_UNSUPPORTED", "Only PHP payroll is supported."),
    )
  if (!validDateKey(startDate) || !validDateKey(endDate))
    return {
      employee,
      status: "BLOCKED",
      currency,
      grossAmount: null,
      deductionsAmount: null,
      netAmount: null,
      components,
      warnings,
      blocks,
      compensationSnapshot,
      attendanceSnapshot,
    }
  if (!validDateKey(employee.startDate ?? ""))
    addIssue(
      blocks,
      issue(
        "EMPLOYEE_START_DATE_UNKNOWN",
        "The employee start date is missing or invalid.",
      ),
    )
  if (employee.startDate && employee.startDate > endDate)
    addIssue(
      blocks,
      issue(
        "EMPLOYEE_NOT_YET_STARTED",
        "The employee starts after this payroll period.",
      ),
    )
  if (employee.status === "INACTIVE")
    addIssue(
      blocks,
      issue(
        "EMPLOYEE_INACTIVE",
        "The employee has no recorded end date to establish period eligibility.",
      ),
    )
  if (employee.status === "ON_LEAVE")
    addIssue(
      blocks,
      issue(
        "LEAVE_POLICY_UNAVAILABLE",
        "Leave pay treatment is not configured.",
      ),
    )

  const hasCompensation = compensationSnapshot.length > 0
  if (!hasCompensation)
    addIssue(
      blocks,
      issue(
        "COMPENSATION_MISSING",
        "No compensation version is recorded for this employee.",
      ),
    )
  for (const version of compensationSnapshot) {
    if (
      !validDateKey(version.effectiveFrom) ||
      (version.effectiveTo && !validDateKey(version.effectiveTo))
    )
      addIssue(
        blocks,
        issue(
          "COMPENSATION_DATE_INVALID",
          "A compensation version has invalid effective dates.",
          version.id,
        ),
      )
    if (version.currency.trim() !== currency)
      addIssue(
        blocks,
        issue(
          "COMPENSATION_CURRENCY_MISMATCH",
          "Compensation currency does not match the payroll period.",
          version.id,
        ),
      )
    if (cents(version.baseRate) === null)
      addIssue(
        blocks,
        issue(
          "COMPENSATION_RATE_INVALID",
          "A compensation rate is outside the supported exact decimal range.",
          version.id,
        ),
      )
    for (const component of version.components)
      if (cents(component.amount) === null)
        addIssue(
          blocks,
          issue(
            "COMPENSATION_COMPONENT_INVALID",
            "A compensation component amount is outside the supported exact decimal range.",
            component.id,
          ),
        )
  }

  const actualDays = new Map<
    string,
    PayrollEmployeeCalculationInput["attendance"]["workdays"][number]
  >()
  for (const day of attendanceSnapshot.workdays) {
    if (actualDays.has(day.workDate))
      addIssue(
        attendanceAffectsPay ? blocks : warnings,
        issue(
          "ATTENDANCE_WORKDAY_DUPLICATE",
          "More than one attendance workday exists for a payroll date.",
          day.workDate,
        ),
      )
    else actualDays.set(day.workDate, day)
  }
  const expectedByDate = new Map<
    string,
    PayrollEmployeeCalculationInput["attendance"]["expectedWorkdays"][number]
  >()
  for (const expected of attendanceSnapshot.expectedWorkdays) {
    if (expectedByDate.has(expected.workDate))
      addIssue(
        attendanceAffectsPay ? blocks : warnings,
        issue(
          "ATTENDANCE_ASSIGNMENT_OVERLAP",
          "More than one attendance policy covers a payroll workday.",
          expected.workDate,
        ),
      )
    else expectedByDate.set(expected.workDate, expected)
  }

  const workedByDate = new Map<string, number | null>()
  for (const [workDate, day] of actualDays) {
    const milliseconds = dayWorkMilliseconds(
      day,
      blocks,
      warnings,
      attendanceAffectsPay,
    )
    workedByDate.set(workDate, milliseconds)
    const expected = expectedByDate.get(workDate)
    if (
      expected &&
      (expected.requiredMinutes !== day.requiredMinutes ||
        expected.isWorkingDay !== day.isWorkingDay)
    )
      addIssue(
        warnings,
        issue(
          "ATTENDANCE_POLICY_SNAPSHOT_DIFFERS",
          "The recorded workday policy differs from its effective schedule; review the attendance snapshot.",
          workDate,
        ),
      )
    if (
      day.isWorkingDay &&
      day.requiredMinutes > 0 &&
      day.overnightRequiresReview
    ) {
      for (const session of day.sessions) {
        if (!session.endedAt) continue
        let firstDate: string
        let lastDate: string
        try {
          firstDate = attendanceWorkDate(
            instant(session.startedAt),
            day.timeZone,
          )
          lastDate = attendanceWorkDate(instant(session.endedAt), day.timeZone)
        } catch {
          addIssue(
            blocks,
            issue(
              "ATTENDANCE_TIMEZONE_INVALID",
              "The attendance timezone cannot safely classify this workday.",
              workDate,
            ),
          )
          break
        }
        if (firstDate !== lastDate) {
          addIssue(
            warnings,
            issue(
              "OVERNIGHT_ATTENDANCE_REVIEW",
              "The attendance policy requires review of overnight work.",
              workDate,
            ),
          )
          break
        }
      }
    }
  }

  if (attendanceSnapshot.expectedWorkdays.length) {
    for (const expected of attendanceSnapshot.expectedWorkdays) {
      if (!expected.isWorkingDay || expected.requiredMinutes <= 0) continue
      const day = actualDays.get(expected.workDate)
      if (!day || day.sessions.length === 0)
        addIssue(
          warnings,
          issue(
            "ATTENDANCE_RECORD_MISSING",
            "Scheduled attendance is missing; no absence deduction is assumed.",
            expected.workDate,
          ),
        )
      const milliseconds = workedByDate.get(expected.workDate)
      if (
        milliseconds !== undefined &&
        milliseconds !== null &&
        milliseconds < expected.requiredMinutes * 60000
      )
        addIssue(
          warnings,
          issue(
            "ATTENDANCE_INCOMPLETE",
            "Recorded time is below the scheduled workday requirement.",
            expected.workDate,
          ),
        )
    }
  } else if (
    input.attendance.policyMissing &&
    compensationSnapshot.some((v) => v.payType !== "MONTHLY")
  ) {
    addIssue(
      blocks,
      issue(
        "ATTENDANCE_POLICY_MISSING",
        "Daily and hourly pay require an assigned attendance policy.",
      ),
    )
  }

  for (const adjustment of attendanceSnapshot.overtimeAdjustments) {
    if (adjustment.status === "APPROVED")
      addIssue(
        warnings,
        issue(
          "OVERTIME_NOT_PRICED",
          "Approved overtime is recorded but has no configured payroll rate or multiplier.",
          adjustment.id,
        ),
      )
    else if (
      adjustment.status === "PENDING" ||
      adjustment.status === "VERIFIED"
    )
      addIssue(
        warnings,
        issue(
          "OVERTIME_REVIEW_PENDING",
          "Overtime is not in a final attendance status and cannot be priced.",
          adjustment.id,
        ),
      )
  }

  let baseCents = 0n
  if (
    employee.startDate &&
    employee.startDate > startDate &&
    compensationSnapshot.some((v) => v.payType === "MONTHLY")
  )
    addIssue(
      blocks,
      issue(
        "EMPLOYEE_START_PRORATION_UNSUPPORTED",
        "Monthly pay cannot be prorated for a mid-period start.",
      ),
    )

  const versionsIntersecting = compensationSnapshot.filter(
    (version) =>
      version.effectiveFrom <= endDate &&
      (version.effectiveTo === null || version.effectiveTo >= startDate),
  )
  const coveringVersions = compensationSnapshot.filter(
    (version) =>
      version.effectiveFrom <= startDate &&
      (version.effectiveTo === null || version.effectiveTo >= endDate),
  )
  if (hasCompensation && versionsIntersecting.length === 0)
    addIssue(
      blocks,
      issue(
        "COMPENSATION_GAP",
        "No compensation version overlaps this payroll period.",
      ),
    )

  const intersectingPayTypes = new Set(
    versionsIntersecting.map(({ payType }) => payType),
  )
  if (intersectingPayTypes.size > 1)
    addIssue(
      blocks,
      issue(
        "COMPENSATION_PAY_TYPE_REVISION_UNSUPPORTED",
        "Pay type changes inside this payroll period and require manual review.",
      ),
    )

  if (intersectingPayTypes.has("MONTHLY")) {
    const monthlyVersions = versionsIntersecting.filter(
      (version) => version.payType === "MONTHLY",
    )
    if (monthlyVersions.length === 0) {
      addIssue(
        blocks,
        issue(
          "COMPENSATION_MISSING",
          "No monthly compensation covers this payroll period.",
        ),
      )
    } else if (frequency !== "MONTHLY") {
      addIssue(
        blocks,
        issue(
          "MONTHLY_SEMIMONTHLY_UNSUPPORTED",
          "Monthly salary cannot be divided across semi-monthly runs without a configured allocation rule.",
        ),
      )
    } else if (!periodIsFullCalendarMonth(startDate, endDate)) {
      addIssue(
        blocks,
        issue(
          "MONTHLY_PARTIAL_PERIOD_UNSUPPORTED",
          "Monthly salary cannot be prorated for a partial calendar month.",
        ),
      )
    } else if (monthlyVersions.length !== 1 || coveringVersions.length !== 1) {
      addIssue(
        blocks,
        issue(
          "MONTHLY_RATE_REVISION_UNSUPPORTED",
          "Monthly salary versions change inside this period; no proration rule is configured.",
        ),
      )
    } else {
      const version = monthlyVersions[0]!
      const amount = cents(version.baseRate)
      if (amount !== null) {
        baseCents += amount
        components.push({
          componentType: "BASE_EARNING",
          status: "CALCULATED",
          sourceId: version.id,
          name: "Monthly base pay",
          amount: money(amount),
          metadata: { payType: "MONTHLY", compensationVersionId: version.id },
        })
      }
    }
  }

  const unitVersions = versionsIntersecting.filter(
    (version) =>
      (version.payType === "DAILY" || version.payType === "HOURLY") &&
      !intersectingPayTypes.has("MONTHLY"),
  )
  if (unitVersions.length) {
    if (
      input.attendance.policyMissing ||
      attendanceSnapshot.expectedWorkdays.length === 0
    ) {
      addIssue(
        blocks,
        issue(
          "ATTENDANCE_POLICY_MISSING",
          "Daily and hourly pay require an assigned attendance policy with scheduled workdays.",
        ),
      )
    } else {
      const groups = new Map<
        string,
        {
          version: PayrollCompensationVersionInput
          cents: bigint
          units: number
          milliseconds: bigint
        }
      >()
      let verifiableDays = 0
      for (const expected of attendanceSnapshot.expectedWorkdays) {
        if (!expected.isWorkingDay || expected.requiredMinutes <= 0) continue
        if (employee.startDate && expected.workDate < employee.startDate)
          continue
        const day = actualDays.get(expected.workDate)
        if (!day || day.sessions.length === 0) continue
        const workedMilliseconds = workedByDate.get(expected.workDate)
        if (workedMilliseconds === null || workedMilliseconds === undefined)
          continue
        const requiredMilliseconds = day.requiredMinutes * 60_000
        if (workedMilliseconds > requiredMilliseconds)
          addIssue(
            warnings,
            issue(
              "OVERTIME_NOT_PRICED",
              "Time beyond the scheduled workday is not priced without an overtime rate.",
              expected.workDate,
            ),
          )
        const amountableMilliseconds = Math.min(
          workedMilliseconds,
          requiredMilliseconds,
        )
        const complete = workedMilliseconds >= requiredMilliseconds
        if (amountableMilliseconds > 0) verifiableDays += 1
        if (!complete)
          addIssue(
            warnings,
            issue(
              "ATTENDANCE_INCOMPLETE",
              "Recorded time is below the scheduled workday requirement.",
              expected.workDate,
            ),
          )

        const versionMatches = compensationSnapshot.filter((version) =>
          dateIsCovered(version, expected.workDate),
        )
        if (versionMatches.length !== 1) {
          addIssue(
            blocks,
            issue(
              versionMatches.length === 0
                ? "COMPENSATION_GAP"
                : "COMPENSATION_OVERLAP",
              versionMatches.length === 0
                ? "No compensation version covers a scheduled attendance date."
                : "More than one compensation version covers a scheduled attendance date.",
              expected.workDate,
            ),
          )
          continue
        }
        const version = versionMatches[0]!
        if (version.payType !== "DAILY" && version.payType !== "HOURLY") {
          addIssue(
            blocks,
            issue(
              "COMPENSATION_PAY_TYPE_MISMATCH",
              "The effective compensation version does not define a daily or hourly rate.",
              version.id,
            ),
          )
          continue
        }
        const rate = cents(version.baseRate)
        if (rate === null) continue
        const group = groups.get(version.id) ?? {
          version,
          cents: 0n,
          units: 0,
          milliseconds: 0n,
        }
        if (version.payType === "DAILY") {
          if (complete) {
            group.cents += rate
            group.units += 1
          }
        } else {
          group.milliseconds += BigInt(amountableMilliseconds)
          group.units += amountableMilliseconds > 0 ? 1 : 0
        }
        groups.set(version.id, group)
      }

      for (const group of groups.values()) {
        let amount = group.cents
        const metadata: PayrollCalculationComponent["metadata"] = {
          payType: group.version.payType,
          compensationVersionId: group.version.id,
          workdayCount: group.units,
        }
        if (group.version.payType === "HOURLY") {
          const rate = cents(group.version.baseRate)!
          amount = roundedQuotient(rate * group.milliseconds, 3_600_000n)
          metadata.workedMilliseconds = Number(group.milliseconds)
        }
        if (amount > MAX_CENTS) {
          addIssue(
            blocks,
            issue(
              "CALCULATED_AMOUNT_OUT_OF_RANGE",
              "The calculated amount exceeds the supported money range.",
              group.version.id,
            ),
          )
          continue
        }
        baseCents += amount
        components.push({
          componentType: "BASE_EARNING",
          status: "CALCULATED",
          sourceId: group.version.id,
          name:
            group.version.payType === "DAILY"
              ? "Daily base pay"
              : "Hourly base pay",
          amount: money(amount),
          metadata,
        })
      }
      if (verifiableDays === 0)
        addIssue(
          blocks,
          issue(
            "NO_VERIFIABLE_WORKDAYS",
            "No scheduled workday has recorded attendance that can support a daily or hourly amount.",
          ),
        )
    }
  }

  let allowanceCents = 0n
  let deductionCents = 0n
  const componentEligible =
    frequency === "MONTHLY" &&
    periodIsFullCalendarMonth(startDate, endDate) &&
    coveringVersions.length === 1
  const componentVersions = componentEligible
    ? coveringVersions
    : versionsIntersecting
  for (const version of componentVersions) {
    for (const component of version.components) {
      const amount = cents(component.amount)
      if (
        !componentEligible ||
        !coveringVersions.some(({ id }) => id === version.id)
      ) {
        components.push({
          componentType:
            component.type === "ALLOWANCE" ? "ALLOWANCE" : "DEDUCTION",
          status: "UNRESOLVED",
          sourceId: component.id,
          name: component.name,
          amount: null,
          metadata: {
            compensationVersionId: version.id,
            calculationType: component.calculationType,
          },
        })
        addIssue(
          warnings,
          issue(
            "FIXED_COMPONENT_ALLOCATION_UNSUPPORTED",
            "A fixed recurring component cannot be allocated to this partial or semi-monthly period.",
            component.id,
          ),
        )
        continue
      }
      if (amount === null) continue
      const isAllowance = component.type === "ALLOWANCE"
      if (isAllowance) allowanceCents += amount
      else deductionCents += amount
      components.push({
        componentType: isAllowance ? "ALLOWANCE" : "DEDUCTION",
        status: "CALCULATED",
        sourceId: component.id,
        name: component.name,
        amount: money(amount),
        metadata: {
          compensationVersionId: version.id,
          calculationType: component.calculationType,
        },
      })
    }
  }
  const grossCents = baseCents + allowanceCents
  const netCents = grossCents - deductionCents
  if (grossCents > MAX_CENTS || deductionCents > MAX_CENTS)
    addIssue(
      blocks,
      issue(
        "CALCULATED_AMOUNT_OUT_OF_RANGE",
        "The calculated amount exceeds the supported money range.",
      ),
    )
  if (netCents < 0n)
    addIssue(
      blocks,
      issue(
        "DEDUCTIONS_EXCEED_GROSS",
        "Recorded recurring deductions exceed known earnings; manual review is required.",
      ),
    )

  const status = blocks.length
    ? "BLOCKED"
    : warnings.length
      ? "REVIEW_REQUIRED"
      : "CALCULATED"

  return result(status)

  function result(
    status: PayrollEmployeeCalculationResult["status"],
  ): PayrollEmployeeCalculationResult {
    const ready = status !== "BLOCKED"
    return {
      employee,
      status,
      currency,
      grossAmount: ready ? money(grossCents) : null,
      deductionsAmount: ready ? money(deductionCents) : null,
      netAmount: ready ? money(netCents) : null,
      components,
      warnings,
      blocks,
      compensationSnapshot,
      attendanceSnapshot,
    }
  }
}
