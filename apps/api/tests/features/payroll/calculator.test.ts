import assert from "node:assert/strict"
import { test } from "node:test"
import { validateCompensationVersion } from "../../../src/features/payroll/payroll.schema.js"
import {
  calculatePayrollEmployee,
  type PayrollEmployeeCalculationInput,
} from "../../../src/features/payroll/payroll-calculator.js"

function baseInput(
  patch: Partial<PayrollEmployeeCalculationInput> = {},
): PayrollEmployeeCalculationInput {
  return {
    period: {
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      frequency: "MONTHLY",
      currency: "PHP",
    },
    employee: {
      id: "employee-1",
      employeeNumber: "EMP-001",
      fullName: "Taylor Employee",
      employmentType: "FULL_TIME",
      status: "ACTIVE",
      startDate: "2025-01-01",
    },
    compensationVersions: [
      {
        id: "comp-1",
        payType: "MONTHLY",
        baseRate: "25000.00",
        currency: "PHP",
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        components: [],
      },
    ],
    attendance: {
      policyMissing: false,
      expectedWorkdays: [],
      workdays: [],
      overtimeAdjustments: [],
    },
    ...patch,
  }
}

test("compensation validator rejects unsafe monetary representations and preserves zero components", () => {
  const input = {
    payType: "MONTHLY",
    baseRate: "1.00",
    currency: "PHP",
    effectiveFrom: "2026-01-01",
    changeReason: "Boundary regression",
    components: [{ type: "ALLOWANCE", name: "Zero component", amount: "0.00" }],
  }
  assert.ok("value" in validateCompensationVersion(input))
  for (const baseRate of [
    "0",
    "0.00",
    "-1",
    "1.001",
    "10000000000.00",
    "NaN",
    "Infinity",
    "1e3",
    "",
    " 1.00",
    1,
    NaN,
    Infinity,
    null,
  ]) {
    assert.ok(
      "error" in validateCompensationVersion({ ...input, baseRate }),
      String(baseRate),
    )
  }
  for (const amount of ["-0.01", "0.001", "10000000000", "NaN", null, 0]) {
    assert.ok(
      "error" in
        validateCompensationVersion({
          ...input,
          components: [{ ...input.components[0], amount }],
        }),
      String(amount),
    )
  }
  assert.ok(
    "value" in
      validateCompensationVersion({ ...input, baseRate: "9999999999.99" }),
  )
})

test("deductions above gross and aggregate overflow block final financial values", () => {
  const input = baseInput()
  const version = input.compensationVersions[0]!
  const excessive = calculatePayrollEmployee(
    baseInput({
      compensationVersions: [
        {
          ...version,
          components: [
            {
              id: "deduction",
              type: "RECURRING_DEDUCTION",
              name: "Excess deduction",
              amount: "25000.01",
              calculationType: "FIXED",
            },
          ],
        },
      ],
    }),
  )
  assert.equal(excessive.status, "BLOCKED")
  assert.equal(excessive.netAmount, null)
  assert.ok(
    excessive.blocks.some(({ code }) => code === "DEDUCTIONS_EXCEED_GROSS"),
  )
  const overflow = calculatePayrollEmployee(
    baseInput({
      compensationVersions: [
        {
          ...version,
          baseRate: "999999999999.99",
          components: [
            {
              id: "allowance",
              type: "ALLOWANCE",
              name: "Overflow cent",
              amount: "0.01",
              calculationType: "FIXED",
            },
          ],
        },
      ],
    }),
  )
  assert.equal(overflow.status, "BLOCKED")
  assert.equal(overflow.netAmount, null)
  const exact = calculatePayrollEmployee(
    baseInput({
      compensationVersions: [
        {
          ...version,
          baseRate: "0.01",
          components: [
            {
              id: "zero",
              type: "ALLOWANCE",
              name: "Zero",
              amount: "0.00",
              calculationType: "FIXED",
            },
          ],
        },
      ],
    }),
  )
  assert.equal(exact.grossAmount, "0.01")
  assert.equal(exact.deductionsAmount, "0.00")
  assert.equal(exact.netAmount, "0.01")
})

