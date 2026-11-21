export type PayrollPeriodConfiguration = {
  id: string
  frequency: "MONTHLY" | "SEMI_MONTHLY"
  firstCutoffDay: number | null
  effectiveFrom: Date | string
  effectiveTo: Date | string | null
}

export type PayrollPeriodCandidate = {
  configurationId: string
  frequency: PayrollPeriodConfiguration["frequency"]
  startDate: string
  endDate: string
  cutoffLabel: string
}

function dateKey(value: Date | string, field: string): string {
  const key =
    value instanceof Date
      ? Number.isFinite(value.getTime())
        ? value.toISOString().slice(0, 10)
        : ""
      : value
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key))
    throw new RangeError(`${field} must be a valid date-only value`)
  const date = new Date(`${key}T00:00:00.000Z`)
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== key
  )
    throw new RangeError(`${field} must be a valid date-only value`)
  return key
}

function date(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function clippedPeriod(
  configuration: PayrollPeriodConfiguration,
  periodStart: string,
  periodEnd: string,
  cutoffLabel: string,
  effectiveFrom: string,
  effectiveTo: string | null,
): PayrollPeriodCandidate | null {
  const startDate = periodStart < effectiveFrom ? effectiveFrom : periodStart
  const boundedEnd =
    effectiveTo && effectiveTo < periodEnd ? effectiveTo : periodEnd
  if (startDate > boundedEnd) return null
  return {
    configurationId: configuration.id,
    frequency: configuration.frequency,
    startDate,
    endDate: boundedEnd,
    cutoffLabel,
  }
}

/**
 * Generate regular schedule periods intersecting the requested calendar year.
 * Configuration and period dates are inclusive date-only values in UTC.
 */
export function generatePayrollPeriodCandidates(
  configuration: PayrollPeriodConfiguration,
  year: number,
): PayrollPeriodCandidate[] {
  if (!Number.isInteger(year) || year < 1900 || year > 9999)
    throw new RangeError("Payroll period year must be from 1900 through 9999")
  if (!configuration.id.trim())
    throw new RangeError("Payroll configuration id is required")

  const effectiveFrom = dateKey(configuration.effectiveFrom, "effectiveFrom")
  const effectiveTo = configuration.effectiveTo
    ? dateKey(configuration.effectiveTo, "effectiveTo")
    : null
  if (effectiveTo && effectiveTo < effectiveFrom)
    throw new RangeError("Payroll configuration effective range is invalid")

  if (configuration.frequency === "MONTHLY") {
    if (configuration.firstCutoffDay !== null)
      throw new RangeError("Monthly schedules cannot define a cutoff day")
  } else if (
    configuration.frequency === "SEMI_MONTHLY" &&
    Number.isInteger(configuration.firstCutoffDay) &&
    configuration.firstCutoffDay! >= 1 &&
    configuration.firstCutoffDay! <= 27
  ) {
    // The configured cutoff is valid.
  } else {
    throw new RangeError("Payroll schedule definition is invalid")
  }

  const candidates: PayrollPeriodCandidate[] = []
  for (let month = 1; month <= 12; month += 1) {
    const lastDay = daysInMonth(year, month)
    const monthKey = `${year}-${String(month).padStart(2, "0")}`
    const segments =
      configuration.frequency === "MONTHLY"
        ? [{ startDay: 1, endDay: lastDay, label: monthKey }]
        : [
            {
              startDay: 1,
              endDay: configuration.firstCutoffDay!,
              label: `${monthKey} 1–${configuration.firstCutoffDay}`,
            },
            {
              startDay: configuration.firstCutoffDay! + 1,
              endDay: lastDay,
              label: `${monthKey} ${configuration.firstCutoffDay! + 1}–${lastDay}`,
            },
          ]

    for (const segment of segments) {
      const period = clippedPeriod(
        configuration,
        date(year, month, segment.startDay),
        date(year, month, segment.endDay),
        segment.label,
        effectiveFrom,
        effectiveTo,
      )
      if (period) candidates.push(period)
    }
  }
  return candidates
}
