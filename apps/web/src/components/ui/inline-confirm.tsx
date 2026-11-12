import { useEffect, useId, useRef, type ReactNode } from "react"
import { AnimatePresence, motion } from "motion/react"
import { focusRing } from "@/components/layout/styles"
import { buttonTones } from "@/components/ui/button-variants"
import { cn } from "@/lib/utils"

const buttonClass = `inline-flex h-[30px] flex-none cursor-pointer items-center justify-center rounded-md border px-2.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`

const swapTransition = { duration: 0.18, ease: [0.22, 1, 0.36, 1] } as const

/**
 * Cross-fades a row's normal content with its inline confirmation. Both
 * fill the row; the confirmation slides in from the right.
 */
export function ConfirmSwap({
  confirming,
  confirm,
  children,
}: {
  confirming: boolean
  confirm: ReactNode
  children: ReactNode
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {confirming ? (
        <motion.div
          key="confirm"
          className="w-full min-w-0"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={swapTransition}
        >
          {confirm}
        </motion.div>
      ) : (
        <motion.div
          key="content"
          className="w-full min-w-0"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={swapTransition}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Replaces a row with a "Remove X? [Cancel] [Remove]" strip, so in-panel
 * removals confirm in place instead of opening a modal. Focuses Cancel on
 * mount; the panel's Escape handler should call `onCancel`.
 */
export function InlineConfirm({
  message,
  detail,
  confirmLabel,
  cancelLabel = "Cancel",
  pendingLabel,
  pending,
  error,
  className,
  onCancel,
  onConfirm,
}: {
  message: ReactNode
  detail?: ReactNode
  confirmLabel: string
  /** Text of the cancel button. */
  cancelLabel?: string
  pendingLabel: string
  pending: boolean
  error?: string
  className?: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const id = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  return (
    <div
      role="alertdialog"
      aria-labelledby={`${id}-message`}
      aria-describedby={detail || error ? `${id}-detail` : undefined}
      className={cn(
        "flex min-h-14 w-full min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-[#fff6f7] px-4 py-3",
        className,
      )}
    >
      <div className="min-w-0 flex-1 basis-[180px]">
        <p
          id={`${id}-message`}
          className="m-0 text-xs font-semibold break-words text-[#8f2433]"
        >
          {message}
        </p>
        {(detail || error) && (
          <p
            id={`${id}-detail`}
            className="mt-0.5 mb-0 text-[11px] break-words text-[#a0525d]"
            role={error ? "alert" : undefined}
          >
            {error || detail}
          </p>
        )}
      </div>
      <div className="flex flex-none items-center gap-1.5">
        <button
          ref={cancelRef}
          type="button"
          className={cn(
            buttonClass,
            "border-[#e8c9ce] bg-background text-foreground hover:enabled:bg-[#fdeef0]",
          )}
          disabled={pending}
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className={cn(buttonClass, "border-transparent", buttonTones.danger)}
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? pendingLabel : confirmLabel}
        </button>
      </div>
    </div>
  )
}
