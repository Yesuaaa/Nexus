"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

export function ConversationAvatar({
  name,
  className,
  imageUrl,
}: {
  name: string
  className?: string
  imageUrl?: string | null
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = Boolean(
    imageUrl?.startsWith("https://") && imageUrl !== failedUrl,
  )
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
        "relative grid aspect-square size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#e9edf6] text-[11px] font-semibold text-[#294a9b]",
        className,
      )}
    >
      {showImage ? (
        <img
          src={imageUrl!}
          alt=""
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailedUrl(imageUrl!)}
        />
      ) : (
        initials || "?"
      )}
    </span>
  )
}
