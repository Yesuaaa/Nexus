import type { ComponentPropsWithoutRef } from "react"
import { CheckIcon } from "@/components/ui/check-icon"
import { cn } from "@/lib/utils"

type CheckboxProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  className?: string
}

/** Styled native checkbox that keeps the input semantics and keyboard behavior. */
export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <span
      className={cn("relative inline-flex size-[18px] flex-none", className)}
    >
      <input
        {...props}
        type="checkbox"
        className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[5px] border border-[#b8c2d0] bg-white transition-colors",
          "peer-checked:border-[#294a9b] peer-checked:bg-[#294a9b]",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-[#294a9b] peer-focus-visible:ring-offset-2",
          "peer-disabled:border-[#cbd3de] peer-disabled:bg-[#eef1f5] peer-disabled:opacity-70",
        )}
      />
      <CheckIcon className="pointer-events-none absolute inset-0 z-[1] m-auto size-3 text-white opacity-0 transition-opacity peer-checked:opacity-100" />
    </span>
  )
}
