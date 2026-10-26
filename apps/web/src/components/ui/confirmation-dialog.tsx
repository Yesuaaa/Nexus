import { useRef } from "react"
import { focusRing } from "@/components/layout/styles"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const buttonClass = `inline-flex min-h-[38px] cursor-pointer items-center justify-center rounded-[9px] border border-transparent px-[15px] text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${focusRing}`

export function ConfirmationDialog({
  title,
  subject,
  description,
  confirmLabel,
  pendingLabel,
  pending,
  destructive = true,
  error,
  onClose,
  onConfirm,
}: {
  title: string
  subject: string
  description: string
  confirmLabel: string
  pendingLabel: string
  pending: boolean
  destructive?: boolean
  error: string
  onClose: () => void
  onConfirm: () => void
}) {
  const openerRef = useRef(
    typeof document === "undefined" ? null : document.activeElement,
  )

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[110] bg-[rgb(13_28_57_/_48%)]"
        className="z-[110] max-h-[calc(100dvh-28px)] w-[min(440px,calc(100vw-28px))] gap-0 overflow-y-auto rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_22px_75px_rgb(18_36_73_/_22%)]"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const opener = openerRef.current
          if (opener instanceof HTMLElement && opener.isConnected)
            opener.focus()
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (!pending) onConfirm()
          }}
        >
          <div className="p-5">
            <DialogTitle className="m-0 text-lg font-[650] tracking-[-0.03em]">
              {title}
            </DialogTitle>
            <p className="mt-3 mb-0 text-sm font-medium break-words">
              {subject}
            </p>
            <DialogDescription className="mt-2 mb-0 text-xs leading-relaxed text-[#738096]">
              {description}
            </DialogDescription>
            {error && (
              <p className="mt-3 mb-0 text-xs text-[#bc3649]" role="alert">
                {error}
              </p>
            )}
          </div>
          <footer className="flex justify-end gap-2 border-t border-[#eceef1] px-5 py-4">
            <button
              type="button"
              className={cn(
                buttonClass,
                "border-[#d7e0ee] bg-background text-[#24437e] hover:enabled:bg-[#f1f5fc]",
              )}
              disabled={pending}
              onClick={onClose}
              autoFocus
            >
              Cancel
            </button>
            <button
              type="submit"
              className={cn(
                buttonClass,
                destructive
                  ? "bg-[#bc3649] text-white hover:enabled:bg-[#a42f40]"
                  : "bg-[#203f8c] text-white hover:enabled:bg-[#172f70]",
              )}
              disabled={pending}
            >
              {pending ? pendingLabel : confirmLabel}
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  )
}
