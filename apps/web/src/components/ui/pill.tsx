import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

/** Background/text colour pairs for status pills and badges. */
export const pillTones = {
  /** Default navy tint, e.g. tags and neutral labels. */
  brand: "bg-[#dbeafe] text-[#24437e]",
  /** In review, informational states. */
  info: "bg-[#e8eef9] text-[#244993]",
  /** Active, completed, approved. */
  success: "bg-[#dcf5e5] text-[#19703a]",
  /** Pending, on leave, on hold, in progress. */
  warning: "bg-[#fff3df] text-[#805316]",
  /** Inactive, cancelled, rejected. */
  danger: "bg-[#fde4ea] text-[#b4234d]",
  /** Archived, closed, planned, not started. */
  neutral: "bg-[#eef0f3] text-[#596579]",
} as const

export type PillTone = keyof typeof pillTones

/** Tone colours for elements that aren't a Pill (e.g. rounded badges). */
export function pillToneClass(tone: PillTone): string {
  return pillTones[tone]
}

export function Pill({
  tone = "brand",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: PillTone }) {
  return (
    <span
      className={cn(
        "inline-block w-fit max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-medium",
        pillTones[tone],
        className,
      )}
      {...props}
    />
  )
}
