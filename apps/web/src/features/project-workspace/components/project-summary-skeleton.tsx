import {
  ClipboardList,
  FileText,
  ListChecks,
  MessageSquareText,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { MiniStats, OverviewPanel } from "@/components/ui/overview-panel"
import { MemberRowSkeleton } from "@/components/ui/panel-loading"
import { Skeleton } from "@/components/ui/skeleton"
import { StatStrip, type StatStripItem } from "@/components/ui/stat-strip"

const pendingStats: StatStripItem[] = [
  {
    label: "Task Progress",
    value: "",
    caption: "",
    icon: ListChecks,
    tone: "bg-[#e7eefb] text-[#294c96]",
  },
  {
    label: "Deliverables",
    value: "",
    caption: "",
    icon: ClipboardList,
    tone: "bg-[#e8f3ed] text-[#267449]",
  },
  {
    label: "Project Notes",
    value: "",
    caption: "",
    icon: FileText,
    tone: "bg-[#f2ecfb] text-[#7044a4]",
  },
  {
    label: "Client Requests",
    value: "",
    caption: "",
    icon: MessageSquareText,
    tone: "bg-[#fff2e2] text-[#986018]",
  },
]

export function ProjectSummarySkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading project overview...</span>
      <div aria-hidden="true">
        <PageHeader
          title={
            <span className="inline-block h-7 w-40 animate-pulse rounded bg-[#e8eef2] align-middle motion-reduce:animate-none max-[560px]:w-28" />
          }
          meta={<Skeleton className="h-4 w-12" />}
          actions={
            <Skeleton className="h-[34px] w-36 rounded-md max-[560px]:size-9 max-[560px]:rounded-full" />
          }
        />
        <div className="mt-[18px] grid min-w-0 gap-5 max-[560px]:mt-[14px]">
          <StatStrip
            items={pendingStats}
            label="Project overview summary"
            pending
            unavailable={false}
            wrapCaption
            hoverEffects={false}
          />
          <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="grid min-w-0 gap-5">
              <OverviewPanel title="Requires Attention" variant="table">
                <div className="rounded-lg border border-[#e3e9f1] bg-[#f5f7fa] px-4 py-3">
                  <Skeleton className="my-1 h-3 w-48 max-w-full" />
                </div>
              </OverviewPanel>
              <OverviewPanel title="Project details" variant="table">
                <MiniStats
                  label="Project details"
                  loading
                  items={["Client", "Service", "Started", "Department"].map(
                    (label) => ({ label, value: "" }),
                  )}
                  columns={2}
                  variant="plain"
                  wrapValues
                />
              </OverviewPanel>
            </div>
            <div className="grid min-w-0 gap-5">
              <OverviewPanel title="Project brief" variant="table">
                <div className="grid gap-3 py-1">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </OverviewPanel>
              <OverviewPanel
                title="Assigned team"
                variant="table"
                action={<Skeleton className="h-8 w-[86px] rounded-md" />}
              >
                <Skeleton className="mt-1 mb-5 h-3 w-28" />
                <div className="divide-y divide-[#edf0f4]">
                  {[0, 1].map((row) => (
                    <MemberRowSkeleton
                      key={row}
                      className="py-3 first:pt-0 last:pb-0"
                    />
                  ))}
                </div>
              </OverviewPanel>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
