import { ModuleTransition } from "@/components/layout/module-transition"
import { ServicesPage } from "@/features/services/pages/services-page"

export default function Page() {
  return (
    <ModuleTransition>
      <ServicesPage />
    </ModuleTransition>
  )
}
