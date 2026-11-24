"use client"
import { useState, type FormEvent } from "react"
import Link from "next/link"
import { apiRequest } from "@/features/auth/api/auth-api"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { useAsyncResource } from "@/lib/use-async-resource"
import { errorMessage } from "@/lib/error-message"
import {
  SidePanel,
  SidePanelHeader,
  SidePanelBody,
  SidePanelFooter,
  useSidePanel,
} from "@/components/ui/side-panel"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { FormInput, FormTextarea } from "@/components/ui/form-input"
import { MoneyInput } from "@/components/ui/money-input"
import { DateInput } from "@/components/ui/date-input"
import { SearchField } from "@/components/ui/search-field"
import { useTableSearchQuery } from "@/components/ui/use-table-search-query"
import { EmptyState } from "@/components/ui/empty-state"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
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

type Expense = {
  id: string
  description: string
  category: string
  amount: string
  expenseDate: string
  vendor: string | null
  reference: string | null
  note: string | null
  version: number
  createdBy: { fullName: string | null; email: string }
}
type ExpensePage = { rows: Expense[]; total: number; pageSize: number }
function ExpenseForm({
  expense,
  onClose,
  onSaved,
}: {
  expense?: Expense
  onClose: () => void
  onSaved: () => void
}) {
  const panel = useSidePanel(onClose)
  const [description, setDescription] = useState(expense?.description ?? "")
  const [category, setCategory] = useState(expense?.category ?? "")
  const [value, setValue] = useState(expense?.amount ?? "")
  const [date, setDate] = useState(expense?.expenseDate.slice(0, 10) ?? "")
  const [vendor, setVendor] = useState(expense?.vendor ?? "")
  const [reference, setReference] = useState(expense?.reference ?? "")
  const [note, setNote] = useState(expense?.note ?? "")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      await apiRequest(
        expense
          ? `/api/billing/expenses/${encodeURIComponent(expense.id)}`
          : "/api/billing/expenses",
        {
          method: expense ? "PATCH" : "POST",
          body: JSON.stringify({
            description,
            category,
            amount: value,
            expenseDate: date,
            vendor,
            reference,
            note,
            ...(expense ? { version: expense.version } : {}),
          }),
        },
      )
      onSaved()
      panel.close()
    } catch (reason) {
      setError(errorMessage(reason, "Could not save expense."))
    } finally {
      setPending(false)
    }
  }
  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      busy={pending}
    >
      <SidePanelHeader
        title={expense ? "Edit expense" : "Record expense"}
        description="Record an operational expense."
      />
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
        <SidePanelBody>
          <label htmlFor="expense-description">Description</label>
          <FormInput
            id="expense-description"
            required
            maxLength={1000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <label htmlFor="expense-category">Category</label>
          <FormInput
            id="expense-category"
            required
            maxLength={100}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          />
          <label htmlFor="expense-amount">Amount (PHP)</label>
          <MoneyInput
            id="expense-amount"
            value={value}
            onValueChange={setValue}
            requirePositive
          />
          <label htmlFor="expense-date">Expense date</label>
          <DateInput
            id="expense-date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <label htmlFor="expense-vendor">Vendor (optional)</label>
          <FormInput
            id="expense-vendor"
            maxLength={300}
            value={vendor}
            onChange={(event) => setVendor(event.target.value)}
          />
          <label htmlFor="expense-reference">Reference (optional)</label>
          <FormInput
            id="expense-reference"
            maxLength={300}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
          <label htmlFor="expense-note">Note (optional)</label>
          <FormTextarea
            id="expense-note"
            maxLength={2000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          {error && <Alert>{error}</Alert>}
        </SidePanelBody>
        <SidePanelFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => panel.close()}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" variant="brand" disabled={pending}>
            {pending ? "Saving…" : "Save expense"}
          </Button>
        </SidePanelFooter>
      </form>
    </SidePanel>
  )
}
export function ExpensesPage() {
  const account = usePortalAccount()
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Expense | "new" | null>(null)
  const [deleting, setDeleting] = useState<Expense | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const { query } = useTableSearchQuery(search)
  const result = useAsyncResource(
    (signal) =>
      apiRequest<ExpensePage>(
        `/api/billing/expenses?${new URLSearchParams({ page: String(page), search: query, category, from, to })}`,
        { signal },
      ),
    [page, query, category, from, to],
    { fallbackError: "Could not load expenses." },
  )
  async function remove() {
    if (!deleting) return
    setPending(true)
    setError("")
    try {
      await apiRequest(
        `/api/billing/expenses/${encodeURIComponent(deleting.id)}`,
        { method: "DELETE" },
      )
      setDeleting(null)
      result.retry()
    } catch (reason) {
      setError(errorMessage(reason, "Could not delete expense."))
    } finally {
      setPending(false)
    }
  }
  const grid =
    "grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-center gap-3 max-[850px]:grid-cols-2"
  return (
    <section className="mt-5">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/billing-finance/reports/expense-summary">
            View expense summary
          </Link>
        </Button>
        {account.role === "ADMIN" && (
          <Button variant="brand" onClick={() => setEditing("new")}>
            Record expense
          </Button>
        )}
        <SearchField
          label="Search expenses"
          placeholder="Search expenses"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
        <div>
          <label htmlFor="expense-filter-category">Category</label>
          <FormInput
            id="expense-filter-category"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value)
              setPage(1)
            }}
          />
        </div>
        <div>
          <label htmlFor="expense-filter-from">From</label>
          <DateInput
            id="expense-filter-from"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value)
              setPage(1)
            }}
          />
        </div>
        <div>
          <label htmlFor="expense-filter-to">To</label>
          <DateInput
            id="expense-filter-to"
            value={to}
            onChange={(event) => {
              setTo(event.target.value)
              setPage(1)
            }}
          />
        </div>
      </div>
      <ResponsiveDataTable label="Expenses" aria-busy={result.loading}>
        <ResponsiveDataTableHeader rowClassName={`${grid} max-[850px]:hidden`}>
          {[
            "Description",
            "Category",
            "Amount",
            "Date",
            "Created by",
            "Actions",
          ].map((label) => (
            <ResponsiveDataTableColumnHeader key={label}>
              {label}
            </ResponsiveDataTableColumnHeader>
          ))}
        </ResponsiveDataTableHeader>
        <ResponsiveDataTableBody>
          {result.loading ? (
            <ResponsiveDataTableRow>
              <ResponsiveDataTableCell>
                <p role="status">Loading expenses…</p>
              </ResponsiveDataTableCell>
            </ResponsiveDataTableRow>
          ) : result.error ? (
            <DataTableErrorRow
              message={result.error}
              onRetry={result.retry}
              colSpan={6}
            />
          ) : !result.data?.rows.length ? (
            <EmptyState
              title="No expenses found"
              description="Recorded expenses will appear here."
            />
          ) : (
            result.data.rows.map((expense) => (
              <ResponsiveDataTableRow
                key={expense.id}
                variant="directory"
                className={grid}
              >
                <ResponsiveDataTableCell>
                  {expense.description}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  {expense.category}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  ₱{expense.amount}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  {expense.expenseDate.slice(0, 10)}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  {expense.createdBy.fullName || expense.createdBy.email}
                </ResponsiveDataTableCell>
                <ResponsiveDataTableCell>
                  {account.role === "ADMIN" && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(expense)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeleting(expense)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </ResponsiveDataTableCell>
              </ResponsiveDataTableRow>
            ))
          )}
        </ResponsiveDataTableBody>
      </ResponsiveDataTable>
      {result.data && !result.error && (
        <TablePaginationFooter
          {...pageRange(page, result.data.pageSize, result.data.total)}
          total={result.data.total}
          page={page}
          totalPages={Math.ceil(result.data.total / result.data.pageSize)}
          label="Expense pages"
          onPageChange={setPage}
          disabled={result.loading}
        />
      )}
      {editing && (
        <ExpenseForm
          expense={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={result.retry}
        />
      )}
      {deleting && (
        <ConfirmationDialog
          title="Delete expense?"
          subject={deleting.description}
          description="This permanently removes the expense record."
          confirmLabel="Delete expense"
          pendingLabel="Deleting…"
          pending={pending}
          error={error}
          onClose={() => {
            setDeleting(null)
            setError("")
          }}
          onConfirm={() => void remove()}
        />
      )}
    </section>
  )
}
