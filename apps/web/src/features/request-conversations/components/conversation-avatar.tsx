import { cn } from "@/lib/utils"

export function ConversationAvatar({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join("")
    .toUpperCase()

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full bg-[#e9edf6] text-[11px] font-semibold text-[#294a9b]",
        className,
      )}
    >
      {initials || "?"}
    </span>
  )
}
