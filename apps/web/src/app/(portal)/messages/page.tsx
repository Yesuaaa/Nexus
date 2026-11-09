import { MessagesPage } from "@/features/request-conversations/pages/messages-page"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    request?: string | string[]
    internal?: string | string[]
    project?: string | string[]
    mode?: string | string[]
    view?: string | string[]
  }>
}) {
  const { request, internal, project, mode, view } = await searchParams
  const projectId =
    typeof project === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(project)
      ? project
      : null
  const requestId =
    typeof request === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(request)
      ? request
      : null
  const internalId =
    typeof internal === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(internal)
      ? internal
      : null
  const conversationView = view === "archived" ? "archived" : "active"
  return (
    <MessagesPage
      requestId={requestId}
      internalId={internalId}
      projectId={projectId}
      view={conversationView}
      mode={mode === "internal" ? "internal" : "requests"}
    />
  )
}
