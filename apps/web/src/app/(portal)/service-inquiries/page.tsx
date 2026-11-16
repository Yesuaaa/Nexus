import { ModuleTransition } from "@/components/layout/module-transition"
import { ServiceInquiriesPage } from "@/features/public-services/pages/service-inquiries-page"

export default function Page() {
  return (
    <ModuleTransition>
      <ServiceInquiriesPage />
    </ModuleTransition>
  )
}
