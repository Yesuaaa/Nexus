"use client"

import { PageHeader } from "@/components/layout/page-header"
import { PageHeaderLink } from "@/components/layout/page-header-link"
import { contentClass } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import {
  cellClass,
  FiguresRow,
  headCellClass,
  InlineBar,
  RowsSkeleton,
  Section,
  tableClass,
} from "@/components/ui/overview-panel"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { useAsyncResource } from "@/lib/use-async-resource"
import { cn } from "@/lib/utils"
import {
  listPricingTemplates,
  listServices,
  type PricingModel,
  type PricingTemplate,
  type Service,
} from "../api/services-api"
import { pricingModelLabels } from "../model/service-pricing"

type Catalog = { services: Service[]; templates: PricingTemplate[] }

const emptyCatalog: Catalog = { services: [], templates: [] }

async function loadCatalog(signal: AbortSignal): Promise<Catalog> {
  const [services, templates] = await Promise.all([
    listServices(signal),
    listPricingTemplates(signal),
  ])
  return { services, templates }
}

const requirementColumns = [
  { key: "requiresConsultation", label: "Consultation", short: "Consult" },
  { key: "requiresAgreement", label: "Agreement", short: "Agree" },
  { key: "requiresPayment", label: "Payment", short: "Pay" },
  { key: "requiresQuotationApproval", label: "Quotation", short: "Quote" },
] as const

/** Columns that phones drop; their values move under the service name. */
const wideOnly = "max-[640px]:hidden"

const pricingModels = Object.keys(pricingModelLabels) as PricingModel[]

function Mark({ on }: { on: boolean }) {
  return on ? (
    <span className="font-semibold text-[#203f8c]">
      <span aria-hidden="true">✓</span>
      <span className="sr-only">Required</span>
    </span>
  ) : (
    <span className="text-[#c3cad5]">
      <span aria-hidden="true">–</span>
      <span className="sr-only">Not required</span>
    </span>
  )
}

