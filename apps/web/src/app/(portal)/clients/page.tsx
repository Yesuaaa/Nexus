import { ModuleTransition } from "@/components/layout/module-transition"
import { ClientManagementPage } from "@/features/clients/pages/client-management-page"

export default function Page() {
  return (
    <ModuleTransition>
      <ClientManagementPage />
    </ModuleTransition>
  )
}
