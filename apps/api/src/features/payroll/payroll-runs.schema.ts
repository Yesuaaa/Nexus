type Validation<T> = { value: T } | { error: string }

function exactObject(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    return false
  const allowed = new Set([...required, ...optional])
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Reflect.ownKeys(value).every(
      (key) =>
        typeof key === "string" &&
        allowed.has(key) &&
        Object.hasOwn(
          Object.getOwnPropertyDescriptor(value, key) ?? {},
          "value",
        ),
    )
  )
}

export function validatePayrollPeriodGeneration(
  input: unknown,
): Validation<{ year: number }> {
  if (!exactObject(input, ["year"]))
    return { error: "Enter a payroll calendar year" }
  if (
    typeof input.year !== "number" ||
    !Number.isInteger(input.year) ||
    input.year < 1900 ||
    input.year > 9999
  )
    return { error: "Choose a year from 1900 through 9999" }
  return { value: { year: input.year } }
}

export function validatePayrollRunCreation(
  input: unknown,
): Validation<{ periodId: string }> {
  if (!exactObject(input, ["periodId"]))
    return { error: "Choose a payroll period" }
  if (
    typeof input.periodId !== "string" ||
    input.periodId.length < 1 ||
    input.periodId.length > 80
  )
    return { error: "Choose a valid payroll period" }
  return { value: { periodId: input.periodId } }
}
