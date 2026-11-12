import type { PillTone } from "@/components/ui/pill"
import type { EmploymentStatus, EmploymentType } from "../api/employees-api"

export const employmentTypeLabels: Record<EmploymentType, string> = {
  FULL_TIME: "Full Time",
  PART_TIME: "Part Time",
  CONTRACT: "Contract",
  INTERN: "Intern",
}

export const employmentStatusLabels: Record<EmploymentStatus, string> = {
  ACTIVE: "Active",
  ON_LEAVE: "On Leave",
  INACTIVE: "Inactive",
}

export const employmentStatusTones: Record<EmploymentStatus, PillTone> = {
  ACTIVE: "success",
  ON_LEAVE: "warning",
  INACTIVE: "danger",
}

/** Select options in display order. */
export const employmentTypeOptions = (
  Object.keys(employmentTypeLabels) as EmploymentType[]
).map((value) => ({ value, label: employmentTypeLabels[value] }))

export const employmentStatusOptions = (
  Object.keys(employmentStatusLabels) as EmploymentStatus[]
).map((value) => ({ value, label: employmentStatusLabels[value] }))
