import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function Page() {
  return (
    <main className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}>
      <PageHeader
        title="Project Workspace Overview"
        description="Department project analytics will be available in Phase 3."
        actions={
          <Button asChild variant="brandOutline" size="header">
            <Link href="/project-workspace">Manage projects</Link>
          </Button>
        }
      />
    </main>
  )
}
