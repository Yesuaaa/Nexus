"use client"

import { usePortalAccount } from "@/features/auth/providers/account-context"
import { ClientProjectPage } from "./client-project-page"
import { ProjectPage } from "./project-page"

export function ProjectAccessPage({
  projectId,
  initialTab,
}: {
  projectId: string
  initialTab?: "overview" | "deliverables"
}) {
  const account = usePortalAccount()
  return account.role === "USER" ? (
    <ClientProjectPage projectId={projectId} initialTab={initialTab} />
  ) : (
    <ProjectPage projectId={projectId} />
  )
}
