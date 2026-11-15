import { ModuleTransition } from "@/components/layout/module-transition"
import { EmployeeManagementPage } from "@/features/employees/pages/employee-management-page"

export default function Page() {
  return (
    <ModuleTransition>
      <EmployeeManagementPage />
    </ModuleTransition>
  )
}