function attendanceDay(
  workDate: string,
  requiredMinutes = 480,
  sessions: PayrollEmployeeCalculationInput["attendance"]["workdays"][number]["sessions"] = [
    {
      id: `session-${workDate}`,
      startedAt: new Date(`${workDate}T09:00:00.000Z`),
      endedAt: new Date(`${workDate}T17:00:00.000Z`),
      breaks: [
        {
          id: `break-${workDate}`,
          startedAt: new Date(`${workDate}T12:00:00.000Z`),
          endedAt: new Date(`${workDate}T13:00:00.000Z`),
          isPaid: false,
        },
      ],
      pendingCorrections: [],
    },
  ],
) {
  return {
    id: `day-${workDate}`,
    workDate,
    assignmentId: "assignment-1",
    policyId: "policy-1",
    policyName: "Standard",
    timeZone: "Asia/Manila",
    isWorkingDay: true,
    requiredMinutes,
    unpaidBreaksEnabled: true,
    overnightRequiresReview: false,
    sessions,
  }
}

test("monthly rate and fixed components calculate for a fully covered calendar month", () => {
  const input = baseInput({
    compensationVersions: [
      {
        id: "comp-1",
        payType: "MONTHLY",
        baseRate: "25000.00",
        currency: "PHP",
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        components: [
          {
            id: "allowance-1",
            type: "ALLOWANCE",
            name: "Internet",
            amount: "500.00",
            calculationType: "FIXED",
          },
          {
            id: "deduction-1",
            type: "RECURRING_DEDUCTION",
            name: "Equipment",
            amount: "1000.00",
            calculationType: "FIXED",
          },
        ],
      },
    ],
  })

  const result = calculatePayrollEmployee(input)
  assert.equal(result.status, "CALCULATED")
  assert.equal(result.grossAmount, "25500.00")
  assert.equal(result.deductionsAmount, "1000.00")
  assert.equal(result.netAmount, "24500.00")
  assert.deepEqual(
    result.components.map(({ componentType, amount }) => [
      componentType,
      amount,
    ]),
    [
      ["BASE_EARNING", "25000.00"],
      ["ALLOWANCE", "500.00"],
      ["DEDUCTION", "1000.00"],
    ],
  )
})

test("[PAY-CALC-001] monthly compensation includes both inclusive period boundaries", () => {
  const version = {
    id: "comp-period-boundary",
    payType: "MONTHLY" as const,
    baseRate: "25000.00",
    currency: "PHP",
    effectiveFrom: "2026-11-01",
    effectiveTo: "2026-11-30",
    components: [],
  }
  const calculate = (effectiveFrom: string, effectiveTo: string) =>
    calculatePayrollEmployee(
      baseInput({
        compensationVersions: [{ ...version, effectiveFrom, effectiveTo }],
      }),
    )

  const exactlyCovered = calculate("2026-11-01", "2026-11-30")
  assert.equal(exactlyCovered.status, "CALCULATED")
  assert.equal(exactlyCovered.grossAmount, "25000.00")
  assert.equal(exactlyCovered.netAmount, "25000.00")

  for (const [effectiveFrom, effectiveTo] of [
    ["2026-11-02", "2026-11-30"],
    ["2026-11-01", "2026-11-29"],
  ]) {
    const partial = calculate(effectiveFrom, effectiveTo)
    assert.equal(partial.status, "BLOCKED")
    assert.equal(partial.grossAmount, null)
    assert.ok(
      partial.blocks.some(
        ({ code }) => code === "MONTHLY_RATE_REVISION_UNSUPPORTED",
      ),
    )
  }
})

test("same-named compensation components remain separate calculated line items", () => {
  const input = baseInput({
    compensationVersions: [
      {
        id: "comp-duplicates",
        payType: "MONTHLY",
        baseRate: "25000.00",
        currency: "PHP",
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        components: [
          {
            id: "allowance-one",
            type: "ALLOWANCE",
            name: "Transport",
            amount: "500.00",
            calculationType: "FIXED",
          },
          {
            id: "allowance-two",
            type: "ALLOWANCE",
            name: "Transport",
            amount: "250.00",
            calculationType: "FIXED",
          },
          {
            id: "deduction-one",
            type: "RECURRING_DEDUCTION",
            name: "Equipment",
            amount: "100.00",
            calculationType: "FIXED",
          },
          {
            id: "deduction-two",
            type: "RECURRING_DEDUCTION",
            name: "Equipment",
            amount: "50.00",
            calculationType: "FIXED",
          },
        ],
      },
    ],
  })

  const result = calculatePayrollEmployee(input)
  assert.equal(result.status, "CALCULATED")
  assert.equal(result.grossAmount, "25750.00")
  assert.equal(result.deductionsAmount, "150.00")
  assert.equal(result.netAmount, "25600.00")
  assert.deepEqual(
    result.components
      .filter(({ name }) => name === "Transport" || name === "Equipment")
      .map(({ name, amount }) => [name, amount]),
    [
      ["Transport", "500.00"],
      ["Transport", "250.00"],
      ["Equipment", "100.00"],
      ["Equipment", "50.00"],
    ],
  )
})

