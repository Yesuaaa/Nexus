"use client"

import { PageHeader, PageHeaderButton } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { FiguresRow, Section } from "@/components/ui/overview-panel"
import { Alert } from "@/components/ui/alert"
import { Pill } from "@/components/ui/pill"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { canAccessPayroll } from "@/features/auth/model/permissions"
import { usePayrollDocuments } from "../hooks/use-payroll-documents"
import { money } from "../model/payroll-documents"
import { PayslipsTable } from "../components/payroll-documents/payslips-table"
import { PayrollRequestsTable } from "../components/payroll-documents/payroll-requests-table"
import { PayrollDocumentDialogs } from "../components/payroll-documents/payroll-document-dialogs"
import { ApprovedRunsTable } from "../components/payroll-documents/approved-runs-table"
import { ApprovedRunDetailsSidebar } from "../components/payroll-documents/approved-run-details-sidebar"

export function PayrollDocumentsPage({ staff = false }: { staff?: boolean }) {
  const documents = usePayrollDocuments({ staff })
  const {
    overview,
    startRequest,
    manage,
    activeTab,
    setActiveTab,
    setRefresh,
    account,
    selectedRunId,
    refresh,
    busy,
    setSelectedRunId,
    resetForm,
    preferences,
    mutate,
    setConfirm,
  } = documents

  if (staff)
    return (
      <main
        className={
          contentClass + " grid min-w-0 gap-6 p-[clamp(16px,2.1vw,32px)]"
        }
      >
        <PageHeader
          headingId="my-payroll-heading"
          title="My Payroll"
          description="View your payslips, payroll history, and salary-related concerns."
          actions={
            overview.data?.linked ? (
              <PageHeaderButton onClick={startRequest}>
                Raise a concern
              </PageHeaderButton>
            ) : undefined
          }
        />
        <Section title="Payroll summary">
          <FiguresRow
            items={[
              {
                label: "Latest Net Pay",
                value:
                  overview.data?.linked && overview.data.latestPayslip
                    ? money(
                        overview.data.latestPayslip,
                        overview.data.latestPayslip.net,
                      )
                    : "—",
              },
              {
                label: "Latest Payroll Period",
                value:
                  overview.data?.linked && overview.data.latestPayslip
                    ? overview.data.latestPayslip.period.cutoffLabel
                    : "—",
              },
              {
                label: "Open Concerns",
                value: overview.data?.linked
                  ? String(overview.data.openConcernCount)
                  : "—",
              },
            ]}
            loading={overview.loading}
            label="My payroll overview"
          />
        </Section>
        <div className="grid min-w-0 gap-6">
          {overview.error && <Alert>{overview.error}</Alert>}
          {overview.data && !overview.data.linked && (
            <Alert>Your Staff account has no linked employee record.</Alert>
          )}
          <PayslipsTable documents={documents} />
          <PayrollRequestsTable documents={documents} />
          <PayrollDocumentDialogs documents={documents} />
        </div>
      </main>
    )

  return (
    <main className={contentClass + " min-w-0 p-[clamp(16px,2.1vw,32px)]"}>
      <PageHeader
        headingId="payroll-documents-heading"
        title="Payslips & Payroll History"
        description="Manage approved payroll records, employee payslips, and publication history."
        actions={!manage ? <Pill tone="neutral">Read only</Pill> : undefined}
      />
      <Tabs
        value={activeTab}
        onValueChange={(tab) => {
          setActiveTab(tab)
          setRefresh((value) => value + 1)
        }}
        className="mt-[18px] min-w-0"
      >
        <TabsContent value="payslips">
          <PayslipsTable documents={documents} />
        </TabsContent>
        <TabsContent value="runs">
          {canAccessPayroll(account) ? (
            <ApprovedRunsTable documents={documents} />
          ) : (
            <Alert>
              Approved run actions are available to payroll managers.
            </Alert>
          )}
        </TabsContent>
        <TabsContent value="requests">
          <PayrollRequestsTable documents={documents} />
        </TabsContent>
      </Tabs>
      {selectedRunId && (
        <ApprovedRunDetailsSidebar
          key={selectedRunId}
          runId={selectedRunId}
          refreshKey={refresh}
          manage={manage}
          busy={busy}
          onClose={() => setSelectedRunId("")}
          onAction={(action, run) => {
            resetForm()
            if (
              action === "publish" &&
              preferences.data?.requirePublicationConfirmation === false
            ) {
              void mutate(
                "/runs/" + encodeURIComponent(run.id) + "/publish-payslips",
              )
              return
            }
            setConfirm({ action, run })
          }}
          onChanged={() => setRefresh((value) => value + 1)}
        />
      )}
      <PayrollDocumentDialogs documents={documents} />
    </main>
  )
}
