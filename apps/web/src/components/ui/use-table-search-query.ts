"use client"

import { useEffect, useState } from "react"

export function useTableSearchQuery(input: string) {
  const query = input.trim()
  const [settled, setSettled] = useState(query)
  useEffect(() => {
    if (query === settled) return
    if (!query) {
      const timer = window.setTimeout(() => setSettled(""), 0)
      return () => window.clearTimeout(timer)
    }
    const timer = window.setTimeout(() => setSettled(query), 200)
    return () => window.clearTimeout(timer)
  }, [query, settled])
  return {
    query: query ? settled : "",
    pending: Boolean(query && query !== settled),
  }
}
