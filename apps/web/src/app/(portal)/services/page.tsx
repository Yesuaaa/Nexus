import { ModuleTransition } from "@/components/layout/module-transition"
import { ServicesPage } from "@/features/services/pages/services-page"
import { parseInquiryService } from "@/features/public-services/model/service-inquiry-link"

export default async function Page({ searchParams }: PageProps<"/services">) {
  return (
    <ModuleTransition>
      <ServicesPage
        inquiryService={parseInquiryService((await searchParams).service)}
      />
    </ModuleTransition>
  )
}
