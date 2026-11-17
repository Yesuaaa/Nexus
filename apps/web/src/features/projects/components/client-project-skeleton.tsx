import { Skeleton } from "@/components/ui/skeleton"

export function ClientProjectSkeleton() {
  return (
    <div role="status" aria-label="Loading project overview" aria-busy="true">
      <span className="sr-only">Loading project overview…</span>
      <div className="flex items-start justify-between gap-4 max-[560px]:flex-col">
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-2/5" />
          <Skeleton className="h-3 w-36" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="mt-5 grid gap-4">
        <div className="rounded-xl border border-[#dce3eb] bg-white p-5 md:p-6">
          <div className="grid gap-5 border-b border-[#e5e9ee] pb-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)]">
            {[0, 1, 2].map((column) => (
              <div key={column} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4 rounded-lg bg-[#eaeff1] p-4 md:p-5">
            <Skeleton className="size-10 rounded-xl" />
            <div className="min-w-[145px] space-y-2">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-6 w-16" />
            </div>
            <Skeleton className="h-2 min-w-[220px] flex-1 rounded-full" />
          </div>
        </div>
        {["Project brief", "Project requests"].map((title) => (
          <div
            key={title}
            className="rounded-xl border border-[#dce3eb] bg-white p-5 md:p-6"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#e5e9ee] pb-3">
              <h2 className="m-0 text-base font-semibold">{title}</h2>
              <Skeleton className="h-9 w-28" />
            </div>
            <div className="mt-4 space-y-3">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
        <div className="grid gap-4 md:grid-cols-2">
          {["Latest notes", "Project team"].map((title) => (
            <div
              key={title}
              className="rounded-xl border border-[#dce3eb] bg-white p-5 md:p-6"
            >
              <h2 className="m-0 border-b border-[#e5e9ee] pb-3 text-base font-semibold">
                {title}
              </h2>
              <Skeleton className="mt-4 h-16 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
