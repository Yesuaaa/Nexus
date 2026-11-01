import { MessagesPage } from "@/features/request-conversations/pages/messages-page"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    request?: string | string[]
    internal?: string | string[]
    mode?: string | string[]
    view?: string | string[]
  }>
}) {
  const { request, internal, mode, view } = await searchParams
  const requestId =
    typeof request === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(request)
      ? request
      : null
  const internalId =
    typeof internal === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(internal)
      ? internal
      : null
  return (
    <MessagesPage
      requestId={requestId}
      internalId={internalId}
      mode={mode === "internal" ? "internal" : "requests"}
      view={view === "archived" ? "archived" : "active"}
    />
  )
}
