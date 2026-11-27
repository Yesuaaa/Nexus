import { ModuleTransition } from "@/components/layout/module-transition"
import { ClientServiceRequestsPage } from "@/features/services/pages/client-service-requests-page"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ request?: string | string[] }>
}) {
  const { request } = await searchParams
  const requestId = typeof request === "string" ? request : undefined
  return (
    <ModuleTransition>
      <ClientServiceRequestsPage key={requestId} requestId={requestId} />
    </ModuleTransition>
  )
}