test("monthly compensation revisions inside a period are blocked and snapshotted", () => {
  const result = calculatePayrollEmployee(
    baseInput({
      compensationVersions: [
        {
          id: "comp-nov-1",
          payType: "MONTHLY",
          baseRate: "25000.00",
          currency: "PHP",
          effectiveFrom: "2026-11-01",
          effectiveTo: "2026-11-15",
          components: [],
        },
        {
          id: "comp-nov-2",
          payType: "MONTHLY",
          baseRate: "30000.00",
          currency: "PHP",
          effectiveFrom: "2026-11-16",
          effectiveTo: null,
          components: [],
        },
      ],
    }),
  )

  assert.equal(result.status, "BLOCKED")
  assert.equal(result.grossAmount, null)
  assert.ok(
    result.blocks.some(
      ({ code }) => code === "MONTHLY_RATE_REVISION_UNSUPPORTED",
    ),
  )
  assert.deepEqual(
    result.compensationSnapshot.map(({ id, baseRate }) => [id, baseRate]),
    [
      ["comp-nov-1", "25000.00"],
      ["comp-nov-2", "30000.00"],
    ],
  )
})

test("monthly salary in a semi-monthly period is blocked without proration", () => {
  const result = calculatePayrollEmployee(
    baseInput({
      period: {
        startDate: "2026-11-01",
        endDate: "2026-11-15",
        frequency: "SEMI_MONTHLY",
        currency: "PHP",
      },
    }),
  )

  assert.equal(result.status, "BLOCKED")
  assert.ok(
    result.blocks.some(
      ({ code }) => code === "MONTHLY_SEMIMONTHLY_UNSUPPORTED",
    ),
  )
})

test("fixed recurring components stay unresolved on a semi-monthly period", () => {
  const result = calculatePayrollEmployee(
    baseInput({
      period: {
        startDate: "2026-11-01",
        endDate: "2026-11-15",
        frequency: "SEMI_MONTHLY",
        currency: "PHP",
      },
      compensationVersions: [
        {
          id: "comp-1",
          payType: "MONTHLY",
          baseRate: "25000.00",
          currency: "PHP",
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          components: [
            {
              id: "allowance-1",
              type: "ALLOWANCE",
              name: "Internet",
              amount: "500.00",
              calculationType: "FIXED",
            },
          ],
        },
      ],
    }),
  )

  assert.equal(result.status, "BLOCKED")
  assert.deepEqual(
    result.components.map(({ status, amount }) => [status, amount]),
    [["UNRESOLVED", null]],
  )
  assert.ok(
    result.warnings.some(
      ({ code }) => code === "FIXED_COMPONENT_ALLOCATION_UNSUPPORTED",
    ),
  )
})

test("contractors paid daily can be calculated from completed scheduled days", () => {
  const date = "2026-11-02"
  const result = calculatePayrollEmployee(
    baseInput({
      employee: {
        id: "contractor-1",
        employeeNumber: "CTR-01",
        fullName: "Morgan Contractor",
        employmentType: "CONTRACT",
        status: "ACTIVE",
        startDate: "2025-01-01",
      },
      compensationVersions: [
        {
          id: "daily-1",
          payType: "DAILY",
          baseRate: "1200.00",
          currency: "PHP",
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          components: [],
        },
      ],
      attendance: {
        policyMissing: false,
        expectedWorkdays: [
          {
            workDate: date,
            assignmentId: "assignment-1",
            policyId: "policy-1",
            policyName: "Standard",
            isWorkingDay: true,
            requiredMinutes: 420,
          },
        ],
        workdays: [attendanceDay(date, 420)],
        overtimeAdjustments: [],
      },
    }),
  )

  assert.equal(result.status, "CALCULATED")
  assert.equal(result.grossAmount, "1200.00")
  assert.ok(result.attendanceSnapshot.workdays.length === 1)
})

