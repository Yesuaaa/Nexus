import { MessagesPage } from "@/features/request-conversations/pages/messages-page"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ request?: string | string[] }>
}) {
  const { request } = await searchParams
  const requestId =
    typeof request === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(request)
      ? request
      : null
  return <MessagesPage requestId={requestId} />
}
