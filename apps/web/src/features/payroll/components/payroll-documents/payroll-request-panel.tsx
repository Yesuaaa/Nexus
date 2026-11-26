"use client"

import { SidePanelButton, SidePanelFooter } from "@/components/ui/side-panel"
import { Button } from "@/components/ui/button"
import { ModalFooter } from "@/components/ui/modal"
import { humanizeEnum } from "@/lib/format"
import type { PayrollDocumentsState } from "../../hooks/use-payroll-documents"
import { PayrollRecordDetail } from "./record-layout"
import { PayrollRequestDetails } from "./payroll-request-details"
import { PayrollRequestForm } from "./payroll-request-form"

/** Panel for creating, viewing and answering a payroll request. */
export function PayrollRequestPanel({
  documents,
}: {
  documents: PayrollDocumentsState
}) {
  const {
    create,
    selected,
    editing,
    staff,
    busy,
    setCreate,
    setSelected,
    resetForm,
    concernFormValid,
    manage,
    openRequest,
    hasUnsavedResponseChanges,
    setDiscardResponseConfirm,
    closeSelectedRequest,
  } = documents

  return (
    <>
      {(create || selected) && (
        <PayrollRecordDetail
          sidePanel={!create}
          title={
            create
              ? editing
                ? "Edit concern"
                : staff
                  ? "Raise a concern"
                  : "New payroll request"
              : staff
                ? "Concern details"
                : "Payroll Request Details"
          }
          description={
            staff
              ? create
                ? editing
                  ? "Update the concern type, description, or related payslip."
                  : "Report missing payslips, salary discrepancies, or other payroll-related concerns."
                : "Your concern and Admin responses."
              : selected
                ? humanizeEnum(selected.type)
                : "Payroll request"
          }
          footer={
            staff && create ? (
              <ModalFooter className="justify-end max-[560px]:grid max-[560px]:grid-cols-2">
                <Button
                  type="button"
                  size="modal"
                  variant="brandOutline"
                  className="max-[560px]:w-full"
                  disabled={busy}
                  onClick={() => {
                    setCreate(false)
                    setSelected(null)
                    resetForm()
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="payroll-concern-form"
                  size="modal"
                  variant="brand"
                  className="max-[560px]:w-full"
                  disabled={!concernFormValid}
                >
                  {busy
                    ? editing
                      ? "Saving…"
                      : "Submitting…"
                    : editing
                      ? "Save changes"
                      : "Submit concern"}
                </Button>
              </ModalFooter>
            ) : !staff && manage && selected && !create && openRequest ? (
              <SidePanelFooter>
                <SidePanelButton
                  type="submit"
                  form="payroll-request-response-form"
                  disabled={busy}
                >
                  {busy ? "Saving…" : "Save response"}
                </SidePanelButton>
              </SidePanelFooter>
            ) : undefined
          }
          busy={busy}
          preventClose={hasUnsavedResponseChanges}
          onPreventClose={() => setDiscardResponseConfirm(true)}
          onClose={closeSelectedRequest}
        >
          <div
            className={
              staff && !create
                ? "grid gap-3"
                : staff && create
                  ? "grid gap-3"
                  : "grid gap-3 p-4"
            }
          >
            <PayrollRequestDetails documents={documents} />
            <PayrollRequestForm documents={documents} />
          </div>
        </PayrollRecordDetail>
      )}
    </>
  )
}
