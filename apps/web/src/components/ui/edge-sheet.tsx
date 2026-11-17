"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { AnimatePresence, MotionConfig, motion } from "motion/react"

import { cn } from "@/lib/utils"

// Exit must finish before useAnimatedPanelClose unmounts the panel (190ms).
const enter = { duration: 0.32, ease: [0.22, 1, 0.36, 1] } as const
const exit = { duration: 0.18, ease: [0.4, 0, 1, 1] } as const

type EdgeSheetContentProps = Omit<
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
  "asChild" | "forceMount"
> & {
  open: boolean
  overlayClassName?: string
}

/**
 * Full-height panel attached to the viewport's right edge that slides in
 * with Motion. Render inside a controlled `<Sheet open>`.
 */
export const EdgeSheetContent = React.forwardRef<
  HTMLDivElement,
  EdgeSheetContentProps
>(({ open, className, overlayClassName, children, ...props }, ref) => (
  <MotionConfig reducedMotion="user">
    <AnimatePresence>
      {open && (
        <SheetPrimitive.Portal forceMount>
          <SheetPrimitive.Overlay asChild forceMount>
            <motion.div
              className={cn("fixed inset-0 z-50", overlayClassName)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: enter }}
              exit={{ opacity: 0, transition: exit }}
            />
          </SheetPrimitive.Overlay>
          <SheetPrimitive.Content asChild forceMount {...props}>
            <motion.div
              ref={ref}
              className={cn(
                "fixed inset-y-0 right-0 z-50 flex h-dvh w-[min(600px,100vw)] flex-col border-l border-[#dedede] bg-background text-foreground shadow-[-12px_0_40px_rgb(18_36_73_/_12%)] outline-none max-[560px]:border-l-0",
                className,
              )}
              initial={{ x: "100%" }}
              animate={{ x: 0, transition: enter }}
              exit={{ x: "100%", transition: exit }}
            >
              {children}
            </motion.div>
          </SheetPrimitive.Content>
        </SheetPrimitive.Portal>
      )}
    </AnimatePresence>
  </MotionConfig>
))
EdgeSheetContent.displayName = "EdgeSheetContent"
