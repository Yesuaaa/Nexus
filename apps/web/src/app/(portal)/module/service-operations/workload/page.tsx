import { ModuleTransition } from "@/components/layout/module-transition"
import { WorkloadPage } from "@/features/workload/pages/workload-page"

export default function Page() {
  return (
    <ModuleTransition>
      <WorkloadPage administrative />
    </ModuleTransition>
  )
}
