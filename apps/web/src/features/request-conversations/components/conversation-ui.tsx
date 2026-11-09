"use client"

import { useId, type ReactNode, type Ref } from "react"
import Link from "next/link"
import { ArrowLeft, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { focusRing } from "@/components/layout/styles"
import { cn } from "@/lib/utils"
import { ConversationAvatar } from "./conversation-avatar"

export function ConversationSurface({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="m-3 flex min-h-0 flex-1 overflow-hidden rounded-[13px] border border-[#dedede] bg-background shadow-[0_2px_8px_rgb(20_30_50_/_11%)] max-[767px]:m-2">
      <section
        aria-label={label}
        className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
      >
        {children}
      </section>
    </div>
  )
}

export function ConversationHeader({
  name,
  imageUrl,
  subtitle,
  listHref,
  backLabel = "All conversations",
  actions,
  archived = false,
}: {
  name: string
  imageUrl?: string | null
  subtitle: ReactNode
  listHref: string
  backLabel?: string
  actions?: ReactNode
  archived?: boolean
}) {
  return (
    <header className="flex min-h-[68px] shrink-0 items-center gap-3 border-b border-[#efefee] bg-background px-6 py-3 max-[767px]:gap-2 max-[767px]:px-4">
      <Link
        href={listHref}
        aria-label={backLabel}
        className={cn(
          "hidden size-8 shrink-0 items-center justify-center rounded-full text-[#52627a] hover:bg-[#f1f1ee] max-[767px]:flex",
          focusRing,
        )}
      >
        <ArrowLeft size={17} aria-hidden="true" />
      </Link>
      <ConversationAvatar name={name} imageUrl={imageUrl} className="size-8" />
      <div className="min-w-0 flex-1">
        <h2 className="m-0 truncate text-sm font-semibold text-[#182235]">
          {name}
        </h2>
        <p className="mt-0.5 mb-0 truncate text-xs text-[#8791a2]">
          {subtitle}
        </p>
        {archived && (
          <span className="mt-1 inline-flex rounded-full bg-[#edf1f6] px-2 py-0.5 text-[10px] font-medium text-[#52627a]">
            Archived · Read-only
          </span>
        )}
      </div>
      {actions}
    </header>
  )
}

export function ConversationMessage({
  own,
  name,
  imageUrl,
  grouped,
  groupedWithNext,
  showSender = false,
  hasActions = false,
  children,
}: {
  own: boolean
  name: string
  imageUrl?: string | null
  grouped: boolean
  groupedWithNext: boolean
  showSender?: boolean
  hasActions?: boolean
  children: ReactNode
}) {
  return (
    <article
      className={cn(
        "relative flex w-fit max-w-[85%] items-end gap-2 pb-1 max-[767px]:max-w-[92%]",
        hasActions && "pl-11",
        grouped ? "mt-1" : "mt-4",
        own ? "ml-auto flex-row-reverse" : "mr-auto",
      )}
    >
      {!own && (
        <ConversationAvatar
          name={name}
          imageUrl={imageUrl}
          className={cn("size-7", groupedWithNext && "invisible")}
        />
      )}
      <div className="min-w-0">
        <p
          className={
            showSender && !own
              ? "mt-0 mb-1 text-[10px] font-medium text-[#52627a]"
              : "sr-only"
          }
        >
          {own ? "You" : name}
        </p>
        {children}
      </div>
    </article>
  )
}

export function ConversationBubble({
  own,
  deleted = false,
  body,
  timestamp,
}: {
  own: boolean
  deleted?: boolean
  body: string | null
  timestamp: string
}) {
  return (
    <div className="relative w-fit max-w-full">
      <p
        className={cn(
          "m-0 rounded-2xl px-3.5 py-2.5 text-[13px] leading-5 whitespace-pre-wrap [overflow-wrap:anywhere]",
          deleted
            ? "border border-dashed border-[#d8e1ef] bg-[#f6f8fc] text-[#52627a]"
            : own
              ? "rounded-br-md bg-[#203f8c] text-white"
              : "rounded-bl-md bg-[#dfe4eb] text-[#182235]",
          deleted && "w-fit max-w-full py-1.5 italic",
          deleted && own && "ml-auto",
        )}
      >
        {deleted ? "This message was deleted" : body}
      </p>
      <HoverTooltip>{timestamp}</HoverTooltip>
    </div>
  )
}

/** Used inside each conversation's form so transport and tools stay scoped. */
export function ConversationComposer({
  id,
  inputRef,
  label = "Message",
  draft,
  onDraftChange,
  sending,
  canSend,
  tools,
  children,
  sendError,
  hint,
}: {
  id?: string
  inputRef?: Ref<HTMLTextAreaElement>
  label?: string
  draft: string
  onDraftChange: (value: string) => void
  sending: boolean
  canSend: boolean
  tools?: ReactNode
  children?: ReactNode
  sendError?: string
  hint?: string
}) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <>
      {children}
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <div className="flex items-center gap-2">
        {tools}
        <div className="flex min-w-0 flex-1 items-end gap-2 rounded-2xl border border-[#e8e9eb] bg-[#fafaf9] p-2">
          <textarea
            ref={inputRef}
            id={inputId}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            maxLength={4000}
            rows={1}
            disabled={sending || !canSend}
            placeholder="Write a message…"
            onKeyDown={(event) => {
              if (
                event.key !== "Enter" ||
                event.shiftKey ||
                event.nativeEvent.isComposing
              )
                return
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }}
            className="block min-h-9 max-h-32 min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-2 py-2 text-xs leading-5 focus-visible:outline-none disabled:opacity-50"
          />
          <Button
            type="submit"
            aria-label={sending ? "Sending…" : "Send message"}
            className="size-9 shrink-0 rounded-full bg-[#203f8c] p-0 text-white hover:bg-[#172f70]"
            disabled={!draft.trim() || !canSend || sending}
          >
            <Send
              size={15}
              aria-hidden="true"
              className="translate-x-[-1px] translate-y-[1px]"
            />
          </Button>
        </div>
      </div>
      {sendError && (
        <p role="status" className="mt-2 text-xs text-[#52627a]">
          Your text is saved here so you can retry.
        </p>
      )}
      <div className="mt-1.5 px-1 text-[9px] text-[#8791a2]">
        {draft.length}/4000{hint ? ` · ${hint}` : ""}
      </div>
    </>
  )
}
