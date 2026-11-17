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
