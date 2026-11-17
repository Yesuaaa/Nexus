import { cn } from "@/lib/utils"

/**
 * Required-field marker for a label: a visual asterisk plus "required" for
 * screen readers.
 */
export function RequiredMark({ className }: { className?: string }) {
  return (
    <>
      <span aria-hidden="true" className={cn("text-[#d04b56]", className)}>
        *
      </span>
      <span className="sr-only">required</span>
    </>
  )
}
