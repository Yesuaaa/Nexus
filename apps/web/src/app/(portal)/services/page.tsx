import { ModuleTransition } from "@/components/layout/module-transition"
import { ServicesPage } from "@/features/services/pages/services-page"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ service?: string | string[] }>
}) {
  const { service } = await searchParams
  const serviceId = typeof service === "string" ? service : undefined
  return (
    <ModuleTransition>
      <ServicesPage key={serviceId} serviceId={serviceId} />
    </ModuleTransition>
  )
}
