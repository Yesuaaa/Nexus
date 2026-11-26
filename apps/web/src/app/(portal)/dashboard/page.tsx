import { DashboardPage } from "@/features/dashboard/pages/dashboard-page"
import { previewStates } from "@/features/dashboard/model/dashboard-preview"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string | string[] }>
}) {
  const { preview } = await searchParams
  const state = previewStates.find((value) => value === preview)
  if (!state) return <DashboardPage />
  // Schedule the illustrative consultation seven days ahead at 2 PM Manila.
  const startsAt = new Date()
  startsAt.setUTCDate(startsAt.getUTCDate() + 7)
  startsAt.setUTCHours(6, 0, 0, 0)
  return <DashboardPage preview={{ state, startsAt: startsAt.toISOString() }} />
}
