"use client"

import { LayoutGrid } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { useAsyncResource } from "@/lib/use-async-resource"
import { cn } from "@/lib/utils"
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
  const pageTitle =
    moduleId === "service-operations" ? "Service Requests" : module?.title
  const pageDescription =
    moduleId === "service-operations"
      ? "Review organization-wide service requests."
      : module?.description
  useBreadcrumbLabel(moduleId, module?.title)

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Administrative workspace"
    >
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
          <PageHeader
            headingId="administrative-workspace-heading"
            title={pageTitle}
            description={pageDescription}
          />
          <div className="mt-5">
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
          </div>
        </>
      ) : null}
    </main>
  )
}
