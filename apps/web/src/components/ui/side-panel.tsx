"use client"

/**
 * Side-panel ("window") kit: a full-height panel attached to the right edge
 * that slides in, plus the standard header, scrolling body, pinned footer,
 * buttons, form groups, detail lists, and error state used inside it.
 *
 * Typical use:
 *
 *   const panel = useSidePanel(onClose)
 *   <SidePanel open={panel.open} onOpenChange={panel.onOpenChange}>
 *     <SidePanelHeader title="Edit Thing" description="…" closeLabel="Close" />
 *     <SidePanelBody>…</SidePanelBody>
 *     <SidePanelFooter>
 *       <SidePanelButton variant="secondary" onClick={() => panel.close()}>Cancel</SidePanelButton>
 *       <SidePanelButton type="submit">Save</SidePanelButton>
 *     </SidePanelFooter>
 *   </SidePanel>
 *
 * Mount the panel component only while it should be open; `panel.close()`
 * plays the exit animation, then calls `onClose` (and an optional callback).
 */

import {
  useId,
  useRef,
  type ComponentProps,
  type HTMLAttributes,
  type ReactNode,
} from "react"
import { CloseIcon } from "@/components/layout/icons"
import { focusRing } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { EdgeSheetContent } from "@/components/ui/edge-sheet"
import {
  panelAssignButton,
  panelDangerSolidButton,
  panelIconButton,
  panelSecondaryButton,
} from "@/components/ui/panel-styles"
import {
  Sheet,
  SheetClose,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { useAnimatedPanelClose } from "@/components/ui/use-animated-panel-close"
import { cn } from "@/lib/utils"

/** Open state for a side panel with an animated close. */
export function useSidePanel(onClose: () => void) {
  const { open, handleOpenChange, closeAfterTransition } =
    useAnimatedPanelClose(onClose)
  return {
    open,
    /** Pass to `<SidePanel onOpenChange>`. */
    onOpenChange: handleOpenChange,
    /** Animate out, then call `onClose` and the optional `afterClose`. */
    close: closeAfterTransition,
  }
}

export function SidePanel({
  open,
  onOpenChange,
  dismissible = true,
  busy = false,
  onEscapeKeyDown,
  fallbackFocus,
  className,
  overlayClassName,
  children,
}: {
  open: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * Whether a click outside or Escape closes the panel. Use `false` for
   * forms so unsaved input isn't lost by accident.
   */
  dismissible?: boolean
  /** Blocks every close path (e.g. while saving). */
  busy?: boolean
  /** Runs before the default Escape handling; call preventDefault to keep the panel open. */
  onEscapeKeyDown?: (event: KeyboardEvent) => void
  /** Element to focus on close if the opener is gone. */
  fallbackFocus?: () => HTMLElement | null
  className?: string
  overlayClassName?: string
  children: ReactNode
}) {
  const openerRef = useRef(
    typeof document === "undefined" ? null : document.activeElement,
  )

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return
        onOpenChange?.(next)
      }}
    >
      <EdgeSheetContent
        open={open}
        overlayClassName={cn("bg-[rgb(13_28_57_/_18%)]", overlayClassName)}
        className={cn("overflow-hidden", className)}
        onEscapeKeyDown={(event) => {
          if (busy || !dismissible) {
            event.preventDefault()
            return
          }
          onEscapeKeyDown?.(event)
        }}
        onInteractOutside={(event) => {
          if (busy || !dismissible) event.preventDefault()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const opener = openerRef.current
          if (opener instanceof HTMLElement && opener.isConnected)
            opener.focus()
          else fallbackFocus?.()?.focus()
        }}
      >
        {children}
      </EdgeSheetContent>
    </Sheet>
  )
}

export function SidePanelHeader({
  title,
  description,
  hideDescription = false,
  eyebrow,
  leading,
  meta,
  titleClassName,
  closeLabel = "Close panel",
  closeDisabled = false,
  className,
  ...props
}: Omit<HTMLAttributes<HTMLElement>, "title"> & {
  title: ReactNode
  /** Required for accessibility; use `hideDescription` to keep it screen-reader only. */
  description: ReactNode
  hideDescription?: boolean
  /** Small line above the title, e.g. "You're viewing". */
  eyebrow?: ReactNode
  /** Element before the title block, e.g. an avatar. */
  leading?: ReactNode
  /** Elements after the title, e.g. a code pill. */
  meta?: ReactNode
  titleClassName?: string
  closeLabel?: string
  closeDisabled?: boolean
}) {
  return (
    <header
      className={cn(
        "flex flex-none items-start justify-between gap-4 border-b border-[#eceef1] px-6 pt-6 pb-5 max-[560px]:px-5",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        <div className="min-w-0">
          {eyebrow && (
            <p className="m-0 text-xs font-medium text-[#738096]">{eyebrow}</p>
          )}
          <div
            className={cn(
              "flex min-w-0 flex-wrap items-center gap-2",
              eyebrow && "mt-1",
            )}
          >
            <SheetTitle
              className={cn(
                "m-0 truncate text-[20px] leading-tight font-[650] tracking-[-0.03em]",
                titleClassName,
              )}
            >
              {title}
            </SheetTitle>
            {meta}
          </div>
          <SheetDescription
            className={
              hideDescription
                ? "sr-only"
                : "mt-1 mb-0 truncate text-xs text-[#738096]"
            }
          >
            {description}
          </SheetDescription>
        </div>
      </div>
      <SheetClose asChild>
        <button
          type="button"
          className={cn(panelIconButton, "border-0 bg-transparent")}
          aria-label={closeLabel}
          disabled={closeDisabled}
        >
          <CloseIcon width="16" height="16" />
        </button>
      </SheetClose>
    </header>
  )
}

/** Scrolling content area between the header and footer. */
export function SidePanelBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "grid min-h-0 flex-1 content-start gap-5 overflow-y-auto overscroll-contain px-6 py-5 max-[560px]:px-5",
        className,
      )}
      {...props}
    />
  )
}

