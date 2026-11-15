import moduleRegistry from "./module-registry.json" with { type: "json" }
import {
  AdministrativeCapability,
  hasAdministrativeCapability,
  type AuthorizationActor,
} from "../auth/auth.capabilities.js"
import { fail } from "../../shared/http-error.js"

export { moduleRegistry }
type ModuleRegistration = (typeof moduleRegistry)[keyof typeof moduleRegistry]
type ModuleRegistry = Readonly<Record<string, ModuleRegistration>>

export function getAdministrativeModule(
  actor: AuthorizationActor,
  id: string,
  registry: ModuleRegistry = moduleRegistry,
) {
  if (
    !hasAdministrativeCapability(actor, AdministrativeCapability.MODULE_ACCESS)
  )
    fail(403, "Administrative module access is required")
  if (!Object.hasOwn(registry, id) || !registry[id].implemented)
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
    .filter(([, module]) => module.implemented)
    .map(([id]) => getAdministrativeModule(actor, id))
}
