import type { ProjectRequirementsDraft } from "./project-requirements"

export type ServiceDraft = {
  serviceId: string
  packageId: string | null
  step: 1 | 2 | 3 | 4
  requirements: ProjectRequirementsDraft
  specialistId: string | null
  submissionKey: string | null
}

const draftKey = (accountId: string) => `nexus.services.draft.${accountId}`
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null
const optionalId = (value: unknown) =>
  value === null ||
  (typeof value === "string" && value.length > 0 && value.length <= 200)

export function readServiceDraft(
  storage: Pick<Storage, "getItem">,
  accountId: string,
): ServiceDraft | null {
  try {
    const value: unknown = JSON.parse(
      storage.getItem(draftKey(accountId)) ?? "null",
    )
    if (
      !record(value) ||
      typeof value.serviceId !== "string" ||
      !value.serviceId ||
      !optionalId(value.packageId) ||
      !optionalId(value.specialistId) ||
      !optionalId(value.submissionKey) ||
      typeof value.step !== "number" ||
      ![1, 2, 3, 4].includes(value.step) ||
      !record(value.requirements)
    )
      return null
    const fields = [
      "goals",
      "requirements",
      "expectedTimeline",
      "additionalDetails",
    ] as const
    for (const field of fields)
      if (
        typeof value.requirements[field] !== "string" ||
        value.requirements[field].length > 5000
      )
        return null
    return value as ServiceDraft
  } catch {
    return null
  }
}

export function writeServiceDraft(
  storage: Pick<Storage, "setItem">,
  accountId: string,
  draft: ServiceDraft,
): boolean {
  try {
    storage.setItem(draftKey(accountId), JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

export function clearServiceDraft(
  storage: Pick<Storage, "removeItem">,
  accountId: string,
) {
  try {
    storage.removeItem(draftKey(accountId))
  } catch {
    /* Storage may be unavailable in a private browsing session. */
  }
}
