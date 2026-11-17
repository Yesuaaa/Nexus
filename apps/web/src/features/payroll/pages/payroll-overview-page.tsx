"use client"

import { Banknote } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Pill } from "@/components/ui/pill"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { canManagePayroll } from "@/features/auth/model/permissions"

export function PayrollOverviewPage() {
  const account = usePortalAccount()
  const readOnly = !canManagePayroll(account)

  return (
    <main
      className={`${contentClass} p-[clamp(16px,2.1vw,32px)]`}
      aria-label="Payroll Management"
    >
      <PageHeader
        title="Payroll Management"
        description="Manage employee compensation and effective-dated payroll schedules."
        actions={readOnly ? <Pill tone="neutral">Read only</Pill> : undefined}
      />
      <EmptyState
        icon={Banknote}
        title="Configure compensation and schedules"
        description="Set employee pay rates and recurring components, then define the payroll schedule."
        size="lg"
        role="status"
        className="mt-5"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="brand">
              <Link href="/module/payroll/compensation">
                Employee Compensation
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/module/payroll/settings">Payroll Settings</Link>
            </Button>
          </div>
        }
      />
    </main>
  )
}
