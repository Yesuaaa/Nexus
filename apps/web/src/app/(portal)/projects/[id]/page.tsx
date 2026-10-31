import { ProjectPage } from "@/features/projects/pages/project-page"

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ProjectPage key={id} projectId={id} />
}
