"use client"

import { useRef, type ReactNode } from "react"
import { X } from "lucide-react"
import { SearchIcon } from "@/components/layout/icons"
import { SearchField } from "@/components/ui/search-field"
import { iconButtonClass } from "@/components/layout/styles"
import { cn } from "@/lib/utils"

export function ConversationSearch({
  value,
  onChange,
  collapsed,
  onExpand,
  trailingAction,
}: {
  value: string
  onChange: (value: string) => void
  collapsed: boolean
  onExpand: () => void
  trailingAction?: ReactNode
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div
      className={cn(
        "mb-3 shrink-0 px-5",
        collapsed && "w-full px-0 max-[767px]:px-5",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-0",
          collapsed &&
            "w-full flex-col justify-center gap-1 max-[767px]:items-stretch max-[767px]:gap-2",
        )}
      >
        {collapsed && (
          <button
            type="button"
            aria-label="Search conversations"
            className={cn(
              iconButtonClass,
              "mx-auto shrink-0 self-center text-foreground hover:text-foreground max-[767px]:hidden",
            )}
            onClick={() => {
              onExpand()
              window.requestAnimationFrame(() => inputRef.current?.focus())
            }}
          >
            <SearchIcon width="18" height="18" aria-hidden="true" />
          </button>
        )}
        <div
          className={cn(
            "relative min-w-0 flex-1",
            collapsed && "hidden max-[767px]:block",
          )}
        >
          <SearchField
            ref={inputRef}
            label="Search conversations"
            placeholder="Search conversations"
            value={value}
            maxLength={200}
            onChange={(event) => onChange(event.target.value)}
            containerClassName="min-w-0 flex-1 pr-9 max-[1050px]:w-auto max-[1050px]:flex-1"
            className="[&::-webkit-search-cancel-button]:appearance-none"
          />
          {value && (
            <button
              type="button"
              aria-label="Clear conversation search"
              className={cn(
                iconButtonClass,
                "absolute top-1/2 right-1 size-7 -translate-y-1/2",
              )}
              onClick={() => {
                onChange("")
                inputRef.current?.focus()
              }}
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>
        {trailingAction}
      </div>
    </div>
  )
}
