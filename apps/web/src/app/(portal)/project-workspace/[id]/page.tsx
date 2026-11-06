import { WorkspaceDetailPage } from "@/features/project-workspace/pages/workspace-detail-page"

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <WorkspaceDetailPage key={id} id={id} />
}
