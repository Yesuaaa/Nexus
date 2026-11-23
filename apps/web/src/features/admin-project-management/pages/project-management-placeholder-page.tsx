import { FolderKanban } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils"

type ProjectManagementView = "management" | "overview"

const viewContent: Record<
  ProjectManagementView,
  {
    title: string
    headerDescription: string
    emptyTitle: string
    emptyDescription: string
  }
> = {
  management: {
    title: "Project Workspace Management",
    headerDescription:
      "Company-wide project management is planned for a future phase.",
    emptyTitle: "The company-wide project directory is not available yet",
    emptyDescription: "Project records are not included in Phase 1.",
  },
  overview: {
    title: "Project Workspace Overview",
    headerDescription:
      "Company-wide project analytics are planned for a future phase.",
    emptyTitle: "The company-wide project overview is not available yet",
    emptyDescription: "Project metrics are not included in Phase 1.",
  },
}

export function ProjectManagementPlaceholderPage({
  view,
}: {
  view: ProjectManagementView
}) {
  const content = viewContent[view]

  return (
    <main
      className={cn(contentClass, "px-[clamp(16px,2.1vw,32px)] py-6")}
      aria-label={content.title}
    >
      <PageHeader
        title={content.title}
        description={content.headerDescription}
      />
      <EmptyState
        icon={FolderKanban}
        title={content.emptyTitle}
        description={content.emptyDescription}
        size="lg"
        role="status"
        className="mt-6"
      />
    </main>
  )
}
