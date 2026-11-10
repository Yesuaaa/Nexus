"use client"

import { X, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import type {
  ProjectTask,
  ProjectWorkspaceWorkstream,
} from "../api/project-workspace-api"

export function TaskDetailsPanel({
  task,
  stream,
  onClose,
  onEdit,
}: {
  task: ProjectTask
  stream: ProjectWorkspaceWorkstream
  onClose: () => void
  onEdit: () => void
}) {
  const phase = stream.plan?.phases.find((item) =>
    item.tasks.some((item) => item.id === task.id),
  )
  const assignee = stream.staff?.find((person) => person.id === task.employeeId)
  const done = phase?.tasks.filter((item) => item.status === "DONE").length ?? 0
  const status =
    task.status === "DONE"
      ? "Complete"
      : task.status === "IN_PROGRESS"
        ? "In progress"
        : "Not started"
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        showCloseButton={false}
        overlayClassName="bg-[#14213d]/40"
        className="nexus-side-panel inset-y-auto top-[15px] right-[15px] flex h-[calc(100dvh-30px)] w-[min(600px,calc(100vw-30px))] max-w-none flex-col gap-0 overflow-hidden rounded-[13px] border border-[#dedede] bg-background p-0 shadow-[0_16px_60px_rgb(18_36_73_/_18%)] sm:max-w-none max-[560px]:top-0 max-[560px]:right-0 max-[560px]:h-dvh max-[560px]:w-full max-[560px]:rounded-none"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#eceef1] px-6 py-6">
          <div className="min-w-0">
            <SheetTitle className="m-0 text-[22px] leading-tight font-[650] tracking-tight">
              Task details
            </SheetTitle>
            <SheetDescription className="mt-2 text-xs text-[#738096]">
              {stream.serviceName} · {phase?.title || "Project plan"}
            </SheetDescription>
          </div>
          <SheetClose
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#e1e4ea] text-[#647a9c] hover:bg-[#eef1f6]"
            aria-label="Close task details"
          >
            <X size={16} />
          </SheetClose>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <h2 className="mt-0 mb-3 break-words text-base font-semibold">
            {task.title}
          </h2>
          <span
            className={`inline-flex rounded-md px-2 py-1 text-[11px] ${task.status === "DONE" ? "bg-[#e3f5e9] text-[#13743b]" : task.status === "IN_PROGRESS" ? "bg-[#fff1d4] text-[#946000]" : "bg-[#edf1f6] text-[#60718c]"}`}
          >
            {status}
          </span>
          <dl className="mt-5 mb-6 rounded-xl border border-[#e1e4ea] px-4">
            {[
              ["Project role", task.role || "Not set"],
              [
                "Assigned staff",
                assignee?.fullName ||
                  (task.employeeId
                    ? "No longer assigned to project"
                    : "Unassigned"),
              ],
              ["Staff position", assignee?.position || "Not set"],
              [
                "Due date",
                task.dueDate
                  ? new Date(`${task.dueDate}T00:00:00`).toLocaleDateString()
                  : "Not set",
              ],
              ["Booking reference", stream.referenceNumber || "Not set"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="border-b border-[#eceef1] py-3 last:border-0"
              >
                <dt className="text-[11px] font-medium text-[#738096]">
                  {label}
                </dt>
                <dd className="m-0 mt-1.5 break-words text-xs font-medium">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <section className="rounded-xl border border-[#e1e4ea] p-4">
            <h3 className="mt-0 mb-2 text-xs font-semibold">Phase context</h3>
            <p className="m-0 text-xs text-[#60718c]">
              {phase?.title || "Project plan"}
            </p>
            <p className="mt-2 mb-0 text-[11px] text-[#738096]">
              {done} of {phase?.tasks.length ?? 0} tasks complete
            </p>
          </section>
          {assignee && (
            <section className="mt-5">
              <h3 className="text-xs font-semibold">Assigned staff skills</h3>
              <p className="text-xs leading-5 text-[#60718c]">
                {assignee.profileSpecialties.join(", ") ||
                  "No skills recorded."}
              </p>
            </section>
          )}
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#eceef1] px-6 py-4">
          <Button variant="outline" className="text-xs" onClick={onEdit}>
            <Pencil size={14} />
            Edit task
          </Button>
          <Button
            className="bg-[#203f8c] text-xs text-white hover:bg-[#172f70]"
            onClick={onClose}
          >
            Done
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  )
}
