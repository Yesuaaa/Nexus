import moduleRegistry from "./module-registry.json" with { type: "json" }
import {
  AdministrativeCapability,
  hasAdministrativeCapability,
  hasPayrollCapability,
  PayrollCapability,
  hasBillingCapability,
  BillingCapability,
  type AuthorizationActor,
} from "../auth/auth.capabilities.js"
import { fail } from "../../shared/http-error.js"

export { moduleRegistry }
type ModuleRegistration = {
  title: string
  description: string
  implemented: boolean
  administrativePath: string | null
  icon: string
  color: string
  staffOnly?: boolean
  workspaceParent?: string
}
type ModuleRegistry = Readonly<Record<string, ModuleRegistration>>

export function getAdministrativeModule(
  actor: AuthorizationActor,
  id: string,
  registry: ModuleRegistry = moduleRegistry,
) {
  const canReadPayroll =
    id === "payroll" && hasPayrollCapability(actor, PayrollCapability.READ)
  const canReadBilling =
    id === "billing-finance" &&
    hasBillingCapability(actor, BillingCapability.READ)
  if (
    !canReadPayroll &&
    !canReadBilling &&
    !hasAdministrativeCapability(actor, AdministrativeCapability.MODULE_ACCESS)
  )
    fail(403, "Administrative module access is required")
  if (
    !Object.hasOwn(registry, id) ||
    !registry[id].implemented ||
    "staffOnly" in registry[id]
  )
    fail(404, "Module not available")
  const module = registry[id]
  return {
    id,
    title: module.title,
    description: module.description,
    href: module.administrativePath ?? `/module/${id}`,
  }
}

export function listAdministrativeModules(actor: AuthorizationActor) {
  if (
    !hasAdministrativeCapability(actor, AdministrativeCapability.MODULE_ACCESS)
  )
    fail(403, "Administrative module access is required")
  return Object.entries(moduleRegistry)
    .filter(
      ([, module]) =>
        module.implemented &&
        !("staffOnly" in module || "workspaceParent" in module),
    )
    .map(([id]) => getAdministrativeModule(actor, id))
}
