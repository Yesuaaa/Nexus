/** Shared Prisma selects for the summaries embedded in account/employee DTOs. */
import type { Prisma } from "../../generated/prisma/client.js"

export const departmentSummarySelect = {
  id: true,
  name: true,
  code: true,
  color: true,
} as const satisfies Prisma.DepartmentSelect

export const teamSummarySelect = {
  id: true,
  name: true,
} as const satisfies Prisma.TeamSelect
