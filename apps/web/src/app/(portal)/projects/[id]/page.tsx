import { ProjectAccessPage } from "@/features/projects/pages/project-access-page"

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams])
  const initialTab =
    tab === "deliverables" || tab === "notes" || tab === "team"
      ? tab
      : "overview"
  return (
    <ProjectAccessPage
      key={`${id}:${initialTab}`}
      projectId={id}
      initialTab={initialTab}
    />
  )
}
