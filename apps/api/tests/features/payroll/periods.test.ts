import assert from "node:assert/strict"
import { test } from "node:test"
import { generatePayrollPeriodCandidates } from "../../../src/features/payroll/payroll-periods.js"

const monthly = {
  id: "monthly",
  frequency: "MONTHLY" as const,
  firstCutoffDay: null,
  effectiveFrom: "2024-01-01",
  effectiveTo: null,
}

test("monthly periods use calendar month boundaries, including leap February", () => {
  const periods = generatePayrollPeriodCandidates(monthly, 2024)

  assert.deepEqual(
    periods.filter((period) => period.startDate.startsWith("2024-02")),
    [
      {
        configurationId: "monthly",
        frequency: "MONTHLY",
        startDate: "2024-02-01",
        endDate: "2024-02-29",
        cutoffLabel: "2024-02",
      },
    ],
  )
  assert.equal(periods[0]?.endDate, "2024-01-31")
  assert.equal(periods.at(-1)?.endDate, "2024-12-31")
})

test("semi-monthly periods respect cutoff days and month ends", () => {
  const periods = generatePayrollPeriodCandidates(
    {
      id: "semi",
      frequency: "SEMI_MONTHLY",
      firstCutoffDay: 15,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
    },
    2026,
  )

  assert.deepEqual(
    periods.slice(0, 2).map(({ startDate, endDate }) => [startDate, endDate]),
    [
      ["2026-01-01", "2026-01-15"],
      ["2026-01-16", "2026-01-31"],
    ],
  )
  assert.deepEqual(
    periods.slice(-2).map(({ startDate, endDate }) => [startDate, endDate]),
    [
      ["2026-12-01", "2026-12-15"],
      ["2026-12-16", "2026-12-31"],
    ],
  )

  const shortSecondPeriod = generatePayrollPeriodCandidates(
    {
      id: "cutoff-27",
      frequency: "SEMI_MONTHLY",
      firstCutoffDay: 27,
      effectiveFrom: "2026-02-01",
      effectiveTo: null,
    },
    2026,
  ).filter(({ startDate }) => startDate.startsWith("2026-02"))
  assert.deepEqual(
    shortSecondPeriod.map(({ startDate, endDate }) => [startDate, endDate]),
    [
      ["2026-02-01", "2026-02-27"],
      ["2026-02-28", "2026-02-28"],
    ],
  )
})

test("effective configuration boundaries clip regular periods without overlap", () => {
  const oldSchedule = generatePayrollPeriodCandidates(
    {
      id: "old",
      frequency: "MONTHLY",
      firstCutoffDay: null,
      effectiveFrom: "2026-01-01",
      effectiveTo: "2026-02-09",
    },
    2026,
  )
  const newSchedule = generatePayrollPeriodCandidates(
    {
      id: "new",
      frequency: "SEMI_MONTHLY",
      firstCutoffDay: 15,
      effectiveFrom: "2026-02-10",
      effectiveTo: "2026-03-20",
    },
    2026,
  )

  assert.deepEqual(
    oldSchedule.map(({ startDate, endDate }) => [startDate, endDate]),
    [
      ["2026-01-01", "2026-01-31"],
      ["2026-02-01", "2026-02-09"],
    ],
  )
  assert.deepEqual(
    newSchedule.map(({ startDate, endDate }) => [startDate, endDate]),
    [
      ["2026-02-10", "2026-02-15"],
      ["2026-02-16", "2026-02-28"],
      ["2026-03-01", "2026-03-15"],
      ["2026-03-16", "2026-03-20"],
    ],
  )
  assert.equal(oldSchedule.at(-1)?.endDate, "2026-02-09")
  assert.equal(newSchedule[0]?.startDate, "2026-02-10")
})

test("period generator returns nothing when configuration is outside the requested year", () => {
  assert.deepEqual(
    generatePayrollPeriodCandidates(
      {
        id: "past",
        frequency: "MONTHLY",
        firstCutoffDay: null,
        effectiveFrom: "2025-01-01",
        effectiveTo: "2025-12-31",
      },
      2026,
    ),
    [],
  )
})

test("period generator rejects invalid years and schedule definitions", () => {
  assert.throws(() => generatePayrollPeriodCandidates(monthly, 0), RangeError)
  assert.throws(
    () =>
      generatePayrollPeriodCandidates(
        {
          id: "bad-cutoff",
          frequency: "SEMI_MONTHLY",
          firstCutoffDay: 28,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
        },
        2026,
      ),
    RangeError,
  )
})