test("[PAY-CALC-001] daily compensation requires every scheduled minute", () => {
  const date = "2026-11-02"
  const calculate = (endedAt: string) =>
    calculatePayrollEmployee(
      baseInput({
        compensationVersions: [
          {
            id: "daily-threshold",
            payType: "DAILY",
            baseRate: "1200.00",
            currency: "PHP",
            effectiveFrom: "2026-01-01",
            effectiveTo: null,
            components: [],
          },
        ],
        attendance: {
          policyMissing: false,
          expectedWorkdays: [
            {
              workDate: date,
              assignmentId: "assignment-1",
              policyId: "policy-1",
              policyName: "Standard",
              isWorkingDay: true,
              requiredMinutes: 420,
            },
          ],
          workdays: [
            attendanceDay(date, 420, [
              {
                id: "daily-threshold-session",
                startedAt: new Date(`${date}T09:00:00.000Z`),
                endedAt: new Date(endedAt),
                breaks: [],
                pendingCorrections: [],
              },
            ]),
          ],
          overtimeAdjustments: [],
        },
      }),
    )

  const oneMinuteShort = calculate(`${date}T15:59:00.000Z`)
  assert.equal(oneMinuteShort.status, "REVIEW_REQUIRED")
  assert.equal(oneMinuteShort.grossAmount, "0.00")
  assert.equal(oneMinuteShort.netAmount, "0.00")
  assert.ok(
    oneMinuteShort.warnings.some(
      ({ code }) => code === "ATTENDANCE_INCOMPLETE",
    ),
  )

  const exactlyScheduled = calculate(`${date}T16:00:00.000Z`)
  assert.equal(exactlyScheduled.status, "CALCULATED")
  assert.equal(exactlyScheduled.grossAmount, "1200.00")
  assert.equal(exactlyScheduled.netAmount, "1200.00")
})

test("hourly pay subtracts unpaid breaks and never pays overtime without a rate", () => {
  const date = "2026-11-02"
  const result = calculatePayrollEmployee(
    baseInput({
      compensationVersions: [
        {
          id: "hourly-1",
          payType: "HOURLY",
          baseRate: "125.55",
          currency: "PHP",
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          components: [],
        },
      ],
      attendance: {
        policyMissing: false,
        expectedWorkdays: [
          {
            workDate: date,
            assignmentId: "assignment-1",
            policyId: "policy-1",
            policyName: "Standard",
            isWorkingDay: true,
            requiredMinutes: 420,
          },
        ],
        workdays: [attendanceDay(date, 420)],
        overtimeAdjustments: [
          {
            id: "overtime-1",
            status: "APPROVED",
            overtimeMinutes: 60,
          },
          {
            id: "overtime-2",
            status: "PENDING",
            overtimeMinutes: 30,
          },
        ],
      },
    }),
  )

  assert.equal(result.status, "REVIEW_REQUIRED")
  assert.equal(result.grossAmount, "878.85")
  assert.equal(result.deductionsAmount, "0.00")
  assert.equal(result.netAmount, "878.85")
  assert.ok(result.warnings.some(({ code }) => code === "OVERTIME_NOT_PRICED"))
  assert.ok(
    result.warnings.some(({ code }) => code === "OVERTIME_REVIEW_PENDING"),
  )
})

test("hourly calculation rounds an exact fractional-cent result once to cents", () => {
  const date = "2026-11-02"
  const result = calculatePayrollEmployee(
    baseInput({
      compensationVersions: [
        {
          id: "hourly-1",
          payType: "HOURLY",
          baseRate: "125.55",
          currency: "PHP",
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          components: [],
        },
      ],
      attendance: {
        policyMissing: false,
        expectedWorkdays: [
          {
            workDate: date,
            assignmentId: "assignment-1",
            policyId: "policy-1",
            policyName: "Short shift",
            isWorkingDay: true,
            requiredMinutes: 30,
          },
        ],
        workdays: [
          {
            ...attendanceDay(date, 30, [
              {
                id: "session-short",
                startedAt: new Date(`${date}T09:00:00.000Z`),
                endedAt: new Date(`${date}T09:30:00.000Z`),
                breaks: [],
                pendingCorrections: [],
              },
            ]),
          },
        ],
        overtimeAdjustments: [],
      },
    }),
  )

  assert.equal(result.grossAmount, "62.78")
})

