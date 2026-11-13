import { isRecordId } from "../../shared/validation.js"
import { fail } from "../../shared/http-error.js"

export function parseWorkspaceIdentity(value: string) {
  const separator = value.indexOf(":")
  const kind = separator === -1 ? null : value.slice(0, separator)
  const id = value.slice(separator + 1)
  if (
    !isRecordId(id) ||
    (kind !== null && kind !== "group" && kind !== "ungrouped-project")
  )
    fail(400, "Invalid project workspace ID")
  return { id, kind }
}
