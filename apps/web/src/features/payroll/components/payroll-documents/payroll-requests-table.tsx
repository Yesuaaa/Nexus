"use client"

import { Eye, Pencil, Trash2 } from "lucide-react"
import {
  ResponsiveDataTableCell,
  ResponsiveDataTableRow,
} from "@/components/ui/responsive-data-table"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  FilterSelect,
  filterBarClass,
  filterGridClass,
} from "@/components/ui/filter-select"
import { Pill } from "@/components/ui/pill"
import { SearchField } from "@/components/ui/search-field"
import { TableSearchStatus } from "@/components/ui/table-search-status"
import {
  RowActionLabel,
  RowActionsMenu,
} from "@/components/ui/row-actions-menu"
import { TableCell, TableRow } from "@/components/ui/table"
import { humanizeEnum } from "@/lib/format"
import type { PayrollDocumentsState } from "../../hooks/use-payroll-documents"
import { PayrollPageSection, RecordTable, Pages } from "./record-layout"
import {
  requestFilterTriggerClass,
  requestStatuses,
  requestTypes,
  staffRequestGrid,
  staffTableRow,
  timestamp,
} from "../../model/payroll-documents"
import { PayrollHistorySwitcher } from "./payroll-history-switcher"

/** Payroll requests, shown to Staff as their own concerns. */
export function PayrollRequestsTable({
  documents,
}: {
  documents: PayrollDocumentsState
}) {
  const {
    staff,
    requestSearch,
    setRequestSearch,
    setRequestPage,
    requestStatus,
    setRequestStatus,
    requestType,
    setRequestType,
    requestSearchPending,
    requests,
    requestQuery,
    concernFiltersActive,
    resetForm,
    setCreate,
    setSelected,
    startEdit,
    setWithdrawalError,
    setWithdrawal,
  } = documents
  const RecordRow = staff ? ResponsiveDataTableRow : TableRow
  const RecordCell = staff ? ResponsiveDataTableCell : TableCell
  return (
    <PayrollPageSection
      title={staff ? "Payroll Concerns" : "Payroll requests"}
      staff={staff}
    >
      <div className={staff ? "grid min-w-0 gap-2" : "min-w-0"}>
        <div className={staff ? filterBarClass : `${filterGridClass} pb-4`}>
          {staff && (
            <SearchField
              label="Search payroll concerns"
              placeholder="Search concerns…"
              value={requestSearch}
              maxLength={100}
              onChange={(event) => {
                setRequestSearch(event.target.value)
                setRequestPage(1)
              }}
            />
          )}
          <FilterSelect
            fitOptions
            label={staff ? "Concern status" : "Request status"}
            triggerClassName={requestFilterTriggerClass}
            value={requestStatus}
            onChange={(value) => {
              setRequestStatus(value)
              setRequestPage(1)
            }}
            options={[{ value: "", label: "All statuses" }, ...requestStatuses]}
          />
          <FilterSelect
            fitOptions
            label={staff ? "Concern type" : "Request type"}
            triggerClassName={requestFilterTriggerClass}
            value={requestType}
            onChange={(value) => {
              setRequestType(value)
              setRequestPage(1)
            }}
            options={[{ value: "", label: "All types" }, ...requestTypes]}
          />
          <PayrollHistorySwitcher documents={documents} />
        </div>
        {staff && (
          <TableSearchStatus
            active={
              requestSearchPending ||
              (requests.loading && Boolean(requestQuery))
            }
            label="payroll concerns"
          />
        )}
        {!staff && requests.error && (
          <Alert className="mb-3">{requests.error}</Alert>
        )}
        <RecordTable
          headings={[
            ...(!staff ? ["Employee"] : []),
            staff ? "Concern type" : "Type",
            "Status",
            staff ? "Date created" : "Created",
            "Actions",
          ]}
          alignments={{ Actions: "center" }}
          responsive={
            staff
              ? {
                  label: "Payroll concerns",
                  grid: staffRequestGrid,
                  emptyMessage: concernFiltersActive
                    ? "No concerns match your search or filters."
                    : "No payroll concerns.",
                  error: requests.error,
                  retry: requests.retry,
                }
              : undefined
          }
          emptyMessage={
            concernFiltersActive
              ? "No concerns match your search or filters."
              : "No payroll concerns."
          }
          loading={requests.loading || requestSearchPending}
          empty={!requests.error && !requests.data?.rows.length}
        >
          {requests.data?.rows.map((row) => (
            <RecordRow
              key={row.id}
              className={
                staff ? staffRequestGrid + " " + staffTableRow : undefined
              }
            >
              {!staff && <RecordCell>{row.employee.fullName}</RecordCell>}
              <RecordCell>
                {staff && (
                  <span className="mr-1.5 hidden text-[#738096] @max-[900px]:inline">
                    Concern type
                  </span>
                )}
                {humanizeEnum(row.type)}
              </RecordCell>
              <RecordCell>
                {staff && (
                  <span className="mr-1.5 hidden text-[#738096] @max-[900px]:inline">
                    Status
                  </span>
                )}
                <Pill tone="neutral">{humanizeEnum(row.status)}</Pill>
              </RecordCell>
              <RecordCell>
                {staff && (
                  <span className="mr-1.5 hidden text-[#738096] @max-[900px]:inline">
                    Date created
                  </span>
                )}
                {timestamp(row.createdAt)}
              </RecordCell>
              <RecordCell
                className={
                  staff ? "flex flex-wrap items-center gap-2" : "text-center"
                }
              >
                {staff ? (
                  <>
                    <span className="mr-1.5 hidden text-[#738096] @max-[900px]:inline">
                      Actions
                    </span>
                    <RowActionsMenu
                      triggerLabel={`Actions for payroll concern ${row.id}`}
                      menuLabel={`Payroll concern actions for ${row.id}`}
                      items={[
                        {
                          action: "view",
                          label: (
                            <RowActionLabel icon={Eye}>
                              View concern
                            </RowActionLabel>
                          ),
                        },
                        ...(row.status === "OPEN"
                          ? [
                              {
                                action: "edit" as const,
                                label: (
                                  <RowActionLabel icon={Pencil}>
                                    Edit concern
                                  </RowActionLabel>
                                ),
                              },
                              {
                                action: "delete" as const,
                                label: (
                                  <RowActionLabel icon={Trash2}>
                                    Delete concern
                                  </RowActionLabel>
                                ),
                                className:
                                  "text-destructive focus:text-destructive",
                              },
                            ]
                          : []),
                      ]}
                      onAction={(action) => {
                        if (action === "view") {
                          resetForm()
                          setCreate(false)
                          setSelected(row)
                        } else if (action === "edit") {
                          startEdit(row)
                        } else {
                          setWithdrawalError("")
                          setWithdrawal(row)
                        }
                      }}
                    />
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      resetForm()
                      setCreate(false)
                      setSelected(row)
                    }}
                  >
                    View request
                  </Button>
                )}
              </RecordCell>
            </RecordRow>
          ))}
        </RecordTable>
        <Pages
          result={
            requests.loading ||
            requestSearchPending ||
            requests.error ||
            (staff && !requests.data?.total)
              ? null
              : requests.data
          }
          label={staff ? "Payroll concern pages" : "Payroll request pages"}
          onPageChange={setRequestPage}
        />
      </div>
    </PayrollPageSection>
  )
}
