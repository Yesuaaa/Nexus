import { ModuleTransition } from "@/components/layout/module-transition"
import { RequestInboxPage } from "@/features/request-inbox/pages/request-inbox-page"

export default function Page() {
  return (
    <ModuleTransition>
      <RequestInboxPage />
    </ModuleTransition>
  )
}
