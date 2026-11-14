import { ModuleTransition } from "@/components/layout/module-transition"
import { ServiceOverviewPage } from "@/features/services/pages/service-overview-page"

export default function Page() {
  return (
    <ModuleTransition>
      <ServiceOverviewPage />
    </ModuleTransition>
  )
}
