"use client"

import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  BreakdownList,
  ItemList,
  MiniStats,
  OverviewPanel,
  type BreakdownRow,
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
import { ServiceKpiCards } from "../components/service-kpi-cards"
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

function byCount(counts: Map<string, BreakdownRow>) {
  return [...counts.values()].sort(
    (a, b) => b.value - a.value || a.label.localeCompare(b.label),
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

  const departments = new Map<string, BreakdownRow>()
  const models = new Map<string, BreakdownRow>()
  const templateUse = new Map<string, number>()
  let packages = 0
  for (const service of services) {
    packages += service.packages.length
    for (const department of service.departments) {
      const row = departments.get(department.id)
      departments.set(department.id, {
        id: department.id,
        label: department.name,
        value: (row?.value ?? 0) + 1,
      })
    }
    const model: PricingModel | "NONE" =
      service.pricingTemplate?.pricingModel ?? "NONE"
    models.set(model, {
      id: model,
      label:
        model === "NONE" ? "No pricing template" : pricingModelLabels[model],
      value: (models.get(model)?.value ?? 0) + 1,
    })
    if (service.pricingTemplateId)
      templateUse.set(
        service.pricingTemplateId,
        (templateUse.get(service.pricingTemplateId) ?? 0) + 1,
      )
  }
  const usedTemplates = templates.filter((t) => templateUse.has(t.id)).length
  const newest = [...services].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )[0]
  const recent = [...services]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5)
  const requirements = [
    {
      id: "consultation",
      label: "Consultation",
      value: services.filter((s) => s.requiresConsultation).length,
    },
    {
      id: "agreement",
      label: "Signed agreement",
      value: services.filter((s) => s.requiresAgreement).length,
    },
    {
      id: "payment",
      label: "Payment",
      value: services.filter((s) => s.requiresPayment).length,
    },
    {
      id: "quotation",
      label: "Quotation approval",
      value: services.filter((s) => s.requiresQuotationApproval).length,
    },
  ]
  const attention = [...services]
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((service) => {
      const issues = [
        !service.isActive && "inactive",
        service.packages.length === 0 && "no packages",
        service.departments.length === 0 && "no department",
      ].filter(Boolean)
      return issues.length
        ? [
            {
              id: service.id,
              label: service.name,
              note: issues.join(", ").replace(/^./, (c) => c.toUpperCase()),
              tone: service.isActive
                ? ("warning" as const)
                : ("danger" as const),
            },
          ]
        : []
    })

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Service overview"
    >
      <PageHeader
        title="Service Overview"
        description="Catalog size, availability, pricing, client requirements, and department coverage."
        actions={
          <Button asChild variant="brandOutline" size="header">
            <Link href="/services">Manage services</Link>
          </Button>
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
      <div className="mt-[18px] grid gap-4 max-[560px]:mt-[14px]">
        <ServiceKpiCards
          services={services}
          loading={loading}
          unavailable={Boolean(catalog.error)}
        />
        <MiniStats
          label="Service figures"
          loading={loading}
          items={[
            {
              label: "Packages",
              value: packages.toLocaleString("en-US"),
              hint: count
                ? `${(packages / count).toFixed(1)} per service`
                : undefined,
            },
            {
              label: "Pricing templates in use",
              value: `${usedTemplates}/${templates.length}`,
              hint:
                templates.length - usedTemplates > 0
                  ? `${templates.length - usedTemplates} unused`
                  : "All templates used",
            },
            {
              label: "Departments covered",
              value: departments.size.toLocaleString("en-US"),
              hint: "Deliver at least one service",
            },
            {
              label: "Newest service",
              value: newest?.name ?? "—",
              hint: newest
                ? `Added ${formatDate(newest.createdAt)}`
                : undefined,
            },
          ]}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <OverviewPanel
            title="Services by department"
            description="Departments delivering each service"
          >
            <BreakdownList
              rows={byCount(departments).slice(0, 8)}
              loading={loading}
              unit="services"
              empty="No services are linked to a department yet."
            />
          </OverviewPanel>
          <OverviewPanel
            title="Client requirements"
            description="Steps clients complete before work starts"
          >
            <BreakdownList
              rows={requirements}
              total={count}
              loading={loading}
              unit="services"
              empty="No services yet."
              colorClass="bg-[#6552a6]"
            />
          </OverviewPanel>
          <OverviewPanel
            title="Pricing models"
            description="Share of services by pricing template"
          >
            <BreakdownList
              rows={byCount(models)}
              total={count}
              loading={loading}
              unit="services"
              empty="No services yet."
              colorClass="bg-[#25745b]"
            />
          </OverviewPanel>
          <OverviewPanel
            title="Pricing templates"
            description="How often each template is used"
          >
            <ItemList
              rows={[...templates]
                .sort(
                  (a, b) =>
                    (templateUse.get(b.id) ?? 0) -
                      (templateUse.get(a.id) ?? 0) ||
                    a.name.localeCompare(b.name),
                )
                .map((template) => {
                  const uses = templateUse.get(template.id) ?? 0
                  return {
                    id: template.id,
                    label: template.name,
                    note: uses
                      ? `${uses} ${uses === 1 ? "service" : "services"}`
                      : "Unused",
                    tone: uses ? ("muted" as const) : ("warning" as const),
                  }
                })}
              loading={loading}
              empty="No pricing templates yet."
            />
          </OverviewPanel>
          <OverviewPanel
            title="Recently updated"
            description="Latest catalog changes"
          >
            <ItemList
              rows={recent.map((service) => ({
                id: service.id,
                label: service.name,
                note: formatDate(service.updatedAt),
              }))}
              loading={loading}
              empty="No services yet."
            />
          </OverviewPanel>
          <OverviewPanel
            title="Needs attention"
            description="Inactive, or missing packages or a department"
          >
            <ItemList
              rows={attention}
              loading={loading}
              empty={
                count
                  ? "Every service is active, packaged, and assigned."
                  : "No services yet."
              }
              emptyTone={count ? "success" : "muted"}
            />
          </OverviewPanel>
        </div>
      </div>
    </main>
  )
}
