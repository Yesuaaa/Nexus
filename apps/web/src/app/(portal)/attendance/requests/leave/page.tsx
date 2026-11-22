import { LeaveRequestsPage } from "@/features/leave/pages/leave-requests-page"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>
}) {
  const { request } = await searchParams
  const requestId = typeof request === "string" ? request : undefined
  return <LeaveRequestsPage key={requestId} linkedId={requestId} />
}
