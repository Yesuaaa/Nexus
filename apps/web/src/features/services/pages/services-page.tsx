"use client"

import { usePortalAccount } from "@/features/auth/providers/account-context"
import { ClientServicesPage } from "./client-services-page"
import { ServiceManagementPage } from "./service-management-page"

export function ServicesPage() {
  const account = usePortalAccount()

  return account.role === "USER" ? (
    <ClientServicesPage />
  ) : (
    <ServiceManagementPage />
  )
}
