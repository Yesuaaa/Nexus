import type { ReactNode } from "react"
import { CloseIcon } from "@/components/layout/icons"
import { Button } from "@/components/ui/button"
import {
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { panelIconButton } from "@/features/departments/styles/member-panel-styles"

export function WorkloadDialog({
  title,
  description,
  onClose,
  busy = false,
  children,
}: {
  title: string
  description: string
  onClose: () => void
  busy?: boolean
  children: ReactNode
}) {
  return (
    <DialogContent
      showCloseButton={false}
      overlayClassName="bg-[rgb(13_28_57_/_48%)]"
      className="max-h-[calc(100dvh-28px)] w-[min(620px,calc(100vw-28px))] max-w-none gap-0 overflow-y-auto rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_22px_75px_rgb(18_36_73_/_22%)]"
      onInteractOutside={(event) => event.preventDefault()}
      onEscapeKeyDown={(event) => {
        if (busy) event.preventDefault()
      }}
    >
      <header className="flex items-start justify-between gap-4 border-b border-[#eceef1] p-5 sm:px-6 sm:pt-6 sm:pb-5">
        <div className="min-w-0">
          <DialogTitle className="m-0 text-[20px] font-[650] tracking-[-0.03em]">
            {title}
          </DialogTitle>
          <DialogDescription className="mt-1 mb-0 text-xs leading-5 text-[#738096]">
            {description}
          </DialogDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          className={panelIconButton}
          aria-label="Close form"
          disabled={busy}
          onClick={onClose}
        >
          <CloseIcon width="16" height="16" />
        </Button>
      </header>
      {children}
    </DialogContent>
  )
}
