export type TableSearchSnapshot<T> = {
  scope: string
  query: string
  page: number
  items: T[]
}

/** A partial page is only a preview; the server still determines totals. */
export function previewTableSearch<T>(
  snapshots: TableSearchSnapshot<T>[],
  scope: string,
  search: string,
  matches: (item: T, query: string) => boolean,
): T[] | undefined {
  const query = search.trim().toLowerCase()
  const source = snapshots
    .filter(
      (snapshot) =>
        snapshot.scope === scope &&
        snapshot.page === 1 &&
        query.includes(snapshot.query.trim().toLowerCase()),
    )
    .sort((left, right) => right.query.length - left.query.length)[0]
  return source?.items.filter((item) => matches(item, query))
}
