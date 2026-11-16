import { ApiError, apiRequest } from "../../auth/api/auth-api.ts"
import {
  historyQuery,
  parseHistoryPage,
  parseHistoryEvent,
  type HistoryFilters,
  type HistoryPage,
} from "../model/management-history.ts"
const base = "/api/system-logs/management-history"
export async function loadHistory(
  filters: HistoryFilters,
  cursor: string | null,
  signal: AbortSignal,
): Promise<HistoryPage> {
  const query = historyQuery(filters, cursor)
  const operation = filters.operationId.trim()
  const params = new URLSearchParams(query)
  if (operation) params.delete("operationId")
  try {
    return parseHistoryPage(
      await apiRequest<unknown>(
        `${base}${operation ? `/operations/${encodeURIComponent(operation)}` : ""}?${params}`,
        { signal },
      ),
    )
  } catch (error) {
    if (error instanceof ApiError && error.status === 503) {
      try {
        return parseHistoryPage(error.responseBody)
      } catch (cause) {
        throw new Error("Management history is temporarily unavailable.", {
          cause,
        })
      }
    }
    if (error instanceof ApiError)
      throw new Error(
        error.status === 404
          ? "System Logs is unavailable for release. Production access remains disabled."
          : error.status === 401 || error.status === 403
            ? "Your current account cannot access System Logs."
            : "Management history could not be loaded. Check the filters and try again.",
        { cause: error },
      )
    throw error
  }
}
export async function loadHistoryEvent(
  event: { source: string; sourceEventId: string },
  filters: HistoryFilters,
  signal: AbortSignal,
) {
  const params = new URLSearchParams(historyQuery(filters))
  const query = new URLSearchParams({
    from: params.get("from")!,
    to: params.get("to")!,
  })
  try {
    const raw = await apiRequest<{ event: unknown }>(
      `${base}/events/${encodeURIComponent(event.source)}/${encodeURIComponent(event.sourceEventId)}?${query}`,
      { signal },
    )
    return parseHistoryEvent(raw.event)
  } catch {
    throw new Error(
      "Event details are unavailable. The record may be outside this date range or its source may be unavailable.",
    )
  }
}
