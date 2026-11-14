/**
 * Turns an enum-style value into readable text: "IN_PROGRESS" → "In progress".
 * Pass `{ capitalize: false }` for an all-lowercase phrase ("in progress").
 */
export function humanizeEnum(
  value: string,
  { capitalize = true }: { capitalize?: boolean } = {},
): string {
  const text = value.toLowerCase().replaceAll("_", " ")
  return capitalize ? text.charAt(0).toUpperCase() + text.slice(1) : text
}
/** Display an actual timestamp in an explicit IANA time zone. */
export function formatDateTime(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}
