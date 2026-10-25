import type { ComponentProps } from "react"
import type { Account } from "@/features/auth/model/types"
import { AppLayout } from "./app-layout"

type RoleLayoutProps = ComponentProps<typeof AppLayout>

// Each role has an extension point while sharing the existing portal UI.
// Client is the display role for the API's unchanged USER role.
export function SuperadminLayout(props: RoleLayoutProps) {
  return <AppLayout {...props} />
}

export function AdminLayout(props: RoleLayoutProps) {
  return <AppLayout {...props} />
}

export function StaffLayout(props: RoleLayoutProps) {
  return <AppLayout {...props} />
}

export function ClientLayout(props: RoleLayoutProps) {
  return <AppLayout {...props} />
}

const roleLayouts = {
  SUPERADMIN: SuperadminLayout,
  ADMIN: AdminLayout,
  STAFF: StaffLayout,
  USER: ClientLayout,
} satisfies Record<Account["role"], typeof AppLayout>

export function RoleLayout(props: RoleLayoutProps) {
  const Layout = roleLayouts[props.account.role]
  return <Layout {...props} />
}
