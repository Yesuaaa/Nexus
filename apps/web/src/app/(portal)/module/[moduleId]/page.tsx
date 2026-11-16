import { notFound } from "next/navigation"
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
  return <ModuleEntryPage moduleId={moduleId} />
}
