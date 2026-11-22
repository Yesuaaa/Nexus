import { AttendanceAdjustmentsPage } from "@/features/attendance/pages/attendance-adjustments-page"
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>
}) {
  const { request } = await searchParams
  const requestId = typeof request === "string" ? request : undefined
  return (
    <AttendanceAdjustmentsPage
      requestType="OVERTIME"
      key={requestId}
      linkedId={requestId}
    />
  )
}
