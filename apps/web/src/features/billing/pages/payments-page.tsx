"use client"
import { useState } from "react"
import { apiRequest } from "@/features/auth/api/auth-api"
import { useAsyncResource } from "@/lib/use-async-resource"
import { SearchField } from "@/components/ui/search-field"
import { useTableSearchQuery } from "@/components/ui/use-table-search-query"
import { FilterSelect } from "@/components/ui/filter-select"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"
import { EmptyState } from "@/components/ui/empty-state"
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
import {
  SidePanel,
  SidePanelBody,
  SidePanelHeader,
  useSidePanel,
} from "@/components/ui/side-panel"

type Collection = {
  id: string
  source: "COMMENCEMENT" | "INVOICE"
  clientName: string
  amount: string
  invoiceNumber: string | null
  allocation: string
  paidAt: string | null
  reference: string | null
  status: string
  sandbox: boolean
}
type CollectionPage = { rows: Collection[]; total: number; pageSize: number }
function PaymentDetails({
  payment,
  onClose,
}: {
  payment: Collection
  onClose: () => void
}) {
  const panel = useSidePanel(onClose)
  const fields = [
    ["Client", payment.clientName],
    ["Amount", `₱${payment.amount}`],
    [
      "Source",
      payment.source === "COMMENCEMENT"
        ? "Commencement payment"
        : "Invoice payment",
    ],
    ["Invoice", payment.invoiceNumber ?? "Unallocated"],
    ["Date", payment.paidAt?.slice(0, 10) ?? "Not available"],
    ["Reference", payment.reference ?? "None"],
    ["Status", payment.sandbox ? "Test payment" : payment.status],
  ]
  return (
    <SidePanel open={panel.open} onOpenChange={panel.onOpenChange}>
      <SidePanelHeader
        title="Payment details"
        description="Collection and allocation information"
      />
      <SidePanelBody>
        <dl className="grid gap-3">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="m-0 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </SidePanelBody>
    </SidePanel>
  )
}
export function PaymentsPage() {
  const [search, setSearch] = useState("")
  const [source, setSource] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Collection | null>(null)
  const { query } = useTableSearchQuery(search)
  const result = useAsyncResource(
    (signal) =>
      apiRequest<CollectionPage>(
        `/api/billing/payments?${new URLSearchParams({ page: String(page), search: query, source })}`,
        { signal },
      ),
    [page, query, source],
    { fallbackError: "Couldn't load payments." },
  )
  const data = result.data
  const grid =
    "grid grid-cols-[1.2fr_1fr_1.2fr_1fr_1fr_1fr_1fr_auto] items-center gap-3 max-[850px]:grid-cols-2"
  const columns = [
    "Client",
    "Amount",
    "Source",
    "Invoice",
    "Allocation",
    "Date",
    "Status",
    "Actions",
  ]
  return (
    <section className="mt-5">
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchField
          label="Search payments"
          placeholder="Search payments"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
        <FilterSelect
          label="Payment source"
          value={source}
          options={[
            { value: "", label: "All sources" },
            { value: "COMMENCEMENT", label: "Commencement" },
            { value: "INVOICE", label: "Invoice payment" },
          ]}
          onChange={(value) => {
            setSource(value)
            setPage(1)
          }}
        />
      </div>
      <ResponsiveDataTable label="Payments" aria-busy={result.loading}>
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
                <p role="status">Loading payments…</p>
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
              title="No payments found"
              description="Payments will appear here when they are recorded."
            />
          ) : (
            data.rows.map((row) => (
              <ResponsiveDataTableRow
                key={`${row.source}-${row.id}`}
                variant="directory"
                className={grid}
              >
                <ResponsiveDataTableCell>
                  {row.clientName}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>₱{row.amount}</ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  {row.source === "COMMENCEMENT"
                    ? "Commencement"
                    : "Invoice payment"}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  {row.invoiceNumber ?? "None"}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  {row.allocation === "ALLOCATED" ? "Allocated" : "Unallocated"}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  {row.paidAt?.slice(0, 10) ?? "Not available"}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  <Pill>{row.sandbox ? "Test payment" : row.status}</Pill>
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelected(row)}
                  >
                    View payment
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
          label="Payment pages"
          onPageChange={setPage}
          disabled={result.loading}
        />
      )}
      {selected && (
        <PaymentDetails payment={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  )
}
