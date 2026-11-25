import { notFound } from "next/navigation"
import { ModuleTransition } from "@/components/layout/module-transition"
import { moduleRegistry } from "@/features/workspaces/model/module-registry"
import { ModuleEntryPage } from "@/features/workspaces/pages/module-entry-page"

export default async function Page({
  params,
}: {
  params: Promise<{ moduleId: string }>
}) {
  const { moduleId } = await params
  if (
    !Object.hasOwn(moduleRegistry, moduleId) ||
    !moduleRegistry[moduleId as keyof typeof moduleRegistry].implemented
  )
    notFound()
  const page = <ModuleEntryPage moduleId={moduleId} />
  return moduleId === "service-operations" ? (
    <ModuleTransition>{page}</ModuleTransition>
  ) : (
    page
  )
}
