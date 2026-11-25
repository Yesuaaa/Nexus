"use client"

import { useState } from "react"
import { Boxes, ClipboardList, FileStack, Tags } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { PageHeaderLink } from "@/components/layout/page-header-link"
import { contentClass } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterSelect, filterBarClass } from "@/components/ui/filter-select"
import { KpiCards } from "@/components/ui/kpi-cards"
import { BreakdownList, OverviewPanel } from "@/components/ui/overview-panel"
import { SearchField } from "@/components/ui/search-field"
import { Skeleton } from "@/components/ui/skeleton"
import { ProgressMeter } from "@/components/ui/stat-strip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TableSkeletonBody } from "@/components/ui/data-table-skeleton"
import {
  pageRange,
  TablePaginationFooter,
} from "@/components/ui/table-pagination-footer"
import { useAsyncResource } from "@/lib/use-async-resource"
import { cn } from "@/lib/utils"
import {
  listPricingTemplates,
  listServices,
  type PricingTemplate,
  type Service,
} from "../api/services-api"
import { pricingModelLabels } from "../model/service-pricing"

type Catalog = { services: Service[]; templates: PricingTemplate[] }
type PricingFilter = "" | "configured" | "unconfigured"
const pageSize = 10
const emptyCatalog: Catalog = { services: [], templates: [] }

async function loadCatalog(signal: AbortSignal): Promise<Catalog> {
  const [services, templates] = await Promise.all([
    listServices(signal),
    listPricingTemplates(signal),
  ])
  return { services, templates }
}

const requirements = [
  { key: "requiresConsultation", label: "Consultation", short: "Consult" },
  { key: "requiresAgreement", label: "Agreement", short: "Agree" },
  { key: "requiresPayment", label: "Payment", short: "Pay" },
  { key: "requiresQuotationApproval", label: "Quotation", short: "Quote" },
] as const
const wideOnly = "max-[640px]:hidden"

function Mark({ on }: { on: boolean }) {
  return (
    <span className={on ? "font-semibold text-[#203f8c]" : "text-[#c3cad5]"}>
      <span aria-hidden="true">{on ? "✓" : "–"}</span>
      <span className="sr-only">{on ? "Required" : "Not required"}</span>
    </span>
  )
}

