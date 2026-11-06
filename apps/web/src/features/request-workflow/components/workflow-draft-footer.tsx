import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { workflowButton } from "./workflow-primitives"

export const draftSecondaryButton = "h-9 min-w-[92px] text-[11px]"
export const draftPrimaryButton = `${workflowButton} min-w-[130px] bg-[#203f8c] text-white hover:bg-[#172f70]`

export function WorkflowDraftFooter({
  children,
  sticky = false,
}: {
  children: ReactNode
  sticky?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap justify-end gap-2 border-t border-[#e8ebef] pt-3",
        // Cover the frame's horizontal and bottom padding while fields scroll
        // behind the sticky actions. Keep the divider and buttons inset.
        sticky &&
          "sticky bottom-0 z-10 bg-white before:pointer-events-none before:absolute before:-inset-x-4 before:-bottom-3 before:top-0 before:-z-10 before:bg-white",
      )}
    >
      {children}
    </div>
  )
}