test("hourly calculation caps recorded time at the scheduled workday requirement", () => {
  const date = "2026-11-02"
  const result = calculatePayrollEmployee(
    baseInput({
      compensationVersions: [
        {
          id: "hourly-1",
          payType: "HOURLY",
          baseRate: "100.00",
          currency: "PHP",
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          components: [],
        },
      ],
      attendance: {
        policyMissing: false,
        expectedWorkdays: [
          {
            workDate: date,
            assignmentId: "assignment-1",
            policyId: "policy-1",
            policyName: "Standard",
            isWorkingDay: true,
            requiredMinutes: 480,
          },
        ],
        workdays: [
          attendanceDay(date, 480, [
            {
              id: "long-shift",
              startedAt: new Date(`${date}T08:00:00.000Z`),
              endedAt: new Date(`${date}T18:00:00.000Z`),
              breaks: [],
              pendingCorrections: [],
            },
          ]),
        ],
        overtimeAdjustments: [],
      },
    }),
  )

  assert.equal(result.status, "REVIEW_REQUIRED")
  assert.equal(result.grossAmount, "800.00")
  assert.ok(result.warnings.some(({ code }) => code === "OVERTIME_NOT_PRICED"))
})

test("missing daily attendance blocks rather than assuming an unpaid absence", () => {
  const result = calculatePayrollEmployee(
    baseInput({
      compensationVersions: [
        {
          id: "daily-1",
          payType: "DAILY",
          baseRate: "1200.00",
          currency: "PHP",
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          components: [],
        },
      ],
      attendance: {
        policyMissing: false,
        expectedWorkdays: [
          {
            workDate: "2026-11-02",
            assignmentId: "assignment-1",
            policyId: "policy-1",
            policyName: "Standard",
            isWorkingDay: true,
            requiredMinutes: 480,
          },
        ],
        workdays: [],
        overtimeAdjustments: [],
      },
    }),
  )

  assert.equal(result.status, "BLOCKED")
  assert.equal(result.grossAmount, null)
  assert.ok(
    result.warnings.some(({ code }) => code === "ATTENDANCE_RECORD_MISSING"),
  )
  assert.ok(result.blocks.some(({ code }) => code === "NO_VERIFIABLE_WORKDAYS"))
})

test("missing compensation and leave status are explicit blockers", () => {
  const noCompensation = calculatePayrollEmployee(
    baseInput({ compensationVersions: [] }),
  )
  assert.equal(noCompensation.status, "BLOCKED")
  assert.ok(
    noCompensation.blocks.some(({ code }) => code === "COMPENSATION_MISSING"),
  )

  const onLeave = calculatePayrollEmployee(
    baseInput({
      employee: {
        id: "employee-1",
        employeeNumber: "EMP-001",
        fullName: "Taylor Employee",
        employmentType: "FULL_TIME",
        status: "ON_LEAVE",
        startDate: "2025-01-01",
      },
    }),
  )
  assert.equal(onLeave.status, "BLOCKED")
  assert.ok(
    onLeave.blocks.some(({ code }) => code === "LEAVE_POLICY_UNAVAILABLE"),
  )
})

test("an incomplete daily workday requires review and earns no full-day rate", () => {
  const date = "2026-11-02"
  const result = calculatePayrollEmployee(
    baseInput({
      compensationVersions: [
        {
          id: "daily-1",
          payType: "DAILY",
          baseRate: "1200.00",
          currency: "PHP",
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          components: [],
        },
      ],
      attendance: {
        policyMissing: false,
        expectedWorkdays: [
          {
            workDate: date,
            assignmentId: "assignment-1",
            policyId: "policy-1",
            policyName: "Standard",
            isWorkingDay: true,
            requiredMinutes: 480,
          },
        ],
        workdays: [
          attendanceDay(date, 480, [
            {
              id: "partial-day",
              startedAt: new Date(`${date}T09:00:00.000Z`),
              endedAt: new Date(`${date}T13:00:00.000Z`),
              breaks: [],
              pendingCorrections: [],
            },
          ]),
        ],
        overtimeAdjustments: [],
      },
    }),
  )

  assert.equal(result.status, "REVIEW_REQUIRED")
  assert.equal(result.grossAmount, "0.00")
  assert.ok(
    result.warnings.some(({ code }) => code === "ATTENDANCE_INCOMPLETE"),
  )
})

