import { useRef } from "react"
import { CalendarDays, Building2, Clock3, Package } from "lucide-react"
import { CloseIcon } from "@/components/layout/icons"
import { focusRing } from "@/components/layout/styles"
import { useAnimatedPanelClose } from "@/components/ui/use-animated-panel-close"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Pill } from "@/components/ui/pill"
import { cn } from "@/lib/utils"
import type { Service } from "../api/services-api"

function formatDate(value: string, includeTime = false) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(new Date(value))
}

export function ServiceDetailsDialog({
  service,
  onClose,
}: {
  service: Service
  onClose: () => void
}) {
  const { open, handleOpenChange, closeAfterTransition } =
    useAnimatedPanelClose(onClose)
  const openerRef = useRef(
    typeof document === "undefined" ? null : document.activeElement,
  )
  const rows = [
    {
      label: "Departments",
      value: (
        <span className="flex flex-wrap gap-1.5">
          {service.departments.map((department) => (
            <Pill key={department.id}>{department.name}</Pill>
          ))}
        </span>
      ),
      icon: Building2,
    },
    {
      label: "Status",
      value: (
        <Pill
          className={
            service.isActive
              ? "bg-[#dcf5e5] text-[#19703a]"
              : "bg-[#fde4ea] text-[#b4234d]"
          }
        >
          {service.isActive ? "Active" : "Inactive"}
        </Pill>
      ),
      icon: Package,
    },
    {
      label: "Date Created",
      value: formatDate(service.createdAt, true),
      icon: CalendarDays,
    },
    {
      label: "Last Updated",
      value: formatDate(service.updatedAt, true),
      icon: Clock3,
    },
  ]

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="nexus-panel-overlay z-[110] bg-[rgb(13_28_57_/_48%)]"
        className="nexus-detail-dialog z-[110] max-h-[calc(100dvh-28px)] w-[min(520px,calc(100vw-28px))] gap-0 overflow-y-auto rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_22px_75px_rgb(18_36_73_/_22%)]"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const opener = openerRef.current
          if (opener instanceof HTMLElement && opener.isConnected)
            opener.focus()
        }}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div>
            <DialogTitle className="m-0 text-lg font-[650] tracking-[-0.03em]">
              Service Details
            </DialogTitle>
            <DialogDescription className="sr-only">
              Details for {service.name}
            </DialogDescription>
          </div>
          <button
            type="button"
            className={cn(
              "grid size-7 flex-none cursor-pointer place-items-center rounded-[7px] border-0 bg-background text-[#65718a] hover:bg-[#f1f5fc]",
              focusRing,
            )}
            onClick={() => closeAfterTransition()}
            aria-label="Close details"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="p-5">
          <div className="flex items-start gap-3.5">
            <div className="grid size-12 flex-none place-items-center rounded-xl bg-[#e5edff] text-[#2058d4]">
              <Package size={22} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="m-0 text-base font-[650] break-words">
                {service.name}
              </h2>
              <p className="mt-1 mb-0 text-xs leading-relaxed break-words text-[#526686]">
                {service.description}
              </p>
            </div>
          </div>
          <dl className="mt-5 grid gap-3 border-t border-[#eceef1] pt-5">
            {rows.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="grid grid-cols-[18px_112px_minmax(0,1fr)] items-center gap-2 text-xs max-[430px]:grid-cols-[18px_minmax(0,1fr)]"
              >
                <Icon size={15} className="text-[#65718a]" aria-hidden="true" />
                <dt className="text-[#65718a]">{label}</dt>
                <dd className="m-0 min-w-0 font-medium max-[430px]:col-start-2">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <footer className="flex justify-end border-t border-[#eceef1] px-5 py-4">
          <button
            type="button"
            className={cn(
              "min-h-[38px] cursor-pointer rounded-[9px] border border-[#d7e0ee] bg-background px-[15px] text-xs font-semibold text-[#24437e] hover:bg-[#f1f5fc]",
              focusRing,
            )}
            onClick={() => closeAfterTransition()}
          >
            Close
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