export function ServiceOverviewPage() {
  const [search, setSearch] = useState("")
  const [department, setDepartment] = useState("")
  const [pricing, setPricing] = useState<PricingFilter>("")
  const [page, setPage] = useState(1)
  const catalog = useAsyncResource(loadCatalog, [], {
    fallbackError: "Couldn't load services. Please try again.",
  })
  const { services, templates } = catalog.data ?? emptyCatalog
  const loading = catalog.loading && !catalog.data
  const unavailable = Boolean(catalog.error && !catalog.data)
  const count = services.length
  const active = services.filter((service) => service.isActive).length
  const packages = services.reduce(
    (sum, service) => sum + service.packages.length,
    0,
  )
  const priced = services.filter((service) => service.pricingTemplate).length
  const usedTemplates = new Set(
    services.flatMap((service) =>
      service.pricingTemplateId ? [service.pricingTemplateId] : [],
    ),
  )
  const percent = count ? Math.round((priced / count) * 100) : 0
  const departments = Array.from(
    new Map(
      services.flatMap((service) =>
        service.departments.map((item) => [item.id, item.name] as const),
      ),
    ).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]))
  const distribution = services
    .filter((service) => service.packages.length > 0)
    .sort(
      (a, b) =>
        b.packages.length - a.packages.length ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 5)
    .map((service) => ({
      id: service.id,
      label: service.name,
      value: service.packages.length,
    }))
  const query = search.trim().toLocaleLowerCase()
  const filtered = services
    .filter(
      (service) =>
        (!query || service.name.toLocaleLowerCase().includes(query)) &&
        (!department ||
          service.departments.some((item) => item.id === department)) &&
        (!pricing ||
          (pricing === "configured"
            ? Boolean(service.pricingTemplate)
            : !service.pricingTemplate)),
    )
    .sort(
      (a, b) =>
        Number(b.isActive) - Number(a.isActive) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    )
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )
  const range = pageRange(currentPage, pageSize, filtered.length)
  const hasFilters = Boolean(search || department || pricing)
  const reset = () => {
    setSearch("")
    setDepartment("")
    setPricing("")
    setPage(1)
  }
  const metrics = [
    {
      label: "Total Services",
      value: count,
      description:
        count > active ? `${count - active} inactive` : "Services in catalog",
      icon: Boxes,
    },
    {
      label: "Service Packages",
      value: packages,
      description: "Configured packages",
      icon: Tags,
    },
    {
      label: "Priced Services",
      value: priced,
      formattedValue: `${priced} / ${count}`,
      description:
        priced < count
          ? `${count - priced} without pricing`
          : "Pricing templates configured",
      icon: ClipboardList,
    },
    {
      label: "Templates in Use",
      value: usedTemplates.size,
      formattedValue: `${usedTemplates.size} / ${templates.length}`,
      description: `${Math.max(0, templates.length - usedTemplates.size)} unused`,
      icon: FileStack,
    },
  ].map((metric) => ({
    ...metric,
    iconClassName:
      metric.label === "Priced Services" && priced < count
        ? "text-[#a45b12]"
        : "text-[#274b9d]",
  }))

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Service overview"
    >
      <PageHeader
        title="Service Overview"
        description="Monitor service readiness, pricing and requirements."
        actions={
          <PageHeaderLink href="/services">Manage services</PageHeaderLink>
        }
      />
      {catalog.error && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Alert>{catalog.error}</Alert>
          <Button variant="outline" size="sm" onClick={catalog.retry}>
            Try again
          </Button>
        </div>
      )}
      <KpiCards
        label="Service figures"
        metrics={metrics}
        pending={loading}
        unavailable={unavailable}
        showCharts={false}
        variant="compact"
        className="mt-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
      />
      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
        <OverviewPanel
          title="Service Readiness"
          description="Pricing configuration across the service catalog"
          variant="compact"
        >
          {loading ? (
            <div
              aria-label="Loading pricing configuration"
              role="status"
              className="grid gap-3"
            >
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-3 w-40" />
            </div>
          ) : unavailable ? (
            <EmptyState size="sm" title="Pricing data unavailable" />
          ) : (
            <div className="grid gap-3">
              <div>
                <p className="m-0 text-xs text-[#65718a]">
                  Pricing configuration
                </p>
                <p className="mt-1 mb-2 text-2xl font-semibold tabular-nums text-[#101d35]">
                  {percent}%
                </p>
                <ProgressMeter
                  value={priced}
                  max={Math.max(count, 1)}
                  label="Services with pricing configured"
                  colorClass="bg-[#284f9e]"
                />
                <p className="mt-2 mb-0 text-xs text-[#65718a]">
                  {priced} configured · {count - priced} remaining
                </p>
              </div>
              <p
                className={cn(
                  "m-0 border-t border-[#eceef1] pt-3 text-xs",
                  count > priced ? "text-[#a45b12]" : "text-[#65718a]",
                )}
              >
                Pricing not configured:{" "}
                <strong className="tabular-nums">{count - priced}</strong>
              </p>
            </div>
          )}
        </OverviewPanel>
        <OverviewPanel
          title="Package Distribution"
          description="Services with the most configured packages"
          variant="compact"
        >
          {unavailable ? (
            <EmptyState size="sm" title="Package data unavailable" />
          ) : (
            <BreakdownList
              rows={distribution}
              loading={loading}
              unit="packages"
              empty="No packages configured yet."
            />
          )}
        </OverviewPanel>
      </div>
      <div className="mt-4">
        <OverviewPanel
          title="Service Requirements"
          description="Review prerequisites before work begins."
          variant="compact"
        >
          <div className={filterBarClass}>
            <SearchField
              label="Search services"
              placeholder="Search services..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
            <FilterSelect
              label="Filter by department"
              value={department}
              onChange={(value) => {
                setDepartment(value)
                setPage(1)
              }}
              options={[
                { value: "", label: "All departments" },
                ...departments.map(([value, label]) => ({ value, label })),
              ]}
            />
            <FilterSelect<PricingFilter>
              label="Filter by pricing"
              value={pricing}
              onChange={(value) => {
                setPricing(value)
                setPage(1)
              }}
              options={[
                { value: "", label: "All pricing" },
                { value: "configured", label: "Pricing configured" },
                { value: "unconfigured", label: "Pricing not configured" },
              ]}
            />
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={reset}>
                Reset filters
              </Button>
            )}
          </div>
          <div className="mt-4">
            <Table
              density="compact"
              aria-label="Service requirements"
              aria-busy={loading}
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  {requirements.map((column) => (
                    <TableHead key={column.key} className="text-center">
                      <span
                        aria-hidden="true"
                        className="hidden max-[640px]:inline"
                      >
                        {column.short}
                      </span>
                      <span className="max-[640px]:sr-only">
                        {column.label}
                      </span>
                    </TableHead>
                  ))}
                  <TableHead className={cn("text-right", wideOnly)}>
                    Packages
                  </TableHead>
                  <TableHead className={wideOnly}>Pricing</TableHead>
                  <TableHead className={wideOnly}>Department</TableHead>
                </TableRow>
              </TableHeader>
              {loading ? (
                <TableSkeletonBody
                  label="service requirements"
                  columns={8}
                  rows={6}
                />
              ) : (
                <TableBody>
                  {visible.map((service) => (
                    <TableRow
                      key={service.id}
                      className={
                        service.isActive ? undefined : "text-[#8a94a6]"
                      }
                    >
                      <TableCell className="min-w-36">
                        <span
                          className={
                            service.isActive
                              ? "font-medium text-[#182235]"
                              : "font-medium"
                          }
                        >
                          {service.name}
                        </span>
                        {!service.isActive && (
                          <span className="ml-2 text-[11px] text-[#b4234d]">
                            inactive
                          </span>
                        )}
                        <span className="mt-0.5 hidden text-[11px] text-[#65718a] max-[640px]:block">
                          {service.packages.length}{" "}
                          {service.packages.length === 1
                            ? "package"
                            : "packages"}{" "}
                          ·{" "}
                          {service.pricingTemplate
                            ? pricingModelLabels[
                                service.pricingTemplate.pricingModel
                              ]
                            : "No pricing"}{" "}
                          ·{" "}
                          {service.departments.length
                            ? service.departments
                                .map((item) => item.name)
                                .join(", ")
                            : "No department"}
                        </span>
                      </TableCell>
                      {requirements.map((column) => (
                        <TableCell key={column.key} className="text-center">
                          <Mark on={Boolean(service[column.key])} />
                        </TableCell>
                      ))}
                      <TableCell
                        className={cn("text-right tabular-nums", wideOnly)}
                      >
                        {service.packages.length}
                      </TableCell>
                      <TableCell className={wideOnly}>
                        {service.pricingTemplate ? (
                          pricingModelLabels[
                            service.pricingTemplate.pricingModel
                          ]
                        ) : (
                          <span className="text-[#a45b12]">Not configured</span>
                        )}
                      </TableCell>
                      <TableCell className={wideOnly}>
                        {service.departments.length ? (
                          service.departments
                            .map((item) => item.name)
                            .join(", ")
                        ) : (
                          <span className="text-[#65718a]">None</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              )}
              {!loading && !unavailable && count > 0 && (
                <tfoot>
                  <TableRow className="text-[#65718a]">
                    <TableCell>Catalog total</TableCell>
                    {requirements.map((column) => (
                      <TableCell
                        key={column.key}
                        className="text-center tabular-nums"
                      >
                        {
                          services.filter((service) => service[column.key])
                            .length
                        }
                      </TableCell>
                    ))}
                    <TableCell
                      className={cn("text-right tabular-nums", wideOnly)}
                    >
                      {packages}
                    </TableCell>
                    <TableCell className={wideOnly}>
                      {priced} of {count} priced
                    </TableCell>
                    <TableCell className={wideOnly} />
                  </TableRow>
                </tfoot>
              )}
            </Table>
            {!loading && !visible.length && (
              <EmptyState
                size="sm"
                title={
                  unavailable
                    ? "Service data unavailable"
                    : count
                      ? "No matching services"
                      : "No services yet"
                }
                description={
                  hasFilters
                    ? "Try another search or reset the filters."
                    : undefined
                }
              />
            )}
            {!loading && !unavailable && (
              <TablePaginationFooter
                {...range}
                total={filtered.length}
                page={currentPage}
                totalPages={totalPages}
                label="Service pages"
                itemLabel="services"
                onPageChange={setPage}
                hidePaginationWhenSinglePage
              />
            )}
          </div>
        </OverviewPanel>
      </div>
    </main>
  )
}
