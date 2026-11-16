import { WorkspaceDetailPage } from "@/features/project-workspace/pages/workspace-detail-page"

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const identity = id.replace(/%3A/i, ":")
  return <WorkspaceDetailPage key={identity} id={identity} />
}