export function ServiceOverviewPage() {
  const { formatDate } = useDatePreferences()
  const catalog = useAsyncResource(loadCatalog, [], {
    fallbackError: "Couldn't load services. Please try again.",
  })
  const { services, templates } = catalog.data ?? emptyCatalog
  const loading = catalog.loading && !catalog.data
  const count = services.length
  const active = services.filter((s) => s.isActive).length
  const packages = services.reduce((sum, s) => sum + s.packages.length, 0)
  const priced = services.filter((s) => s.pricingTemplate).length
  const usedTemplates = new Set(
    services.flatMap((s) => (s.pricingTemplateId ? [s.pricingTemplateId] : [])),
  )
  const sorted = [...services].sort(
    (a, b) =>
      Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name),
  )
  const pricing = [
    ...pricingModels.map((model) => ({
      id: model,
      label: pricingModelLabels[model],
      value: services.filter((s) => s.pricingTemplate?.pricingModel === model)
        .length,
    })),
    { id: "none", label: "No pricing template", value: count - priced },
  ].filter((row) => row.value > 0)
  const recent = [...services]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6)

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Service overview"
    >
      <PageHeader
        title="Service Overview"
        description="What each service requires, how it is priced, and what changed recently."
        actions={
          <PageHeaderLink href="/services">Manage services</PageHeaderLink>
        }
      />
      {catalog.error && !count && (
        <Alert className="mt-[18px]">
          {catalog.error}{" "}
          <button
            type="button"
            className="cursor-pointer font-semibold underline"
            onClick={catalog.retry}
          >
            Try again
          </button>
        </Alert>
      )}
      <FiguresRow
        label="Service figures"
        loading={loading}
        items={[
          {
            label: "Services",
            value: String(count),
            note: count > active ? `${count - active} inactive` : undefined,
          },
          { label: "Packages", value: String(packages) },
          {
            label: "Priced",
            value: `${priced}/${count}`,
            tone: priced < count ? "warning" : undefined,
          },
          {
            label: "Templates in use",
            value: `${usedTemplates.size}/${templates.length}`,
            note:
              templates.length > usedTemplates.size
                ? `${templates.length - usedTemplates.size} unused`
                : undefined,
          },
        ]}
      />

      <Section title="Requirements" aside="Before work starts" className="mt-7">
        {loading ? (
          <RowsSkeleton rows={6} />
        ) : count ? (
          <div className="overflow-x-auto">
            <table className={cn(tableClass, "sm:min-w-[720px]")}>
              <thead>
                <tr>
                  <th className={headCellClass}>Service</th>
                  {requirementColumns.map((column) => (
                    <th
                      key={column.key}
                      className={cn(
                        headCellClass,
                        "px-2 text-center max-[640px]:px-1",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="hidden max-[640px]:inline"
                      >
                        {column.short}
                      </span>
                      <span className="max-[640px]:sr-only">
                        {column.label}
                      </span>
                    </th>
                  ))}
                  <th
                    className={cn(headCellClass, "px-2 text-right", wideOnly)}
                  >
                    Packages
                  </th>
                  <th className={cn(headCellClass, "pl-5", wideOnly)}>
                    Pricing
                  </th>
                  <th className={cn(headCellClass, "pl-5", wideOnly)}>
                    Department
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((service) => (
                  <tr
                    key={service.id}
                    className={service.isActive ? undefined : "text-[#8a94a6]"}
                  >
                    <td className={cn(cellClass, "pr-3")}>
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
                      <span className="mt-0.5 hidden text-[11px] text-[#8a94a6] max-[640px]:block">
                        {service.packages.length}{" "}
                        {service.packages.length === 1 ? "package" : "packages"}
                        {" · "}
                        {service.pricingTemplate
                          ? pricingModelLabels[
                              service.pricingTemplate.pricingModel
                            ]
                          : "No pricing"}
                        {" · "}
                        {service.departments.length
                          ? service.departments.map((d) => d.name).join(", ")
                          : "No department"}
                      </span>
                    </td>
                    {requirementColumns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          cellClass,
                          "px-2 text-center max-[640px]:px-1",
                        )}
                      >
                        <Mark on={Boolean(service[column.key])} />
                      </td>
                    ))}
                    <td
                      className={cn(
                        cellClass,
                        "px-2 text-right tabular-nums",
                        wideOnly,
                        service.packages.length === 0 && "text-[#a45b12]",
                      )}
                    >
                      {service.packages.length}
                    </td>
                    <td
                      className={cn(
                        cellClass,
                        "pl-5 whitespace-nowrap",
                        wideOnly,
                      )}
                    >
                      {service.pricingTemplate ? (
                        pricingModelLabels[service.pricingTemplate.pricingModel]
                      ) : (
                        <span className="text-[#a45b12]">None</span>
                      )}
                    </td>
                    <td className={cn(cellClass, "pl-5", wideOnly)}>
                      {service.departments.length ? (
                        service.departments.map((d) => d.name).join(", ")
                      ) : (
                        <span className="text-[#a45b12]">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-[11px] text-[#738096]">
                  <td className="pt-2.5">Total</td>
                  {requirementColumns.map((column) => (
                    <td
                      key={column.key}
                      className="px-2 pt-2.5 text-center tabular-nums max-[640px]:px-1"
                    >
                      {services.filter((s) => s[column.key]).length}
                    </td>
                  ))}
                  <td
                    className={cn(
                      "px-2 pt-2.5 text-right tabular-nums",
                      wideOnly,
                    )}
                  >
                    {packages}
                  </td>
                  <td className={cn("pt-2.5 pl-5", wideOnly)}>
                    {priced} of {count} priced
                  </td>
                  <td className={cn("pt-2.5 pl-5", wideOnly)} />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="m-0 py-6 text-xs text-[#8a94a6]">No services yet.</p>
        )}
      </Section>

      <div className="mt-9 grid gap-x-12 gap-y-9 lg:grid-cols-2">
        <Section title="Pricing">
          {loading ? (
            <RowsSkeleton />
          ) : pricing.length ? (
            <table className={tableClass}>
              <tbody>
                {pricing.map((row) => {
                  const pct =
                    count > 0 ? Math.round((row.value / count) * 100) : 0
                  return (
                    <tr key={row.id}>
                      <td
                        className={cn(
                          cellClass,
                          "w-[42%] pr-3",
                          row.id === "none"
                            ? "text-[#a45b12]"
                            : "text-[#182235]",
                        )}
                      >
                        {row.label}
                      </td>
                      <td
                        className={cn(
                          cellClass,
                          "w-10 text-right font-medium text-[#182235] tabular-nums",
                        )}
                      >
                        {row.value}
                      </td>
                      <td className={cn(cellClass, "pl-4")}>
                        <span className="flex items-center gap-3">
                          <InlineBar
                            value={row.value}
                            max={count}
                            label={`${row.label}: ${pct}% of services`}
                            className="min-w-12 flex-1"
                          />
                          <span className="w-8 text-right text-[#8a94a6] tabular-nums">
                            {pct}%
                          </span>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <p className="m-0 py-6 text-xs text-[#8a94a6]">No services yet.</p>
          )}
        </Section>

        <Section title="Recently updated">
          {loading ? (
            <RowsSkeleton />
          ) : recent.length ? (
            <ul className="m-0 list-none p-0 text-xs">
              {recent.map((service) => (
                <li
                  key={service.id}
                  className="flex items-baseline justify-between gap-4 border-b border-[#f0f2f5] py-2.5"
                >
                  <span className="min-w-0 truncate text-[#182235]">
                    {service.name}
                  </span>
                  <span className="shrink-0 text-[#8a94a6] tabular-nums">
                    {formatDate(service.updatedAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 py-6 text-xs text-[#8a94a6]">No services yet.</p>
          )}
        </Section>
      </div>
    </main>
  )
}
