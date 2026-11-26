"use client"

import { useState } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchField } from "@/components/ui/search-field"
import { useTableSearchQuery } from "@/components/ui/use-table-search-query"
import {
  DataTableErrorRow,
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
  ResponsiveDataTableRow,
} from "@/components/ui/responsive-data-table"
import {
  TablePaginationFooter,
  pageRange,
} from "@/components/ui/table-pagination-footer"
import { Pill } from "@/components/ui/pill"
import { apiRequest } from "@/features/auth/api/auth-api"
import { useAsyncResource } from "@/lib/use-async-resource"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { Button } from "@/components/ui/button"
import { FilterSelect } from "@/components/ui/filter-select"
import { InvoicePanel, type BillingInvoice } from "../components/invoice-panel"
import { InvoiceDraftPanel } from "../components/invoice-draft-panel"
import { PaymentsPage } from "./payments-page"
import { BillingOverview } from "./billing-overview"
import { ExpensesPage } from "./expenses-page"
import { BillingReport } from "./billing-report"
import { BillingSettings } from "./billing-settings"

type InvoiceList = {
  rows: BillingInvoice[]
  total: number
  page: number
  pageSize: number
}

function Invoices() {
  const account = usePortalAccount()
  const [selected, setSelected] = useState<BillingInvoice | null>(null)
  const [draft, setDraft] = useState<BillingInvoice | "new" | null>(null)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState("")
  const { query } = useTableSearchQuery(search)
  const result = useAsyncResource(
    (signal) =>
      apiRequest<InvoiceList>(
        `/api/billing/invoices?${new URLSearchParams({ page: String(page), search: query, status })}`,
        { signal },
      ),
    [page, query, status],
    { fallbackError: "Couldn't load invoices." },
  )
  const data = result.data
  const columns = [
    "Invoice #",
    "Client",
    "Service",
    "Due Date",
    "Total",
    "Outstanding",
    "Status",
    "Actions",
  ]
  const grid =
    "grid grid-cols-[1.1fr_1.2fr_1.2fr_1fr_1fr_1fr_1fr_auto] items-center gap-3 max-[850px]:grid-cols-2"
  return (
    <section className="mt-5">
      <div className="mb-4">
        {account.role === "ADMIN" && (
          <Button variant="brand" onClick={() => setDraft("new")}>
            Create invoice
          </Button>
        )}
        <SearchField
          label="Search invoices"
          placeholder="Search invoices"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
        <FilterSelect
          label="Invoice status"
          value={status}
          options={[
            { value: "", label: "All statuses" },
            { value: "DRAFT", label: "Draft" },
            { value: "ISSUED", label: "Issued (all payment states)" },
            { value: "CANCELLED", label: "Cancelled" },
          ]}
          onChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
        />
      </div>
      <ResponsiveDataTable label="Invoices" aria-busy={result.loading}>
        <ResponsiveDataTableHeader rowClassName={`${grid} max-[850px]:hidden`}>
          {columns.map((column) => (
            <ResponsiveDataTableColumnHeader key={column}>
              {column}
            </ResponsiveDataTableColumnHeader>
          ))}
        </ResponsiveDataTableHeader>
        <ResponsiveDataTableBody>
          {result.loading ? (
            <ResponsiveDataTableRow>
              <ResponsiveDataTableCell>
                <p role="status">Loading invoices…</p>
              </ResponsiveDataTableCell>
            </ResponsiveDataTableRow>
          ) : result.error ? (
            <DataTableErrorRow
              message={result.error}
              onRetry={result.retry}
              colSpan={8}
            />
          ) : !data?.rows.length ? (
            <EmptyState
              title="No invoices found"
              description={
                query
                  ? "Try a different search."
                  : "Invoices will appear here when they are created."
              }
            />
          ) : (
            data.rows.map((invoice) => (
              <ResponsiveDataTableRow
                key={invoice.id}
                variant="directory"
                className={grid}
              >
                <ResponsiveDataTableCell>
                  {invoice.invoiceNumber}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  {invoice.client.fullName || invoice.client.email}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  {invoice.request.title}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  {new Date(invoice.dueDate).toLocaleDateString("en-PH", {
                    timeZone: "UTC",
                  })}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  ₱{invoice.total}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  ₱{invoice.outstanding}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  <Pill>{invoice.displayStatus.replaceAll("_", " ")}</Pill>
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelected(invoice)}
                  >
                    View invoice
                  </Button>
                </ResponsiveDataTableCell>
              </ResponsiveDataTableRow>
            ))
          )}
        </ResponsiveDataTableBody>
      </ResponsiveDataTable>
      {data && !result.error && (
        <TablePaginationFooter
          {...pageRange(page, data.pageSize, data.total)}
          total={data.total}
          page={page}
          totalPages={Math.ceil(data.total / data.pageSize)}
          label="Invoice pages"
          onPageChange={setPage}
          disabled={result.loading}
        />
      )}
      {selected && (
        <InvoicePanel
          invoice={selected}
          canManage={account.role === "ADMIN"}
          onClose={() => setSelected(null)}
          onChanged={result.retry}
          onEdit={setDraft}
        />
      )}
      {draft && (
        <InvoiceDraftPanel
          invoice={draft === "new" ? undefined : draft}
          onClose={() => setDraft(null)}
          onSaved={result.retry}
        />
      )}
    </section>
  )
}
export function BillingPage({
  title,
  description,
  invoices,
}: {
  title: string
  description: string
  invoices: boolean
}) {
  return (
    <main className={`${contentClass} p-[clamp(16px,2.1vw,32px)]`}>
      <PageHeader title={title} description={description} />
      {invoices ? (
        <Invoices />
      ) : title === "Overview" ? (
        <BillingOverview />
      ) : title === "Payments" ? (
        <PaymentsPage />
      ) : title === "Expenses" ? (
        <ExpensesPage />
      ) : ["Revenue", "Collections", "Receivables", "Expense Summary"].includes(
          title,
        ) ? (
        <BillingReport title={title} />
      ) : [
          "Billing Configuration",
          "Payment Methods",
          "Invoice Numbering",
        ].includes(title) ? (
        <BillingSettings title={title} />
      ) : (
        <div className="mt-5">
          <EmptyState
            title={title}
            description={`The ${title.toLowerCase()} workspace is being prepared.`}
          />
        </div>
      )}
    </main>
  )
}
