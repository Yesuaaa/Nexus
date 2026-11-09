"use client"

import Link from "next/link"
import { useRef } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { rowActionButton } from "@/components/ui/row-action-styles"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { useAnimatedPanelClose } from "@/components/ui/use-animated-panel-close"
import { cn } from "@/lib/utils"
import type { ClientProjectSummary } from "../api/projects-api"

function statusLabel(status: string) {
  const label = status.toLowerCase().replaceAll("_", " ")
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function statusClass(status: string) {
  if (status === "IN_PROGRESS") return "bg-amber-100 text-amber-800"
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-800"
  if (status === "CANCELLED") return "bg-rose-100 text-rose-700"
  if (status === "ON_HOLD") return "bg-orange-100 text-orange-800"
  return "bg-slate-100 text-slate-700"
}

function projectProgress(project: ClientProjectSummary) {
  return project.taskCount
    ? Math.min(
        100,
        Math.round((project.completedTasks / project.taskCount) * 100),
      )
    : 0
}

export function ClientProjectDetailsDrawer({
  project,
  formatDate,
  onClose,
}: {
  project: ClientProjectSummary
  formatDate: (value: Date | string) => string
  onClose: () => void
}) {
  const { open, handleOpenChange } = useAnimatedPanelClose(onClose)
  const openerRef = useRef(
    typeof document === "undefined" ? null : document.activeElement,
  )
  const serviceName = project.request?.service.name || "Project"
  const percent = projectProgress(project)

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        overlayClassName="nexus-panel-overlay bg-[rgb(13_28_57_/_40%)]"
        className="nexus-side-panel inset-y-auto top-[15px] right-[15px] flex h-[calc(100dvh-30px)] max-h-none w-[min(600px,calc(100vw-30px))] max-w-none flex-col gap-0 overflow-hidden rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_16px_60px_rgb(18_36_73_/_18%)] sm:max-w-none max-[560px]:top-0 max-[560px]:right-0 max-[560px]:h-dvh max-[560px]:w-full max-[560px]:rounded-none max-[560px]:border-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const opener = openerRef.current
          if (
            opener instanceof HTMLElement &&
            opener.isConnected &&
            opener !== document.body
          ) {
            opener.focus()
          } else {
            document.getElementById(`project-view-${project.id}`)?.focus()
          }
        }}
      >
        <header className="flex flex-none items-start justify-between gap-4 border-b border-[#eceef1] px-6 pt-6 pb-5 max-[560px]:px-5">
          <div className="min-w-0">
            <SheetTitle className="m-0 text-[22px] leading-[1.25] font-[650] tracking-[-0.03em]">
              Project details
            </SheetTitle>
            <SheetDescription className="mt-1 text-xs text-[#52627a]">
              Review project progress and shared deliverables.
            </SheetDescription>
          </div>
          <SheetClose asChild>
            <button
              type="button"
              aria-label="Close project details"
              className={cn(rowActionButton, "max-[560px]:size-11")}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </SheetClose>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 max-[560px]:px-5">
          <h2 className="m-0 break-words text-base font-semibold">
            {project.name}
          </h2>
          <div className="mt-3">
            <Pill className={statusClass(project.status)}>
              {statusLabel(project.status)}
            </Pill>
          </div>

          <section className="mt-5 rounded-xl border border-[#e4e9f0] bg-[#f8fafd] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="m-0 text-xs font-semibold">Project progress</h3>
              <span className="text-xs font-semibold text-[#294c96]">
                {percent}%
              </span>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-[#dfe6ef]"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${project.name} progress`}
            >
              <div
                className="h-full rounded-full bg-[#294c96]"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-2 mb-0 text-[11px] text-[#52627a]">
              {project.completedTasks} of {project.taskCount} tasks complete
            </p>
          </section>

          <dl className="mt-5 grid grid-cols-2 gap-x-5 max-[450px]:grid-cols-1">
            {[
              ["Service", serviceName],
              [
                "Request reference",
                project.request?.referenceNumber || project.id,
              ],
              [
                "Deliverables",
                `${project.deliverableCount} ${project.deliverableCount === 1 ? "deliverable" : "deliverables"}`,
              ],
              [
                "Started",
                project.startDate
                  ? formatDate(project.startDate)
                  : "Not started",
              ],
              ["Last updated", formatDate(project.updatedAt)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="min-w-0 border-b border-[#eceef1] py-3"
              >
                <dt className="text-[11px] text-[#52627a]">{label}</dt>
                <dd className="mt-1.5 ml-0 text-xs font-medium [overflow-wrap:anywhere]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <section className="mt-6">
            <h3 className="m-0 text-xs font-semibold">Project brief</h3>
            <p className="mt-2 mb-0 text-xs leading-6 whitespace-pre-wrap text-[#52627a] [overflow-wrap:anywhere]">
              {project.description || "No project brief provided."}
            </p>
          </section>
        </div>
        <footer className="flex flex-none justify-end gap-2 border-t border-[#eceef1] px-6 py-4 max-[560px]:px-5">
          {project.startDate && (
            <Button asChild variant="outline" className="text-xs">
              <Link
                href={`/messages?project=${encodeURIComponent(project.id)}`}
              >
                Project chat
              </Link>
            </Button>
          )}
          <Button
            asChild
            className="bg-[#243f8f] text-xs text-white hover:bg-[#1d367d]"
          >
            <Link href={`/projects/${encodeURIComponent(project.id)}`}>
              Open project
            </Link>
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  )
}
