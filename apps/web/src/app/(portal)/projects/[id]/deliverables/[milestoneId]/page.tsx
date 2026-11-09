import { ClientDeliverablePage } from "@/features/projects/pages/client-deliverable-page"

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; milestoneId: string }>
}) {
  const { id, milestoneId } = await params
  return (
    <ClientDeliverablePage
      key={`${id}:${milestoneId}`}
      projectId={id}
      deliverableId={milestoneId}
    />
  )
}
