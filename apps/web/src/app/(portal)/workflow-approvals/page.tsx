import { WorkflowApprovalsPage } from "@/features/workflow-approvals/pages/workflow-approvals-page"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ request?: string | string[] }>
}) {
  const { request } = await searchParams
  return (
    <WorkflowApprovalsPage
      requestId={
        typeof request === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(request)
          ? request
          : null
      }
    />
  )
}
