import { ModuleTransition } from "@/components/layout/module-transition"
import { ServiceLogsPage } from "@/features/service-operation-logs/pages/service-logs-page"

export default function Page() {
  return (
    <ModuleTransition>
      <ServiceLogsPage />
    </ModuleTransition>
  )
}
