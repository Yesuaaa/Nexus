import { ModuleTransition } from "@/components/layout/module-transition"
import { DepartmentOverviewPage } from "@/features/departments/pages/department-overview-page"

export default function Page() {
  return (
    <ModuleTransition>
      <DepartmentOverviewPage />
    </ModuleTransition>
  )
}
