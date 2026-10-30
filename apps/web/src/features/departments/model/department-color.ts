export const departmentColorValues = [
  "blue",
  "violet",
  "pink",
  "orange",
  "teal",
  "amber",
  "slate",
  "green",
  "red",
  "brown",
  "cyan",
] as const

export type DepartmentColor = (typeof departmentColorValues)[number]
