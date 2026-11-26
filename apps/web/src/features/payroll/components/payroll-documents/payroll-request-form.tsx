"use client"

import { EmptyState } from "@/components/ui/empty-state"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Form } from "@/components/ui/form"
import { FormTextarea } from "@/components/ui/form-input"
import { FilterSelect } from "@/components/ui/filter-select"
import type { PayrollDocumentsState } from "../../hooks/use-payroll-documents"
import {
  relatedPayslipTypes,
  requestTypes,
} from "../../model/payroll-documents"

/** Raises or edits a concern, or responds to one. */
export function PayrollRequestForm({
  documents,
}: {
  documents: PayrollDocumentsState
}) {
  const {
    create,
    openRequest,
    staff,
    manage,
    setBodyTouched,
    concernTypeValid,
    setError,
    concernBodyValid,
    type,
    editing,
    mutate,
    selected,
    trimmedConcernBody,
    related,
    body,
    status,
    correction,
    setType,
    setRelated,
    relatedPayslips,
    setStatus,
    transitions,
    setCorrection,
    concernBodyError,
    setBody,
    error,
    busy,
  } = documents

  return (
    <>
      {(create || (openRequest && (staff || manage))) && (
        <Form
          id={
            staff && create
              ? "payroll-concern-form"
              : manage && !create
                ? "payroll-request-response-form"
                : undefined
          }
          onSubmit={(event) => {
            event.preventDefault()
            if (create && staff) {
              setBodyTouched(true)
              if (!concernTypeValid) {
                setError("Select a concern type.")
                return
              }
              if (!concernBodyValid) return
            }
            if (create && !type) {
              setError(
                staff
                  ? "Select a concern type."
                  : "Select a payroll request type.",
              )
              return
            }
            if (create && editing)
              void mutate(
                "/requests/" + selected!.id,
                {
                  type,
                  description: trimmedConcernBody,
                  payslipId: related || null,
                },
                "PATCH",
              )
            else if (create)
              void mutate("/requests", {
                type,
                description: staff ? trimmedConcernBody : body,
                payslipId: related || undefined,
              })
            else if (staff)
              void mutate("/requests/" + selected!.id + "/messages", {
                message: body,
              })
            else
              void mutate(
                "/requests/" + selected!.id,
                {
                  status: status || undefined,
                  message: body,
                  needsFinancialCorrection: correction,
                },
                "PATCH",
              )
          }}
        >
          <div className="grid gap-3">
            {create &&
              (staff ? (
                <label className="grid gap-2 text-sm">
                  Concern type
                  <FilterSelect
                    fitOptions
                    label="Concern type"
                    value={type}
                    triggerClassName="h-11 text-sm"
                    onChange={(value) => {
                      setType(value)
                      if (!relatedPayslipTypes.has(value)) setRelated("")
                    }}
                    options={[
                      { value: "", label: "Select a concern type" },
                      ...requestTypes,
                    ]}
                  />
                </label>
              ) : (
                <FilterSelect
                  fitOptions
                  label="Request type"
                  value={type}
                  onChange={setType}
                  options={[
                    { value: "", label: "Select a request type" },
                    ...requestTypes,
                  ]}
                />
              ))}
            {create && related && !staff && (
              <p>
                This {staff ? "concern" : "request"} is linked to the selected
                payslip.
              </p>
            )}
            {create && staff && relatedPayslipTypes.has(type) && (
              <div className="grid gap-2 text-sm">
                <span>Related payslip</span>
                {relatedPayslips.loading ? (
                  <p role="status" className="text-xs text-[#65718a]">
                    Loading your published payslips…
                  </p>
                ) : relatedPayslips.error ? (
                  <div className="grid gap-2">
                    <Alert>{relatedPayslips.error}</Alert>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={relatedPayslips.retry}
                      >
                        Retry
                      </Button>
                      {related && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setRelated("")}
                        >
                          Remove linked payslip
                        </Button>
                      )}
                    </div>
                  </div>
                ) : relatedPayslips.data?.length ? (
                  <FilterSelect
                    fitOptions
                    label="Related payslip"
                    value={related}
                    triggerClassName="h-11 text-sm"
                    onChange={setRelated}
                    options={[
                      { value: "", label: "No related payslip" },
                      ...relatedPayslips.data.map((payslip) => ({
                        value: payslip.id,
                        label: `${payslip.period.cutoffLabel} — ${payslip.reference}`,
                      })),
                    ]}
                  />
                ) : (
                  <EmptyState
                    title="No published payslips"
                    description="You can still submit this concern without linking a payslip."
                    size="sm"
                    role="status"
                  />
                )}
              </div>
            )}
            {create && type === "MISSING_SALARY_PAYMENT" && (
              <p>
                Tell Payroll which pay period is missing and what you expected
                to receive.
              </p>
            )}
            {manage && openRequest && (
              <FilterSelect
                fitOptions
                label="Update status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "", label: "Keep current status" },
                  ...transitions,
                ]}
              />
            )}
            {manage &&
              selected &&
              ["PAYSLIP_CORRECTION", "PAYROLL_DISCREPANCY"].includes(
                selected.type,
              ) && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={correction ?? selected.needsFinancialCorrection}
                    onChange={(event) => setCorrection(event.target.checked)}
                  />
                  Flag for future financial correction
                </label>
              )}
            <label className="grid gap-2 text-sm">
              {create
                ? staff
                  ? "Describe your concern"
                  : "Description"
                : "Response or resolution notes"}
              <FormTextarea
                required
                aria-invalid={staff && create && Boolean(concernBodyError)}
                aria-describedby={
                  staff && create && concernBodyError
                    ? "concern-description-error"
                    : undefined
                }
                value={body}
                onChange={(event) => setBody(event.target.value)}
                onBlur={() => {
                  if (staff && create) setBodyTouched(true)
                }}
              />
              {staff && create && concernBodyError && (
                <span
                  id="concern-description-error"
                  role="alert"
                  className="text-[11px] leading-5 text-[#bc3649]"
                >
                  {concernBodyError}
                </span>
              )}
            </label>
            {error && <Alert>{error}</Alert>}
            {!(staff && create) && !(manage && !create) && (
              <div>
                <Button type="submit" disabled={busy}>
                  {busy
                    ? "Saving…"
                    : create
                      ? "Submit request"
                      : "Save response"}
                </Button>
              </div>
            )}
          </div>
        </Form>
      )}
    </>
  )
}
