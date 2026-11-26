"use client"

import { useState } from "react"
import { FileText } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import {
  SidePanel,
  SidePanelBody,
  SidePanelButton,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelSection,
  DetailItem,
  DetailList,
  useSidePanel,
} from "@/components/ui/side-panel"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Modal, ModalBody, ModalHeader } from "@/components/ui/modal"
import { Pill } from "@/components/ui/pill"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MemberRowSkeleton } from "@/components/ui/panel-loading"
import { humanizeEnum } from "@/lib/format"
import { formatPayrollMoney } from "../../model/money"
import {
  type Payslip,
  payslipStatusTone,
  payslipStatusLabel,
  timestamp,
} from "../../model/payroll-documents"
import { usePayslipPreview } from "./payslip-review"

export function IndividualPayslipDetails({
  slip,
  onClose,
  onDownload,
}: {
  slip: Payslip
  onClose: () => void
  onDownload: () => Promise<void>
}) {
  const panel = useSidePanel(onClose)
  const [previewSession, setPreviewSession] = useState({ open: false, id: 0 })
  const openPreview = () =>
    setPreviewSession((session) => ({ open: true, id: session.id + 1 }))
  const [downloading, setDownloading] = useState(false)
  const preview = usePayslipPreview(
    previewSession.open ? slip.id : "",
    slip.generatedAt + ":" + previewSession.id,
  )
  const status = slip.publishedAt ? "PUBLISHED" : "GENERATED"
  const period = `${slip.period.cutoffLabel} · Revision ${slip.revision}`

  return (
    <SidePanel open={panel.open} onOpenChange={panel.onOpenChange}>
      <SidePanelHeader
        title="Payslip Details"
        description={period}
        meta={
          <Pill tone={payslipStatusTone(status)}>
            {payslipStatusLabel(status)}
          </Pill>
        }
      />
      <Tabs
        defaultValue="overview"
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <TabsList aria-label="Payslip detail sections" variant="underline">
          <TabsTrigger value="overview" variant="underline">
            Overview
          </TabsTrigger>
          <TabsTrigger value="document" variant="underline">
            Document
          </TabsTrigger>
        </TabsList>
        <SidePanelBody className="min-w-0 grid-cols-1">
          <TabsContent value="overview" className="mt-0 min-w-0 space-y-5">
            <SidePanelSection title="Employee information">
              <DetailList>
                <DetailItem label="Employee">{slip.employeeName}</DetailItem>
                <DetailItem label="Employee ID">
                  {slip.employeeNumber}
                </DetailItem>
                <DetailItem label="Frequency">
                  {humanizeEnum(slip.period.configuration.frequency)}
                </DetailItem>
                {slip.period.startDate && slip.period.endDate && (
                  <DetailItem label="Payroll dates">
                    {slip.period.startDate.slice(0, 10)} –{" "}
                    {slip.period.endDate.slice(0, 10)}
                  </DetailItem>
                )}
              </DetailList>
            </SidePanelSection>
            <SidePanelSection title="Financial breakdown">
              <DetailList className="tabular-nums [&_dt]:min-w-0 [&_dt]:shrink [&_dt]:[overflow-wrap:anywhere] [&_dd]:shrink-0">
                {slip.lines.map((line, index) => (
                  <DetailItem
                    key={index}
                    label={`${humanizeEnum(line.componentType)} · ${line.name}`}
                  >
                    {formatPayrollMoney(line.amount)}
                  </DetailItem>
                ))}
                <DetailItem label="Gross pay">
                  <strong>{formatPayrollMoney(slip.gross)}</strong>
                </DetailItem>
                <DetailItem label="Total deductions">
                  {formatPayrollMoney(slip.deductions)}
                </DetailItem>
                <DetailItem label="Net pay">
                  <strong className="text-sm">
                    {formatPayrollMoney(slip.net)}
                  </strong>
                </DetailItem>
              </DetailList>
            </SidePanelSection>
            <SidePanelSection title="Document history">
              <DetailList>
                <DetailItem label="Generated at">
                  {timestamp(slip.generatedAt)}
                </DetailItem>
                <DetailItem label="Published at">
                  {slip.publishedAt
                    ? timestamp(slip.publishedAt)
                    : "Awaiting publication"}
                </DetailItem>
                <DetailItem label="Reference">{slip.reference}</DetailItem>
              </DetailList>
            </SidePanelSection>
          </TabsContent>
          <TabsContent value="document" className="mt-0 min-w-0">
            <SidePanelSection
              title="Payslip document"
              action={
                <Button variant="outline" size="sm" onClick={openPreview}>
                  Preview PDF
                </Button>
              }
            >
              <DetailList layout="stacked">
                <DetailItem label="Document">
                  <FileText
                    size={14}
                    className="mr-1 inline"
                    aria-hidden="true"
                  />
                  {slip.employeeName} · Payslip PDF
                </DetailItem>
                <DetailItem label="Payroll period">{period}</DetailItem>
                <DetailItem label="Format">A4 PDF</DetailItem>
                <DetailItem label="Reference">{slip.reference}</DetailItem>
              </DetailList>
              {slip.publishedAt && (
                <p className="m-0 text-xs text-muted-foreground">
                  Published payslips retain their original PDF.
                </p>
              )}
            </SidePanelSection>
          </TabsContent>
        </SidePanelBody>
      </Tabs>
      <SidePanelFooter className="flex-wrap justify-between">
        <SidePanelButton variant="secondary" onClick={() => panel.close()}>
          Close
        </SidePanelButton>
        <div className="flex flex-wrap gap-2">
          <SidePanelButton variant="secondary" onClick={openPreview}>
            Preview PDF
          </SidePanelButton>
          <SidePanelButton
            disabled={downloading}
            onClick={async () => {
              setDownloading(true)
              try {
                await onDownload()
              } finally {
                setDownloading(false)
              }
            }}
          >
            {downloading ? "Downloading…" : "Download PDF"}
          </SidePanelButton>
        </div>
      </SidePanelFooter>
      {previewSession.open && (
        <Modal
          elevated
          size="xl"
          onClose={() =>
            setPreviewSession((session) => ({ ...session, open: false }))
          }
          className="flex max-h-[94dvh] flex-col"
        >
          <ModalHeader title="Payslip PDF preview" description={period} />
          <ModalBody className="min-h-0 overflow-y-auto">
            {preview.previewLoading ? (
              <div aria-busy="true">
                <span role="status">Loading payslip preview…</span>
                <MemberRowSkeleton />
              </div>
            ) : preview.previewError ? (
              <Alert role="alert">{preview.previewError}</Alert>
            ) : preview.previewUrl ? (
              <iframe
                title={`Payslip preview for ${slip.employeeName}`}
                src={preview.previewUrl}
                className="block h-[72dvh] w-full border-0"
              />
            ) : (
              <EmptyState title="Payslip PDF unavailable" size="sm" />
            )}
          </ModalBody>
        </Modal>
      )}
    </SidePanel>
  )
}
