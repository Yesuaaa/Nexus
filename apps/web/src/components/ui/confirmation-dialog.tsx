import type { ReactNode } from "react"
import { Form } from "@/components/ui/form"
import { focusRing } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import { buttonTones } from "@/components/ui/button-variants"
import { DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Modal } from "@/components/ui/modal"
import { cn } from "@/lib/utils"

const buttonClass = `inline-flex min-h-[38px] cursor-pointer items-center justify-center rounded-[9px] border border-transparent px-[15px] text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${focusRing}`

/**
 * Centered confirm for a single action, destructive (red) by default.
 * Mount it while it should be open, or control it with `open`.
 */
export function ConfirmationDialog({
  open = true,
  title,
  subject,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Cancel",
  pending,
  destructive = true,
  error = "",
  onClose,
  onConfirm,
}: {
  open?: boolean
  title: string
  /** Name of the thing being acted on, shown in bold under the title. */
  subject?: ReactNode
  description: ReactNode
  confirmLabel: string
  pendingLabel: string
  cancelLabel?: string
  pending: boolean
  destructive?: boolean
  error?: string
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Modal
      open={open}
      size="sm"
      elevated
      closeOnOutsideClick
      busy={pending}
      onClose={onClose}
    >
      <Form
        onSubmit={(event) => {
          event.preventDefault()
          if (!pending) onConfirm()
        }}
      >
        <div className="p-5">
          <DialogTitle className="m-0 text-lg font-[650] tracking-[-0.03em]">
            {title}
          </DialogTitle>
          {subject !== undefined && subject !== null && subject !== "" && (
            <p className="mt-3 mb-0 text-sm font-medium break-words">
              {subject}
            </p>
          )}
          <DialogDescription className="mt-2 mb-0 text-xs leading-relaxed text-[#738096]">
            {description}
          </DialogDescription>
          {error && (
            <Alert variant="text" className="mt-3">
              {error}
            </Alert>
          )}
        </div>
        <footer className="flex justify-end gap-2 border-t border-[#eceef1] px-5 py-4">
          <button
            type="button"
            className={cn(buttonClass, buttonTones.brandOutline)}
            disabled={pending}
            onClick={onClose}
            autoFocus
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            className={cn(
              buttonClass,
              destructive ? buttonTones.danger : buttonTones.brand,
            )}
            disabled={pending}
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
        </footer>
      </Form>
    </Modal>
  )
}
