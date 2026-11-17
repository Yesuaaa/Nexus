export function matchesConversationSearch(
  query: string,
  values: readonly (string | null | undefined)[],
) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const text = values.filter(Boolean).join(" ").toLocaleLowerCase()
  return terms.every((term) => text.includes(term))
}
