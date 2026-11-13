"use client"

/**
 * Centered modal kit: the dialog shell (overlay, card, focus return), a
 * standard header with title/description/close, a padded body and a footer.
 *
 *   <Modal onClose={onClose} busy={saving} closeOnEscape={false}>
 *     <ModalHeader title="Edit task" description="…" closeLabel="Close task editor" />
 *     <form onSubmit={…}>
 *       <ModalBody>…fields…</ModalBody>
 *       <ModalFooter>
 *         <Button variant="brandOutline" onClick={onClose}>Cancel</Button>
 *         <Button variant="brand" type="submit">Save</Button>
 *       </ModalFooter>
 *     </form>
 *   </Modal>
 *
 * Mount it while it should be open, or control it with `open`.
 */

import type { HTMLAttributes, ReactNode } from "react"
import { CloseIcon } from "@/components/layout/icons"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { panelIconButton } from "@/components/ui/panel-styles"
import { useRestoreFocus } from "@/lib/use-restore-focus"
import { cn } from "@/lib/utils"

const sizes = {
  sm: "w-[min(440px,calc(100vw-28px))]",
  md: "w-[min(520px,calc(100vw-28px))]",
  lg: "w-[min(620px,calc(100vw-28px))]",
  xl: "w-[min(900px,calc(100vw-28px))]",
} as const

export type ModalSize = keyof typeof sizes

export function Modal({
  open = true,
  onClose,
  busy = false,
  closeOnEscape = true,
  closeOnOutsideClick = false,
  size = "lg",
  elevated = false,
  fallbackFocus,
  onOpenAutoFocus,
  className,
  overlayClassName,
  children,
}: {
  open?: boolean
  /** Called for Escape, the header close button and (if enabled) outside clicks. */
  onClose: () => void
  /** Blocks every close path, e.g. while saving. */
  busy?: boolean
  /** Use false for forms so unsaved input isn't lost by accident. */
  closeOnEscape?: boolean
  closeOnOutsideClick?: boolean
  size?: ModalSize
  /** Stack above side panels and other modals (z-index 110). */
  elevated?: boolean
  /** Element to focus on close if the opener is gone. */
  fallbackFocus?: () => HTMLElement | null | undefined
  onOpenAutoFocus?: (event: Event) => void
  /** Extra classes for the card, e.g. `flex flex-col overflow-hidden`. */
  className?: string
  overlayClassName?: string
  children: ReactNode
}) {
  const restoreFocus = useRestoreFocus(fallbackFocus, open)
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName={cn(
          "bg-[rgb(13_28_57_/_48%)]",
          elevated && "z-[110]",
          overlayClassName,
        )}
        className={cn(
          "max-h-[calc(100dvh-28px)] max-w-none gap-0 overflow-y-auto rounded-[13px] border border-[#dedede] bg-background p-0 text-foreground shadow-[0_22px_75px_rgb(18_36_73_/_22%)]",
          sizes[size],
          elevated && "z-[110]",
          className,
        )}
        onOpenAutoFocus={onOpenAutoFocus}
        onCloseAutoFocus={restoreFocus.onCloseAutoFocus}
        onInteractOutside={(event) => {
          if (busy || !closeOnOutsideClick) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (busy || !closeOnEscape) event.preventDefault()
        }}
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}

export function ModalHeader({
  title,
  description,
  hideDescription = false,
  eyebrow,
  closeLabel = "Close",
  closeDisabled = false,
  className,
}: {
  title: ReactNode
  /** Required for accessibility; use `hideDescription` to keep it screen-reader only. */
  description: ReactNode
  hideDescription?: boolean
  /** Small uppercase label above the title (e.g. a reference number); not part of the dialog name. */
  eyebrow?: ReactNode
  closeLabel?: string
  closeDisabled?: boolean
  className?: string
}) {
  return (
    <header
      className={cn(
        "flex flex-none items-start justify-between gap-4 border-b border-[#eceef1] p-5 sm:px-6 sm:pt-6 sm:pb-5",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mt-0 mb-1 text-[10px] font-semibold tracking-wide text-[#738096] uppercase">
            {eyebrow}
          </p>
        )}
        <DialogTitle className="m-0 text-[20px] font-[650] tracking-[-0.03em]">
          {title}
        </DialogTitle>
        <DialogDescription
          className={
            hideDescription
              ? "sr-only"
              : "mt-1 mb-0 text-xs leading-5 text-[#738096]"
          }
        >
          {description}
        </DialogDescription>
      </div>
      <DialogClose asChild>
        <button
          type="button"
          className={panelIconButton}
          aria-label={closeLabel}
          disabled={closeDisabled}
        >
          <CloseIcon width="16" height="16" />
        </button>
      </DialogClose>
    </header>
  )
}

/** Padded content area under the header. */
export function ModalBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid gap-4 p-5 sm:p-6", className)} {...props} />
}

/** Right-aligned action row with a top divider. */
export function ModalFooter({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <footer
      className={cn(
        "flex flex-none justify-end gap-2 border-t border-[#eceef1] px-5 py-4 sm:px-6",
        className,
      )}
      {...props}
    />
  )
}
