import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/** Avatar + two text lines, matching MemberIdentity rows. */
export function MemberRowSkeleton({
  trailing = 0,
  className,
}: {
  /** Number of trailing icon/button placeholders. */
  trailing?: number
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <Skeleton className="size-8 flex-none rounded-full" />
      <div className="grid min-w-0 flex-1 gap-1.5">
        <Skeleton className="h-3 w-[45%] max-w-40" />
        <Skeleton className="h-2.5 w-[60%] max-w-56" />
      </div>
      {Array.from({ length: trailing }, (_, index) => (
        <Skeleton key={index} className="size-7 flex-none rounded-md" />
      ))}
    </div>
  )
}

function LoadingStatus() {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      Loading…
    </span>
  )
}

function PanelBodySkeleton() {
  return (
    <>
      <header className="flex flex-none items-start justify-between gap-4 border-b border-[#eceef1] px-6 pt-6 pb-5">
        <div className="grid gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-48" />
        </div>
        <Skeleton className="size-8 rounded-[7px]" />
      </header>
      <div className="flex gap-5 border-b border-[#eceef1] px-6 py-3.5">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3.5 w-12" />
      </div>
      <div className="grid flex-1 content-start gap-3 overflow-hidden px-6 py-5">
        <Skeleton className="h-9 w-full rounded-lg" />
        <div className="divide-y divide-[#eceef1] rounded-lg border border-[#e8ebef]">
          {Array.from({ length: 5 }, (_, index) => (
            <MemberRowSkeleton key={index} trailing={1} className="px-4 py-3" />
          ))}
        </div>
      </div>
      <footer className="flex flex-none justify-end border-t border-[#eceef1] px-6 py-4">
        <Skeleton className="h-[34px] w-20 rounded-lg" />
      </footer>
    </>
  )
}

/**
 * Placeholder shown while a lazily loaded side panel downloads; matches the
 * full-height SidePanel attached to the right edge.
 */
export function SidePanelLoading() {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[rgb(13_28_57_/_18%)]" />
      <div className="absolute inset-y-0 right-0 flex w-[min(600px,100vw)] flex-col overflow-hidden border-l border-[#dedede] bg-background shadow-[-12px_0_40px_rgb(18_36_73_/_12%)] max-[560px]:border-l-0">
        <LoadingStatus />
        <PanelBodySkeleton />
      </div>
    </div>
  )
}

/** Placeholder shown while a lazily loaded centered dialog downloads. */
export function PanelLoading() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgb(13_28_57_/_48%)] p-[14px]">
      <div className="w-[min(560px,calc(100vw-28px))] overflow-hidden rounded-[13px] border border-[#dedede] bg-background shadow-[0_22px_75px_rgb(18_36_73_/_22%)]">
        <LoadingStatus />
        <div className="flex items-start justify-between gap-4 border-b border-[#eceef1] p-5">
          <div className="grid gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <Skeleton className="size-7 rounded-[7px]" />
        </div>
        <div className="grid gap-4 p-5">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="grid gap-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#eceef1] px-5 py-4">
          <Skeleton className="h-[38px] w-20 rounded-[9px]" />
          <Skeleton className="h-[38px] w-28 rounded-[9px]" />
        </div>
      </div>
    </div>
  )
}
