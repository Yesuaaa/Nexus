import { WorkspaceDirectoryPage } from "@/features/project-workspace/pages/workspace-directory-page"

export default async function Page({
  params,
}: {
  params: Promise<{ departmentId: string }>
}) {
  const { departmentId } = await params
  return <WorkspaceDirectoryPage scopedDepartmentId={departmentId} />
}
