"use client"

import { usePortalAccount } from "@/features/auth/providers/account-context"
import dynamic from "next/dynamic"
import { contentClass } from "@/components/layout/styles"
import { ServiceManagementPage } from "./service-management-page"

function ServicesLoading() {
  return (
    <main className={contentClass} role="status">
      Loading services…
    </main>
  )
}
const ClientServicesPage = dynamic(
  () =>
    import("./client-services-page").then(
      (module) => module.ClientServicesPage,
    ),
  { loading: ServicesLoading },
)

export function ServicesPage() {
  const account = usePortalAccount()

  return account.role === "USER" ? (
    <ClientServicesPage />
  ) : (
    <ServiceManagementPage />
  )
}