/** Footer pinned to the bottom of the panel. Right-aligned by default. */
export function SidePanelFooter({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <footer
      className={cn(
        "flex flex-none items-center justify-end gap-2 border-t border-[#eceef1] px-6 py-4 max-[560px]:px-5",
        className,
      )}
      {...props}
    />
  )
}

const buttonStyles = {
  primary: panelAssignButton,
  secondary: panelSecondaryButton,
  danger: panelDangerSolidButton,
} as const

/** Standard panel button: primary (navy), secondary (outline), or danger (red). */
export function SidePanelButton({
  variant = "primary",
  className,
  type = "button",
  ...props
}: Omit<ComponentProps<typeof Button>, "variant"> & {
  variant?: keyof typeof buttonStyles
}) {
  return (
    <Button
      type={type}
      variant={variant === "secondary" ? "outline" : "default"}
      className={cn(buttonStyles[variant], className)}
      {...props}
    />
  )
}

/**
 * Titled group of form fields in a two-column grid. Uses fieldset/legend
 * rather than headings, so the panel keeps a single heading.
 */
export function SidePanelFieldset({
  title,
  description,
  className,
  children,
}: {
  title: string
  description?: string
  className?: string
  children: ReactNode
}) {
  return (
    <fieldset
      className={cn(
        "m-0 grid min-w-0 gap-x-4 gap-y-1 border-0 border-t border-[#eceef1] p-0 pt-5 first-of-type:border-t-0 first-of-type:pt-0 sm:grid-cols-2",
        className,
      )}
    >
      <legend className="float-left mb-3 w-full p-0 sm:col-span-2">
        <span className="block text-[13px] font-[650] tracking-[-0.01em] text-foreground">
          {title}
        </span>
        {description && (
          <span className="mt-0.5 block text-[11px] font-normal text-[#738096]">
            {description}
          </span>
        )}
      </legend>
      {children}
    </fieldset>
  )
}

/** Titled read-only section, e.g. "Employment information". */
export function SidePanelSection({
  title,
  action,
  className,
  children,
}: {
  title: string
  /** Optional control aligned with the title. */
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className={cn("grid gap-3", className)}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h3 id={id} className="m-0 text-[13px] font-[650] tracking-[-0.01em]">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Bordered label/value list. Pair with DetailItem. */
export function DetailList({
  className,
  ...props
}: HTMLAttributes<HTMLDListElement>) {
  return (
    <dl
      className={cn(
        "m-0 grid divide-y divide-[#eceef1] rounded-lg border border-[#e8ebef] px-3.5",
        className,
      )}
      {...props}
    />
  )
}

export function DetailItem({
  label,
  children,
}: {
  label: string
  children?: ReactNode
}) {
  const empty = children === null || children === undefined || children === ""
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-4 py-2.5">
      <dt className="flex-none text-[11px] font-medium text-[#738096]">
        {label}
      </dt>
      <dd className="m-0 min-w-0 text-right text-xs font-medium break-words text-foreground">
        {empty ? (
          <span className="font-normal text-[#94a3b8]">Not provided</span>
        ) : (
          children
        )}
      </dd>
    </div>
  )
}

/** Load-error state with a retry action. */
export function SidePanelError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div
      role="alert"
      className="grid min-h-40 place-content-center gap-3 text-center text-xs text-[#7183a2]"
    >
      <p className="m-0">{message}</p>
      <button
        type="button"
        className={cn(
          "cursor-pointer justify-self-center rounded border-0 bg-transparent p-1 font-semibold text-[#244993] underline-offset-4 hover:underline",
          focusRing,
        )}
        onClick={onRetry}
      >
        Try again
      </button>
    </div>
  )
}

/** Inline error banner (e.g. a failed save) shown at the top of a body. */
export function SidePanelAlert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="m-0 rounded-lg border border-[#f4d6db] bg-[#fff6f7] p-3 text-xs text-[#bc3649]"
    >
      {children}
    </p>
  )
}
