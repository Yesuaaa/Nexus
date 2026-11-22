"use client"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"

import Link from "next/link"
import { useState } from "react"
import { Bell, CheckCheck } from "lucide-react"
import { sileo } from "@/lib/toast"
import { apiRequest } from "@/features/auth/api/auth-api"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { dropdownMenuClass } from "@/components/ui/dropdown-styles"
import { iconButtonClass } from "@/components/layout/styles"
import { useWorkflowInbox } from "./workflow-notification-provider"

export function WorkflowNotifications() {
  const { formatDateTime } = useDatePreferences()
  const { result, error, load } = useWorkflowInbox()
  const [markingRead, setMarkingRead] = useState(false)
  async function read(id: string) {
    try {
      await apiRequest(
        `/api/request-workflows/notifications/${encodeURIComponent(id)}/read`,
        { method: "PATCH" },
      )
      await load()
    } catch {
      /* The unread marker remains so a later visit can retry. */
    }
  }
  async function readAll() {
    if (markingRead || !result?.unreadCount) return
    setMarkingRead(true)
    try {
      await apiRequest("/api/request-workflows/notifications/read-all", {
        method: "PATCH",
      })
      await load()
      sileo.success({ title: "All notifications marked as read" })
    } catch {
      sileo.error({
        title: "Couldn't mark all notifications as read. Try again.",
      })
    } finally {
      setMarkingRead(false)
    }
  }
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) void load()
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications${result?.unreadCount ? `, ${result.unreadCount} unread` : ""}`}
          className={`${iconButtonClass} relative data-[state=open]:outline-none`}
        >
          <Bell size={18} strokeWidth={1.75} aria-hidden="true" />
          {Boolean(result?.unreadCount) && (
            <span className="absolute top-0.5 right-0 grid min-w-4 place-items-center rounded-full bg-[#203f8c] px-1 text-[9px] text-white">
              {result!.unreadCount > 99 ? "99+" : result!.unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className={`${dropdownMenuClass} max-h-[min(420px,75dvh)] w-[min(360px,calc(100vw-32px))] overflow-y-auto`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="m-0 text-xs font-semibold">Notifications</p>
          <DropdownMenuItem
            disabled={markingRead || !result?.unreadCount}
            onSelect={(event) => {
              event.preventDefault()
              void readAll()
            }}
            className="cursor-pointer gap-1.5 rounded-md px-2 py-2 text-[11px] font-medium text-[#203f8c] focus:bg-[#e9eef5] focus:text-[#203f8c]"
          >
            <CheckCheck aria-hidden="true" />
            {markingRead ? "Marking as read…" : "Mark all as read"}
          </DropdownMenuItem>
        </div>
        {result?.notifications.length ? (
          result.notifications.map((item) => (
            <DropdownMenuItem key={item.id} asChild>
              <Link
                href={
                  item.entityId && item.type.startsWith("ATTENDANCE_")
                    ? `/attendance/requests/${item.type.startsWith("ATTENDANCE_OVERTIME_") ? "overtime" : "corrections"}?request=${encodeURIComponent(item.entityId)}`
                    : item.entityId && item.type.startsWith("LEAVE_")
                      ? `/attendance/requests/leave?request=${encodeURIComponent(item.entityId)}`
                      : item.entityId &&
                          [
                            "PROJECT_ACTIVATED",
                            "PROJECT_CANCELLATION_REQUESTED",
                            "PROJECT_CANCELLATION_APPROVED",
                            "PROJECT_CANCELLATION_DECLINED",
                          ].includes(item.type)
                        ? `/projects/${encodeURIComponent(item.entityId)}`
                        : `/messages?request=${encodeURIComponent(item.requestId ?? "")}`
                }
                onClick={() => {
                  if (!item.readAt) void read(item.id)
                }}
                className="grid cursor-pointer gap-1 rounded-lg px-3 py-3 no-underline focus:bg-[#e9eef5]"
              >
                <span
                  className={`text-xs leading-5 whitespace-normal ${item.readAt ? "text-muted-foreground" : "font-medium text-foreground"}`}
                >
                  {item.summary}
                </span>
                <time
                  dateTime={item.createdAt}
                  className="text-[10px] text-muted-foreground"
                >
                  {formatDateTime(item.createdAt)}
                </time>
              </Link>
            </DropdownMenuItem>
          ))
        ) : (
          <p className="m-0 px-3 py-5 text-xs text-muted-foreground">
            {error
              ? "Couldn't load notifications."
              : result
                ? "You're all caught up."
                : "Loading notifications…"}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
