"use client"

import { useEffect, useState } from "react"
import { Download, ArrowLeft, RefreshCw } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import {
  SidePanelSection,
  DetailItem,
  DetailList,
} from "@/components/ui/side-panel"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { MemberRowSkeleton } from "@/components/ui/panel-loading"
import {
  apiRequest,
  apiStreamRequest,
  downloadAuthenticatedFile,
} from "@/features/auth/api/auth-api"
import { errorMessage } from "@/lib/error-message"
import { sileo } from "@/lib/toast"
import { formatPayrollMoney } from "../../model/money"
import type { PayrollRunItem } from "../../api/payroll-runs-api"
import {
  payslipStatusTone,
  payslipStatusLabel,
} from "../../model/payroll-documents"

export function usePayslipPreview(payslipId: string, generatedAt: string) {
  const [preview, setPreview] = useState({
    key: "",
    url: "",
    error: "",
  })
  const previewKey = payslipId + ":" + generatedAt
  const previewLoading = Boolean(payslipId && preview.key !== previewKey)
  const previewUrl = preview.key === previewKey ? preview.url : ""
  const previewError = preview.key === previewKey ? preview.error : ""
  useEffect(() => {
    let active = true
    let url = ""
    if (!payslipId) return
    const controller = new AbortController()
    void apiStreamRequest(
      "/api/payroll/payslips/" + encodeURIComponent(payslipId) + "/preview",
      { signal: controller.signal },
    )
      .then((response) => {
        if (!response.headers.get("content-type")?.includes("application/pdf"))
          throw new Error("Invalid payslip document")
        return response.blob()
      })
      .then(async (blob) => {
        if ((await blob.slice(0, 5).text()) !== "%PDF-")
          throw new Error("Invalid payslip document")
        if (!active) return
        url = URL.createObjectURL(blob)
        setPreview({ key: previewKey, url, error: "" })
      })
      .catch(() => {
        if (active)
          setPreview({
            key: previewKey,
            url: "",
            error: "Couldn't load the payslip preview.",
          })
      })
    return () => {
      active = false
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [payslipId, previewKey])
  return { previewLoading, previewUrl, previewError }
}

export function PayslipReview({
  item,
  manage,
  busy,
  onBack,
  onChanged,
}: {
  item: PayrollRunItem
  manage: boolean
  busy: boolean
  onBack: () => void
  onChanged: () => void
}) {
  const [regenerating, setRegenerating] = useState(false)
  const { previewLoading, previewUrl, previewError } = usePayslipPreview(
    item.payslip?.id ?? "",
    item.payslip?.generatedAt ?? "",
  )

  async function regenerate() {
    if (!item.payslip || regenerating || busy) return
    setRegenerating(true)
    try {
      await apiRequest(
        "/api/payroll/payslips/" +
          encodeURIComponent(item.payslip.id) +
          "/regenerate",
        { method: "POST" },
      )
      sileo.success({ title: "Payslip regenerated" })
      onChanged()
    } catch (cause) {
      sileo.error({
        title: errorMessage(cause, "Couldn't regenerate the payslip."),
      })
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="grid min-w-0 gap-5">
      <SidePanelSection
        title="Payslip review"
        action={
          <Button type="button" size="sm" variant="outline" onClick={onBack}>
            <ArrowLeft size={14} aria-hidden="true" />
            Back
          </Button>
        }
      >
        <DetailList>
          <DetailItem label="Employee">{item.employeeName}</DetailItem>
          <DetailItem label="Employee ID">{item.employeeNumber}</DetailItem>
          <DetailItem label="Net pay">
            <span className="tabular-nums">
              {formatPayrollMoney(item.netAmount)}
            </span>
          </DetailItem>
          <DetailItem label="Payslip status">
            <Pill tone={payslipStatusTone(item.payslipStatus)}>
              {payslipStatusLabel(item.payslipStatus)}
            </Pill>
          </DetailItem>
          <DetailItem label="Publication status">
            {item.payslip?.publishedAt ? (
              <Pill tone="success">Published</Pill>
            ) : item.payslip ? (
              <Pill tone="info">Generated</Pill>
            ) : (
              <Pill tone="neutral">Not generated</Pill>
            )}
          </DetailItem>
        </DetailList>
      </SidePanelSection>
      <SidePanelSection title="PDF preview">
        {previewLoading ? (
          <div aria-busy="true" className="grid gap-2">
            <span className="sr-only" role="status">
              Loading payslip preview…
            </span>
            <MemberRowSkeleton className="py-3" />
            <MemberRowSkeleton className="py-3" />
          </div>
        ) : previewError ? (
          <Alert>{previewError}</Alert>
        ) : previewUrl ? (
          <iframe
            title={`Payslip preview for ${item.employeeName}`}
            src={previewUrl}
            className="h-[min(58dvh,560px)] min-h-[320px] w-full rounded-lg border-0 bg-[#f4f6f9]"
          />
        ) : (
          <EmptyState
            title="Payslip not generated"
            description="Generate payslips for this approved run before reviewing a PDF."
            size="sm"
            role="status"
          />
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!item.payslip}
            onClick={() =>
              item.payslip &&
              void downloadAuthenticatedFile(
                "/api/payroll/payslips/" +
                  encodeURIComponent(item.payslip.id) +
                  "/download",
                item.payslip.reference + ".pdf",
              )
            }
          >
            <Download size={14} aria-hidden="true" />
            Download PDF
          </Button>
          {manage && item.payslip && !item.payslip.publishedAt && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={regenerating || busy}
              onClick={() => void regenerate()}
            >
              <RefreshCw size={14} aria-hidden="true" />
              {regenerating ? "Regenerating…" : "Regenerate PDF"}
            </Button>
          )}
        </div>
      </SidePanelSection>
    </div>
  )
}
