import { useRef, type ReactNode } from "react"
import { CloseIcon } from "@/components/layout/icons"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { useAnimatedPanelClose } from "@/components/ui/use-animated-panel-close"
import {
  panelIconButton,
  panelSecondaryButton,
  panelAssignButton,
} from "@/features/departments/styles/member-panel-styles"

export function WorkloadDetailsDrawer({
  name,
  description,
  onClose,
  onEdit,
  children,
}: {
  name: string
  description: string
  onClose: () => void
  onEdit: () => void
  children: ReactNode
}) {
  const { open, handleOpenChange, closeAfterTransition } =
    useAnimatedPanelClose(onClose)
  const openerRef = useRef(
    typeof document !== "undefined" ? document.activeElement : null,
  )
  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        showCloseButton={false}
        overlayClassName="nexus-panel-overlay bg-[rgb(13_28_57_/_40%)]"
        className="nexus-side-panel inset-y-auto top-[15px] right-[15px] flex h-[calc(100dvh-30px)] max-h-none w-[min(600px,calc(100vw-30px))] max-w-none flex-col gap-0 overflow-hidden rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_16px_60px_rgb(18_36_73_/_18%)] sm:max-w-none max-[560px]:top-0 max-[560px]:right-0 max-[560px]:h-dvh max-[560px]:w-full max-[560px]:rounded-none max-[560px]:border-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const opener = openerRef.current
          if (opener instanceof HTMLElement && opener.isConnected)
            opener.focus()
        }}
      >
        <header className="flex flex-none items-start justify-between gap-4 border-b border-[#eceef1] px-6 pt-6 pb-5 max-[560px]:px-5">
          <div className="min-w-0">
            <SheetTitle className="m-0 text-[22px] leading-[1.25] font-[650] tracking-[-0.03em]">
              Workload details
            </SheetTitle>
            <SheetDescription className="sr-only">
              {description}
            </SheetDescription>
            <div className="mt-2 text-xs font-medium">{name}</div>
          </div>
          <SheetClose asChild>
            <Button
              variant="outline"
              type="button"
              className={panelIconButton}
              aria-label="Close workload details"
            >
              <CloseIcon width="16" height="16" />
            </Button>
          </SheetClose>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 max-[560px]:px-5">
          <p className="mb-4 text-xs text-[#738096]">{description}</p>
          {children}
        </div>
        <footer className="flex flex-none justify-between gap-3 border-t border-[#eceef1] px-6 py-4 max-[560px]:px-5">
          <Button
            type="button"
            variant="outline"
            className={panelSecondaryButton}
            onClick={() => closeAfterTransition(onEdit)}
          >
            Edit capacity
          </Button>
          <SheetClose asChild>
            <Button
              type="button"
              className={panelAssignButton}
              aria-label="Done viewing workload details"
            >
              Done
            </Button>
          </SheetClose>
        </footer>
      </SheetContent>
    </Sheet>
  )
}
