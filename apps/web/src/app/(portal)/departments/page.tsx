import { ModuleTransition } from "@/components/layout/module-transition"
import { DepartmentManagementPage } from "@/features/departments/pages/department-management-page"

export default function Page() {
  return (
    <ModuleTransition>
      <DepartmentManagementPage />
    </ModuleTransition>
  )
}
