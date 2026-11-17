import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { panelIconButton } from "@/components/ui/panel-styles"
import { cn } from "@/lib/utils"

const variants = {
  hidden: { x: "100%" },
  shown: {
    x: 0,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    x: "100%",
    transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
  },
} as const

/**
 * A screen that slides over the side panel's content (inside the same
 * panel) instead of opening a separate modal. Mark the content underneath
 * `inert` while it is open.
 */
export function PanelSubview({
  open,
  id,
  title,
  description,
  backLabel,
  disabled,
  initialFocusId,
  onBack,
  children,
}: {
  open: boolean
  id: string
  title: ReactNode
  description?: ReactNode
  backLabel: string
  disabled?: boolean
  initialFocusId?: string
  onBack: () => void
  children: ReactNode
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.section
          key={id}
          role="region"
          aria-labelledby={`${id}-title`}
          className="absolute inset-0 z-10 flex flex-col bg-background"
          variants={variants}
          initial="hidden"
          animate="shown"
          exit="exit"
          onAnimationComplete={(definition) => {
            if (definition === "shown" && initialFocusId)
              document.getElementById(initialFocusId)?.focus()
          }}
        >
          <header className="flex flex-none items-center gap-3 border-b border-[#eceef1] px-6 pt-6 pb-5 max-[560px]:px-5">
            <button
              type="button"
              className={cn(panelIconButton, "border-0")}
              aria-label={backLabel}
              disabled={disabled}
              onClick={onBack}
            >
              <ArrowLeft size={16} aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <h2
                id={`${id}-title`}
                className="m-0 text-lg font-[650] tracking-[-0.03em]"
              >
                {title}
              </h2>
              {description && (
                <p className="mt-1 mb-0 text-xs text-[#738096]">
                  {description}
                </p>
              )}
            </div>
          </header>
          {children}
        </motion.section>
      )}
    </AnimatePresence>
  )
}
