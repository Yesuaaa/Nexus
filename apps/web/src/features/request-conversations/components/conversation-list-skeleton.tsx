import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function ConversationListSkeleton({
  internal = false,
  railCollapsed,
}: {
  internal?: boolean
  railCollapsed: boolean
}) {
  function rows(count: number) {
    return Array.from({ length: count }, (_, index) => (
      <div
        key={index}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-3",
          !internal && "mb-2",
          railCollapsed &&
            "mx-auto h-14 w-full max-w-14 justify-center gap-0 px-0 max-[767px]:h-auto max-[767px]:max-w-none max-[767px]:justify-start max-[767px]:gap-3 max-[767px]:px-3",
        )}
      >
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <div
          className={cn(
            "min-w-0 flex-1 space-y-1.5",
            railCollapsed && "hidden max-[767px]:block",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <Skeleton className={cn("h-3", index % 2 ? "w-2/5" : "w-1/2")} />
            {!internal && <Skeleton className="h-2 w-12 shrink-0" />}
          </div>
          <Skeleton className="h-2.5 w-3/4" />
          {!internal && <Skeleton className="h-3 w-4/5" />}
        </div>
      </div>
    ))
  }

  return (
    <div
      role="status"
      aria-label={internal ? "Loading internal chats" : "Loading conversations"}
    >
      <span className="sr-only">
        {internal ? "Loading internal chats…" : "Loading conversations…"}
      </span>
      <div aria-hidden="true">
        {internal ? (
          <>
            <div
              className={cn(
                "px-2 pb-2",
                railCollapsed && "px-0 max-[767px]:px-2",
              )}
            >
              <div
                className={cn(
                  "px-3 pt-2 pb-1",
                  railCollapsed && "hidden max-[767px]:block",
                )}
              >
                <Skeleton className="my-1 h-2.5 w-24" />
              </div>
              {rows(4)}
            </div>
            <div
              className={cn(
                "border-t border-[#efefee] px-2 pt-2",
                railCollapsed && "px-0 max-[767px]:px-2",
              )}
            >
              <div
                className={cn(
                  "px-3 pt-2 pb-1",
                  railCollapsed && "hidden max-[767px]:block",
                )}
              >
                <Skeleton className="my-1 h-2.5 w-20" />
              </div>
              {rows(7)}
            </div>
          </>
        ) : (
          rows(4)
        )}
      </div>
    </div>
  )
}
