"use client"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"

import Link from "next/link"
import { focusRing } from "@/components/layout/styles"
import { cn } from "@/lib/utils"
import { messagePreview } from "../model/conversation-groups"
import { Avatar } from "@/components/ui/avatar"
import type { ConversationSummary } from "../api/request-conversations-api"
import type { ProjectConversationSummary } from "../api/project-conversations-api"

export function ConversationListItem({
  conversation,
  isClient,
  requestId,
  railCollapsed,
  listHref = "/messages",
}: {
  conversation: ConversationSummary
  isClient: boolean
  requestId: string | null
  railCollapsed: boolean
  listHref?: string
}) {
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
    <ConversationRow
      id={conversation.id}
      href={`${listHref}${listHref.includes("?") ? "&" : "?"}request=${encodeURIComponent(conversation.id)}`}
      name={name}
      subtitle={`${department} · ${bookingsLabel}`}
      imageUrl={participant?.imageUrl}
      label={label}
      preview={preview}
      updatedAt={conversation.lastMessage?.createdAt || conversation.updatedAt}
      unreadCount={conversation.unreadCount ?? 0}
      selected={Boolean(selected)}
      railCollapsed={railCollapsed}
    />
  )
}

export function ProjectConversationListItem({
  conversation,
  accountId,
  projectId,
  view,
  railCollapsed,
  listHref = "/messages",
}: {
  conversation: ProjectConversationSummary
  accountId: string
  projectId: string | null
  view: "active" | "archived"
  railCollapsed: boolean
  listHref?: string
}) {
  const members = conversation.participants
    .filter((person) => person.id !== accountId)
    .map((person) => person.fullName || "Participant")
    .join(", ")
  const subtitle = `${conversation.archived ? "Archived project" : conversation.isGroup ? "Project group" : "Project"} · ${members || "Awaiting staff assignment"}`
  const preview = messagePreview(conversation.lastMessage)
  return (
    <ConversationRow
      id={conversation.id}
      href={`${listHref}${listHref.includes("?") ? "&" : "?"}project=${encodeURIComponent(conversation.id)}${view === "archived" ? "&view=archived" : ""}`}
      name={conversation.name}
      subtitle={subtitle}
      label={`${conversation.name}, ${subtitle}. ${preview}${conversation.unreadCount ? `. ${conversation.unreadCount} unread messages` : ""}`}
      preview={preview}
      updatedAt={conversation.lastMessage?.createdAt || conversation.updatedAt}
      unreadCount={conversation.unreadCount}
      selected={projectId === conversation.id}
      railCollapsed={railCollapsed}
    />
  )
}

function ConversationRow({
  id,
  href,
  name,
  subtitle,
  imageUrl,
  label,
  preview,
  updatedAt,
  unreadCount,
  selected,
  railCollapsed,
}: {
  id: string
  href: string
  name: string
  subtitle: string
  imageUrl?: string | null
  label: string
  preview: string
  updatedAt: string
  unreadCount: number
  selected: boolean
  railCollapsed: boolean
}) {
  const { formatDate } = useDatePreferences()
  return (
    <div className="relative mb-2" data-conversation-id={id}>
      <Link
        href={href}
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
          <Avatar name={name} imageUrl={imageUrl} />
          {Boolean(unreadCount) && railCollapsed && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-[#203f8c] text-[10px] leading-none text-white max-[767px]:hidden"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
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
              dateTime={updatedAt}
              className={cn(
                "shrink-0 text-[10px]",
                selected ? "text-white/70" : "text-[#52627a]",
              )}
            >
              {formatDate(updatedAt)}
            </time>
          </span>
          <span
            className={cn(
              "block truncate text-[11px] leading-4",
              selected ? "text-white/80" : "text-[#52627a]",
            )}
          >
            {subtitle}
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
            {Boolean(unreadCount) && (
              <span
                aria-hidden="true"
                className={cn(
                  "grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] leading-none",
                  selected
                    ? "bg-white text-[#203f8c]"
                    : "bg-[#203f8c] text-white",
                )}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </span>
        </span>
      </Link>
    </div>
  )
}
