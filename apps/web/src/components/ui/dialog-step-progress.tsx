import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export type DialogStep = {
  label: string
}

export function DialogStepProgress({
  steps,
  currentStep,
  label,
}: {
  steps: readonly DialogStep[]
  currentStep: number
  label: string
}) {
  const activeStep = Math.min(Math.max(currentStep, 0), steps.length - 1)

  return (
    <nav
      className="shrink-0 border-b border-[#eceef1] px-5 pt-5 pb-4"
      aria-label={label}
    >
      <ol
        className="m-0 grid list-none gap-2 p-0"
        style={{
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
        }}
      >
        {steps.map((step, index) => {
          const complete = index < activeStep
          const current = index === activeStep
          return (
            <li
              key={step.label}
              aria-current={current ? "step" : undefined}
              className="relative flex min-w-0 flex-col items-center gap-1.5 text-center"
            >
              {index > 0 && (
                <span
                  className={cn(
                    "absolute top-[14px] right-1/2 h-px w-full -translate-y-1/2",
                    index <= activeStep ? "bg-[#203f8c]" : "bg-[#dce3ed]",
                  )}
                  aria-hidden="true"
                />
              )}
              <span
                aria-hidden="true"
                className={cn(
                  "relative z-10 grid size-7 place-items-center rounded-full border text-[11px] font-bold transition-colors motion-reduce:transition-none",
                  complete
                    ? "border-[#203f8c] bg-[#203f8c] text-white"
                    : current
                      ? "border-[#203f8c] bg-white text-[#203f8c] ring-2 ring-[#dce6fb]"
                      : "border-[#d4dce8] bg-white text-[#8290a5]",
                )}
              >
                {complete ? (
                  <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  "truncate text-[10px] font-semibold sm:text-[11px]",
                  complete || current ? "text-[#203f8c]" : "text-[#8290a5]",
                )}
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