test("open sessions and pending corrections require review before final amounts", () => {
  const date = "2026-11-02"
  const hourly = {
    id: "hourly-1",
    payType: "HOURLY" as const,
    baseRate: "100.00",
    currency: "PHP",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    components: [],
  }
  const expected = [
    {
      workDate: date,
      assignmentId: "assignment-1",
      policyId: "policy-1",
      policyName: "Standard",
      isWorkingDay: true,
      requiredMinutes: 60,
    },
  ]
  const openSession = calculatePayrollEmployee(
    baseInput({
      compensationVersions: [hourly],
      attendance: {
        policyMissing: false,
        expectedWorkdays: expected,
        workdays: [
          attendanceDay(date, 60, [
            {
              id: "open-session",
              startedAt: new Date(`${date}T09:00:00.000Z`),
              endedAt: null,
              breaks: [],
              pendingCorrections: [],
            },
          ]),
        ],
        overtimeAdjustments: [],
      },
    }),
  )
  assert.equal(openSession.status, "BLOCKED")
  assert.equal(openSession.grossAmount, null)
  assert.ok(
    openSession.warnings.some(({ code }) => code === "ATTENDANCE_INCOMPLETE"),
  )

  const correctionReview = calculatePayrollEmployee(
    baseInput({
      compensationVersions: [hourly],
      attendance: {
        policyMissing: false,
        expectedWorkdays: expected,
        workdays: [
          attendanceDay(date, 60, [
            {
              id: "corrected-session",
              startedAt: new Date(`${date}T09:00:00.000Z`),
              endedAt: new Date(`${date}T10:00:00.000Z`),
              breaks: [],
              pendingCorrections: ["correction-1"],
            },
          ]),
        ],
        overtimeAdjustments: [],
      },
    }),
  )
  assert.equal(correctionReview.status, "REVIEW_REQUIRED")
  assert.equal(correctionReview.grossAmount, "100.00")
  assert.ok(
    correctionReview.warnings.some(
      ({ code }) => code === "ATTENDANCE_CORRECTION_REVIEW",
    ),
  )
})

test("unknown starts and inactive employees are blocked from payroll", () => {
  const unknownStart = calculatePayrollEmployee(
    baseInput({
      employee: {
        ...baseInput().employee,
        startDate: null,
      },
    }),
  )
  assert.equal(unknownStart.status, "BLOCKED")
  assert.ok(
    unknownStart.blocks.some(
      ({ code }) => code === "EMPLOYEE_START_DATE_UNKNOWN",
    ),
  )

  const inactive = calculatePayrollEmployee(
    baseInput({
      employee: {
        ...baseInput().employee,
        status: "INACTIVE",
      },
    }),
  )
  assert.equal(inactive.status, "BLOCKED")
  assert.ok(inactive.blocks.some(({ code }) => code === "EMPLOYEE_INACTIVE"))
})

test("overlapping attendance sessions block hourly amounts from being double-counted", () => {
  const date = "2026-11-02"
  const result = calculatePayrollEmployee(
    baseInput({
      compensationVersions: [
        {
          id: "hourly-1",
          payType: "HOURLY",
          baseRate: "100.00",
          currency: "PHP",
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          components: [],
        },
      ],
      attendance: {
        policyMissing: false,
        expectedWorkdays: [
          {
            workDate: date,
            assignmentId: "assignment-1",
            policyId: "policy-1",
            policyName: "Standard",
            isWorkingDay: true,
            requiredMinutes: 480,
          },
        ],
        workdays: [
          attendanceDay(date, 480, [
            {
              id: "session-a",
              startedAt: new Date(`${date}T09:00:00.000Z`),
              endedAt: new Date(`${date}T13:00:00.000Z`),
              breaks: [],
              pendingCorrections: [],
            },
            {
              id: "session-b",
              startedAt: new Date(`${date}T12:00:00.000Z`),
              endedAt: new Date(`${date}T16:00:00.000Z`),
              breaks: [],
              pendingCorrections: [],
            },
          ]),
        ],
        overtimeAdjustments: [],
      },
    }),
  )

  assert.equal(result.status, "BLOCKED")
  assert.equal(result.grossAmount, null)
  assert.ok(
    result.blocks.some(({ code }) => code === "ATTENDANCE_DATA_INVALID"),
  )
})
