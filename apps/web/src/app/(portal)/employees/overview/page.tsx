import { ModuleTransition } from "@/components/layout/module-transition"
import { EmployeeOverviewPage } from "@/features/employees/pages/employee-overview-page"

export default function Page() {
  return (
    <ModuleTransition>
      <EmployeeOverviewPage />
    </ModuleTransition>
  )
}
