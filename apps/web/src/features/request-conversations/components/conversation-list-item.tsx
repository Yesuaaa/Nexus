"use client"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"

import Link from "next/link"
import { focusRing } from "@/components/layout/styles"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { cn } from "@/lib/utils"
import { messagePreview } from "../model/conversation-groups"
import { ConversationAvatar } from "./conversation-avatar"
import type { ConversationSummary } from "../api/request-conversations-api"

export function ConversationListItem({
  conversation,
  isClient,
  requestId,
  railCollapsed,
}: {
  conversation: ConversationSummary
  isClient: boolean
  requestId: string | null
  railCollapsed: boolean
}) {
  const { formatDate } = useDatePreferences()

  const selected =
    requestId === conversation.id ||
    conversation.bookings?.some((booking) => booking.id === requestId)
  const participant = isClient
    ? conversation.acceptedDepartment?.head
    : conversation.client
  const name =
    participant?.fullName?.trim() || (isClient ? "Department head" : "Client")
  const department = conversation.acceptedDepartment?.name || "Department"
  const count = conversation.bookings?.length ?? 1
  const bookingsLabel = `${count} ${count === 1 ? "booking" : "bookings"}`
  const preview = messagePreview(conversation.lastMessage)
  const label = `${name}, ${department}: ${bookingsLabel}. ${preview}${conversation.unreadCount ? `. ${conversation.unreadCount} unread messages` : ""}`
  return (
    <div className="relative mb-2" data-conversation-id={conversation.id}>
      <Link
        href={`/messages?request=${encodeURIComponent(conversation.id)}`}
        scroll={false}
        aria-current={selected ? "page" : undefined}
        aria-label={label}
        className={cn(
          "flex items-center gap-3 overflow-hidden rounded-2xl px-3 py-3 no-underline transition-colors",
          focusRing,
          selected
            ? "bg-[#203f8c] text-white hover:bg-[#172f70] hover:text-white"
            : "text-[#182235] hover:bg-[#e9eef5] hover:text-[#203a78]",
          railCollapsed &&
            "mx-auto size-14 justify-center gap-0 px-2.5 max-[767px]:h-auto max-[767px]:w-full max-[767px]:justify-start max-[767px]:gap-3 max-[767px]:px-3",
        )}
      >
        <span className="relative shrink-0">
          <ConversationAvatar name={name} imageUrl={participant?.imageUrl} />
          {Boolean(conversation.unreadCount) && railCollapsed && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 rounded-full bg-white px-1 text-[10px] text-[#203f8c] max-[767px]:hidden"
            >
              {conversation.unreadCount! > 99
                ? "99+"
                : conversation.unreadCount}
            </span>
          )}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1",
            railCollapsed && "hidden max-[767px]:block",
          )}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-xs leading-5 font-semibold">
              {name}
            </span>
            <time
              dateTime={
                conversation.lastMessage?.createdAt || conversation.updatedAt
              }
              className={cn(
                "shrink-0 text-[10px]",
                selected ? "text-white/70" : "text-[#52627a]",
              )}
            >
              {formatDate(
                conversation.lastMessage?.createdAt || conversation.updatedAt,
              )}
            </time>
          </span>
          <span
            className={cn(
              "block truncate text-[11px] leading-4",
              selected ? "text-white/80" : "text-[#52627a]",
            )}
          >
            {department} · {bookingsLabel}
          </span>
          <span className="mt-1 flex items-center gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-xs leading-4",
                selected ? "text-white/70" : "text-[#8791a2]",
              )}
            >
              {preview}
            </span>
            {Boolean(conversation.unreadCount) && (
              <span
                aria-hidden="true"
                className={cn(
                  "rounded-full px-1 text-[10px]",
                  selected
                    ? "bg-white text-[#203f8c]"
                    : "bg-[#203f8c] text-white",
                )}
              >
                {conversation.unreadCount! > 99
                  ? "99+"
                  : conversation.unreadCount}
              </span>
            )}
          </span>
        </span>
        {railCollapsed && (
          <HoverTooltip side="right">
            {name} · {department} · {bookingsLabel}
          </HoverTooltip>
        )}
      </Link>
    </div>
  )
}
