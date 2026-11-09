"use client"

import { useCallback, useMemo, useState } from "react"
import {
  previewTableSearch,
  type TableSearchSnapshot,
} from "@/lib/table-search"

/** Cache accepted pages for immediate typing, backspacing and clearing previews. */
export function useTableSearch<T>({
  search,
  scope,
  page,
  matches,
}: {
  search: string
  scope: string
  page: number
  matches: (item: T, query: string) => boolean
}) {
  const [snapshots, setSnapshots] = useState<TableSearchSnapshot<T>[]>([])
  const [accepted, setAccepted] = useState<TableSearchSnapshot<T> | null>(null)
  const acceptRows = useCallback(
    (items: T[]) => {
      const snapshot = { scope, query: search, page, items }
      setAccepted(snapshot)
      setSnapshots((previous) =>
        [
          ...previous.filter(
            (entry) =>
              entry.scope === scope &&
              !(entry.query === search && entry.page === page),
          ),
          snapshot,
        ].slice(-20),
      )
    },
    [scope, search, page],
  )
  const previewing =
    accepted !== null && accepted.scope === scope && accepted.query !== search
  const preview = useMemo(
    () =>
      previewing
        ? (previewTableSearch(snapshots, scope, search, matches) ??
          accepted?.items.filter((item) =>
            matches(item, search.trim().toLowerCase()),
          ))
        : undefined,
    [previewing, snapshots, scope, search, matches, accepted],
  )
  return { acceptRows, preview, previewing }
}

/** Pagination and its announcement follow the rows after their transition. */
export function useTableFooter<T>(result: T, pending: boolean) {
  const [footer, setFooter] = useState(result)
  const onRowsSettled = useCallback(() => {
    if (!pending) setFooter(result)
  }, [result, pending])
  return { footer, onRowsSettled }
}
