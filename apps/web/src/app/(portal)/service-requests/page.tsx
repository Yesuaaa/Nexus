import { ModuleTransition } from "@/components/layout/module-transition"
import { ClientServiceRequestsPage } from "@/features/services/pages/client-service-requests-page"

export default function Page() {
  return (
    <ModuleTransition>
      <ClientServiceRequestsPage />
    </ModuleTransition>
  )
}
