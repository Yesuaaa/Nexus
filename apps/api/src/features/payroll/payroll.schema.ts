import {
  CompensationComponentType,
  PayrollFrequency,
  PayrollPayType,
} from "../../generated/prisma/client.js"

export type CompensationVersionInput = {
  payType: PayrollPayType
  baseRate: string
  currency: "PHP"
  effectiveFrom: Date
  changeReason: string
  components: {
    type: CompensationComponentType
    name: string
    amount: string
  }[]
}

export type PayrollConfigurationInput = {
  frequency: PayrollFrequency
  firstCutoffDay: number | null
  currency: "PHP"
  effectiveFrom: Date
  changeReason: string
}

type Validation<T> = { value: T } | { error: string }

const moneyPattern = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/

function hasExactKeys(
  value: unknown,
  allowed: readonly string[],
): value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    return false
  return Reflect.ownKeys(value).every(
    (key) =>
      typeof key === "string" &&
      allowed.includes(key) &&
      Object.hasOwn(Object.getOwnPropertyDescriptor(value, key) ?? {}, "value"),
  )
}

function money(value: unknown, allowZero: boolean): string | null {
  if (typeof value !== "string" || !moneyPattern.test(value)) return null
  const [whole, fraction = ""] = value.split(".")
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"))
  if ((!allowZero && cents === 0n) || cents > 999_999_999_999n) return null
  return `${whole}.${fraction.padEnd(2, "0")}`
}

function dateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? date
    : null
}

export function validateCompensationVersion(
  input: unknown,
): Validation<CompensationVersionInput> {
  const keys = [
    "payType",
    "baseRate",
    "currency",
    "effectiveFrom",
    "changeReason",
    "components",
  ]
  if (
    !hasExactKeys(input, keys) ||
    keys.some((key) => !Object.hasOwn(input, key))
  )
    return { error: "Enter a complete compensation version" }

  if (!Object.values(PayrollPayType).includes(input.payType as PayrollPayType))
    return { error: "Choose a valid pay type" }
  const baseRate = money(input.baseRate, false)
  if (!baseRate)
    return { error: "Enter a valid positive base rate with up to two decimals" }
  if (input.currency !== "PHP") return { error: "Currency must be PHP" }
  const effectiveFrom = dateOnly(input.effectiveFrom)
  if (!effectiveFrom) return { error: "Enter a valid effective date" }
  if (
    typeof input.changeReason !== "string" ||
    input.changeReason.trim().length < 3 ||
    input.changeReason.trim().length > 500 ||
    input.changeReason.includes("\u0000")
  )
    return { error: "Enter a reason between 3 and 500 characters" }
  if (
    !Array.isArray(input.components) ||
    Object.getPrototypeOf(input.components) !== Array.prototype ||
    input.components.length > 30 ||
    Reflect.ownKeys(input.components).length !== input.components.length + 1
  )
    return { error: "Enter up to 30 fixed compensation components" }

  const components: CompensationVersionInput["components"] = []
  for (const component of input.components) {
    if (
      !hasExactKeys(component, ["type", "name", "amount"]) ||
      ["type", "name", "amount"].some((key) => !Object.hasOwn(component, key))
    )
      return { error: "Enter valid fixed compensation components" }
    if (
      !Object.values(CompensationComponentType).includes(
        component.type as CompensationComponentType,
      )
    )
      return { error: "Choose a valid compensation component type" }
    if (
      typeof component.name !== "string" ||
      !component.name.trim() ||
      component.name.trim().length > 80 ||
      component.name.includes("\u0000")
    )
      return { error: "Enter a component name up to 80 characters" }
    const amount = money(component.amount, true)
    if (amount === null)
      return { error: "Enter a valid nonnegative component amount" }
    components.push({
      type: component.type as CompensationComponentType,
      name: component.name.trim(),
      amount,
    })
  }

  return {
    value: {
      payType: input.payType as PayrollPayType,
      baseRate,
      currency: "PHP",
      effectiveFrom,
      changeReason: input.changeReason.trim(),
      components,
    },
  }
}

export function validatePayrollConfiguration(
  input: unknown,
): Validation<PayrollConfigurationInput> {
  const keys = [
    "frequency",
    "firstCutoffDay",
    "currency",
    "effectiveFrom",
    "changeReason",
  ]
  if (
    !hasExactKeys(input, keys) ||
    !Object.hasOwn(input, "frequency") ||
    !Object.hasOwn(input, "effectiveFrom") ||
    !Object.hasOwn(input, "changeReason")
  )
    return { error: "Enter a complete payroll schedule" }
  if (
    !Object.values(PayrollFrequency).includes(
      input.frequency as PayrollFrequency,
    )
  )
    return { error: "Choose a valid payroll frequency" }
  const effectiveFrom = dateOnly(input.effectiveFrom)
  if (!effectiveFrom) return { error: "Enter a valid effective date" }
  const currency = input.currency === undefined ? "PHP" : input.currency
  if (currency !== "PHP") return { error: "Currency must be PHP" }
  if (
    typeof input.changeReason !== "string" ||
    input.changeReason.trim().length < 3 ||
    input.changeReason.trim().length > 500 ||
    input.changeReason.includes("\u0000")
  )
    return { error: "Enter a reason between 3 and 500 characters" }

  let firstCutoffDay: number | null = null
  if (input.frequency === PayrollFrequency.SEMI_MONTHLY) {
    if (
      !Number.isInteger(input.firstCutoffDay) ||
      Number(input.firstCutoffDay) < 1 ||
      Number(input.firstCutoffDay) > 27
    )
      return { error: "Choose a first cutoff day from 1 to 27" }
    firstCutoffDay = Number(input.firstCutoffDay)
  } else if (
    input.firstCutoffDay !== undefined &&
    input.firstCutoffDay !== null
  ) {
    return { error: "Monthly schedules use calendar-month boundaries" }
  }

  return {
    value: {
      frequency: input.frequency as PayrollFrequency,
      firstCutoffDay,
      currency: "PHP",
      effectiveFrom,
      changeReason: input.changeReason.trim(),
    },
  }
}

export function dateKey(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null
}
