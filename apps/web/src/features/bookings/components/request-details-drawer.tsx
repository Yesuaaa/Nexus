"use client"

import type { ReactNode } from "react"
import {
  SidePanel,
  SidePanelBody,
  SidePanelError,
  SidePanelFooter,
  SidePanelHeader,
  useSidePanel,
} from "@/components/ui/side-panel"
import { useAsyncResource } from "@/lib/use-async-resource"

type DrawerValue<T> = ReactNode | ((details: T) => ReactNode)

/** Shared request drawer lifecycle; callers supply their authorized data and body. */
export function RequestDetailsDrawer<T extends object>({
  id,
  onClose,
  loadDetails,
  renderBody,
  renderActions,
  bodyClassName,
  title = "Booking details",
  description,
  fallbackTitle = "Booking details",
  fallbackDescription = "Loading request details…",
  leading,
  meta,
  closeLabel = "Close booking details",
  loadingLabel = "Loading booking details…",
  fallbackError = "Couldn't load your booking.",
  refreshKey = 0,
  fallbackFocusId = "booked-services-heading",
  closeDisabled = false,
  onLoaded,
}: {
  id: string
  onClose: () => void
  loadDetails: (id: string, signal: AbortSignal) => Promise<T>
  renderBody: (details: T) => ReactNode
  renderActions?: (details: T) => ReactNode
  bodyClassName?: string
  title?: DrawerValue<T>
  description: DrawerValue<T>
  fallbackTitle?: ReactNode
  fallbackDescription?: ReactNode
  leading?: DrawerValue<T>
  meta?: DrawerValue<T>
  closeLabel?: string
  loadingLabel?: string
  fallbackError?: string
  refreshKey?: number
  fallbackFocusId?: string
  closeDisabled?: boolean
  onLoaded?: (details: T) => void
}) {
  const panel = useSidePanel(onClose)
  const { data, error, loading, retry } = useAsyncResource(
    async (signal) => {
      const details = await loadDetails(id, signal)
      if (!signal.aborted) onLoaded?.(details)
      return details
    },
    [id, refreshKey],
    { fallbackError },
  )
  const ready = loading || error ? undefined : data
  const resolveHeaderValue = (
    value: DrawerValue<T> | undefined,
    details: T,
  ): ReactNode =>
    typeof value === "function"
      ? (value as (details: T) => ReactNode)(details)
      : value
  const headerDetails = data && !error ? data : undefined

  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      busy={closeDisabled}
      fallbackFocus={() =>
        document.getElementById(`booking-view-${id}`) ??
        document.getElementById(fallbackFocusId)
      }
    >
      <SidePanelHeader
        title={
          headerDetails
            ? resolveHeaderValue(title, headerDetails)
            : typeof title === "function"
              ? fallbackTitle
              : title
        }
        description={
          headerDetails
            ? resolveHeaderValue(description, headerDetails)
            : typeof description === "function"
              ? fallbackDescription
              : description
        }
        leading={
          headerDetails && leading
            ? resolveHeaderValue(leading, headerDetails)
            : undefined
        }
        meta={
          headerDetails && meta
            ? resolveHeaderValue(meta, headerDetails)
            : undefined
        }
        closeLabel={closeLabel}
        closeDisabled={closeDisabled}
      />
      <SidePanelBody className={ready ? bodyClassName : undefined}>
        {loading ? (
          <p role="status" className="py-8 text-center text-xs text-[#52627a]">
            {loadingLabel}
          </p>
        ) : error ? (
          <SidePanelError message={error} onRetry={retry} />
        ) : (
          data && renderBody(data)
        )}
      </SidePanelBody>
      {ready && renderActions && (
        <SidePanelFooter className="block">
          {renderActions(ready)}
        </SidePanelFooter>
      )}
    </SidePanel>
  )
}
