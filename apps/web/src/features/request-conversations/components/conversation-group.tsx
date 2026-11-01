"use client"

import Link from "next/link"
import { useId, useState } from "react"
import { ChevronDown, Trash2 } from "lucide-react"
import { focusRing } from "@/components/layout/styles"
import { cn } from "@/lib/utils"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import {
  messagePreview,
  type ConversationGroup,
} from "../model/conversation-groups"
import { ConversationAvatar } from "./conversation-avatar"
import type {
  ConversationSummary,
  ConversationView,
} from "../api/request-conversations-api"

export function ConversationGroupItem({
  group,
  requestId,
  railCollapsed,
  defaultExpanded,
  onExpandRail,
  view,
  onDelete,
}: {
  group: ConversationGroup
  requestId: string | null
  railCollapsed: boolean
  defaultExpanded: boolean
  onExpandRail: () => void
  view: ConversationView
  onDelete: (conversation: ConversationSummary) => void
}) {
  const threadsId = useId()
  const [expansion, setExpansion] = useState<{
    requestId: string | null
    open: boolean
  } | null>(null)
  const isSelected = group.conversations.some((row) => row.id === requestId)
  const expanded =
    expansion && expansion.requestId === requestId
      ? expansion.open
      : isSelected || defaultExpanded
  const serviceCount = group.conversations.length
  const servicesLabel = `${serviceCount} ${serviceCount === 1 ? "service" : "services"}`
  const unreadLabel = group.unreadCount
    ? `, ${group.unreadCount} unread messages`
    : ""

  return (
    <div className="mb-2" data-conversation-group={group.id}>
      <button
        type="button"
        aria-label={`${group.name}: ${servicesLabel}${unreadLabel}`}
        aria-expanded={expanded}
        aria-controls={threadsId}
        onClick={() => {
          setExpansion({ requestId, open: railCollapsed || !expanded })
          if (railCollapsed) onExpandRail()
        }}
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border-0 px-3 py-3 text-left transition-colors hover:bg-[#e9eef5]",
          focusRing,
          isSelected ? "bg-[#edf1f8] text-[#203a78]" : "bg-transparent",
          railCollapsed &&
            "mx-auto size-14 justify-center gap-0 px-2.5 max-[767px]:mx-0 max-[767px]:h-auto max-[767px]:w-full max-[767px]:justify-start max-[767px]:gap-3 max-[767px]:px-3",
        )}
      >
        <span className="relative grid size-9 shrink-0 place-items-center">
          <ConversationAvatar
            name={group.name}
            className={isSelected ? "ring-1 ring-[#294a9b]/30" : undefined}
          />
          {Boolean(group.unreadCount) && railCollapsed && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-[#203f8c] px-1 text-[11px] leading-4 text-white max-[767px]:hidden"
            >
              {group.unreadCount > 99 ? "99+" : group.unreadCount}
            </span>
          )}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1",
            railCollapsed && "hidden max-[767px]:block",
          )}
        >
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-xs leading-5 font-semibold text-[#182235]">
              {group.name}
            </span>
            {Boolean(group.unreadCount) && (
              <span
                aria-hidden="true"
                className="grid min-w-4 shrink-0 place-items-center rounded-full bg-[#203f8c] px-1 text-[11px] leading-4 text-white"
              >
                {group.unreadCount > 99 ? "99+" : group.unreadCount}
              </span>
            )}
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={cn(
                "shrink-0 text-[#8791a2] transition-transform motion-reduce:transition-none",
                expanded && "rotate-180",
              )}
            />
          </span>
          {railCollapsed && (
            <HoverTooltip side="right">
              {group.name}: {servicesLabel}
            </HoverTooltip>
          )}
          <span className="block truncate text-[11px] leading-4 text-[#52627a]">
            {servicesLabel}
            {group.departmentName && ` · ${group.departmentName}`}
          </span>
        </span>
      </button>
      <div
        id={threadsId}
        role="group"
        aria-label={`Service threads with ${group.name}`}
        hidden={!expanded}
        className={cn(
          "mt-1 ml-7 space-y-1 border-l border-[#dce3ef] pl-2",
          railCollapsed && "min-[768px]:hidden",
        )}
      >
        {group.conversations.map((row) => {
          const selected = requestId === row.id
          const title = row.title || row.service.name
          const reference = row.referenceNumber || row.id
          return (
            <div key={row.id} className="relative">
              <Link
                href={`/messages?request=${encodeURIComponent(row.id)}${view === "archived" ? "&view=archived" : ""}`}
                scroll={false}
                aria-current={selected ? "page" : undefined}
                aria-label={`${title}, ${reference}: ${messagePreview(row.lastMessage)}${row.unreadCount ? `. ${row.unreadCount} unread messages` : ""}`}
                className={cn(
                  "block rounded-xl px-3 py-2.5 no-underline transition-colors",
                  view === "archived" && "pr-11",
                  focusRing,
                  selected
                    ? "bg-[#203f8c] text-white hover:bg-[#172f70] hover:text-white"
                    : "text-[#182235] hover:bg-[#e9eef5] hover:text-[#203a78]",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs leading-5 font-semibold">
                    {title}
                  </span>
                  {Boolean(row.unreadCount) && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid min-w-4 shrink-0 place-items-center rounded-full px-1 text-[11px] leading-4",
                        selected
                          ? "bg-white text-[#203f8c]"
                          : "bg-[#203f8c] text-white",
                      )}
                    >
                      {row.unreadCount! > 99 ? "99+" : row.unreadCount}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "flex items-center justify-between gap-2 text-[10px] leading-4",
                    selected ? "text-white/70" : "text-[#52627a]",
                  )}
                >
                  <span className="truncate">
                    {reference}
                    <HoverTooltip>{reference}</HoverTooltip>
                  </span>
                  <time
                    dateTime={row.lastMessage?.createdAt || row.updatedAt}
                    className="shrink-0"
                  >
                    {new Date(
                      row.lastMessage?.createdAt || row.updatedAt,
                    ).toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </span>
                <span
                  className={cn(
                    "block truncate text-xs leading-4",
                    selected ? "text-white/70" : "text-[#8791a2]",
                  )}
                >
                  {messagePreview(row.lastMessage)}
                </span>
                {view === "archived" && (
                  <span
                    className={cn(
                      "block text-[10px] leading-4",
                      selected ? "text-white/70" : "text-[#52627a]",
                    )}
                  >
                    {row.status === "CANCELLED" ? "Cancelled" : "Closed"}
                  </span>
                )}
              </Link>
              {view === "archived" && (
                <button
                  type="button"
                  aria-label={`Delete ${title}, ${reference} for me`}
                  onClick={() => onDelete(row)}
                  className={cn(
                    "group absolute top-1 right-0 grid size-11 cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 hover:text-red-700",
                    focusRing,
                    selected ? "text-white/80" : "text-[#8791a2]",
                  )}
                >
                  <span className="grid size-7 place-items-center rounded-md transition-colors group-hover:bg-red-50 group-focus-visible:bg-red-50">
                    <Trash2 size={15} aria-hidden="true" />
                  </span>
                  <HoverTooltip>Delete for me</HoverTooltip>
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
