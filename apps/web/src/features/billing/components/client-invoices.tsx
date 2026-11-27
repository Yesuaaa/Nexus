"use client"
import { apiRequest } from "@/features/auth/api/auth-api"
import { useAsyncResource } from "@/lib/use-async-resource"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Pill } from "@/components/ui/pill"

type ClientInvoice = {
  id: string
  invoiceNumber: string
  description: string
  total: string
  collected: string
  outstanding: string
  dueDate: string
  displayStatus: string
}
export function ClientInvoices() {
  const { formatDate } = useDatePreferences()
  const invoices = useAsyncResource(
    (signal) =>
      apiRequest<ClientInvoice[]>("/api/request-workflows/billing/invoices", {
        signal,
      }),
    [],
    { fallbackError: "Could not load invoices." },
  )
  return (
    <section className="mt-6" aria-labelledby="issued-invoices-heading">
      <h2 id="issued-invoices-heading" className="mb-3 text-base font-semibold">
        Issued invoices
      </h2>
      {invoices.loading ? (
        <p role="status">Loading invoices…</p>
      ) : invoices.error ? (
        <div>
          <Alert>{invoices.error}</Alert>
          <Button variant="outline" size="sm" onClick={invoices.retry}>
            Try again
          </Button>
        </div>
      ) : !invoices.data?.length ? (
        <p>No issued invoices yet.</p>
      ) : (
        <Table aria-label="Issued invoices">
          <TableHeader>
            <TableRow>
              {[
                "Invoice",
                "Description",
                "Total",
                "Paid",
                "Outstanding",
                "Due date",
                "Status",
              ].map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.data.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell>{invoice.invoiceNumber}</TableCell>
                <TableCell>{invoice.description}</TableCell>
                <TableCell>₱{invoice.total}</TableCell>
                <TableCell>₱{invoice.collected}</TableCell>
                <TableCell>₱{invoice.outstanding}</TableCell>
                <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                <TableCell>
                  <Pill>{invoice.displayStatus.replaceAll("_", " ")}</Pill>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
