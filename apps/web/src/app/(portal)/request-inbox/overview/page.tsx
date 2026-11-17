import { ModuleTransition } from "@/components/layout/module-transition"
import { RequestInboxOverviewPage } from "@/features/request-inbox/pages/request-inbox-overview-page"

export default function Page() {
  return (
    <ModuleTransition>
      <RequestInboxOverviewPage />
    </ModuleTransition>
  )
}
