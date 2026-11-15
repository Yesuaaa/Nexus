"use client"

import Link from "next/link"
import { LayoutGrid } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { useAsyncResource } from "@/lib/use-async-resource"
import { useBreadcrumbLabel } from "@/components/layout/breadcrumbs"
import { getAdministrativeModule } from "../api/modules-api"
import { AdministrativeProjectsOverview } from "@/features/projects/pages/administrative-projects-overview"
import { AdministrativeRequestsPage } from "@/features/request-inbox/pages/administrative-requests-page"

export function ModuleEntryPage({ moduleId }: { moduleId: string }) {
  const result = useAsyncResource(
    (signal) => getAdministrativeModule(moduleId, signal),
    [moduleId],
    { fallbackError: "Couldn't open this workspace." },
  )
  const module =
    !result.loading && !result.error ? result.data?.module : undefined
  useBreadcrumbLabel(moduleId, module?.title)

  return (
    <main className={contentClass} aria-label="Administrative workspace">
      {result.loading ? (
        <p role="status">Opening workspace…</p>
      ) : result.error ? (
        <div role="alert">
          <p>{result.error}</p>
          <Button variant="outline" onClick={result.retry}>
            Retry
          </Button>
        </div>
      ) : module ? (
        <>
          <PageHeader title={module.title} description={module.description} />
          {moduleId === "project-management" ? (
            <AdministrativeProjectsOverview />
          ) : moduleId === "service-operations" ? (
            <AdministrativeRequestsPage />
          ) : (
            <EmptyState
              icon={LayoutGrid}
              title="Administrative workspace"
              description="Additional administrative tools are not available here yet. Operational work remains with the assigned staff."
            />
          )}
          {module.href !== `/module/${moduleId}` && (
            <Link href={module.href}>Open management tools</Link>
          )}
        </>
      ) : null}
      <Link href="/module">Switch Workspace</Link>
    </main>
  )
}
