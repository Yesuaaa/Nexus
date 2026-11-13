"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { SidePanelLoading } from "@/components/ui/panel-loading"
import { sileo } from "@/lib/toast"
import { PlusIcon } from "@/components/layout/icons"
import { PageHeader, PageHeaderButton } from "@/components/layout/page-header"
import { contentClass, focusRing } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { hasPermission, Permissions } from "@/features/auth/model/permissions"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import {
  listDepartments,
  type Department,
} from "@/features/departments/api/departments-api"
import { useAsyncResource } from "@/lib/use-async-resource"
import { cn } from "@/lib/utils"
import {
  changeServiceStatus,
  deleteService,
  listPricingTemplates,
  listServices,
  type PricingTemplate,
  type Service,
} from "../api/services-api"
import { DeleteServiceDialog } from "../components/delete-service-dialog"
import { ServiceStatusDialog } from "../components/service-status-dialog"
import { ServiceTable } from "../components/service-table"
import { errorMessage } from "@/lib/error-message"

const ServiceFormDialog = dynamic(
  () =>
    import("../components/service-form-dialog").then(
      (module) => module.ServiceFormDialog,
    ),
  { loading: () => <SidePanelLoading /> },
)
const ServiceDetailsDialog = dynamic(
  () =>
    import("../components/service-details-dialog").then(
      (module) => module.ServiceDetailsDialog,
    ),
  { loading: () => <SidePanelLoading /> },
)
const PricingTemplatesDialog = dynamic(
  () =>
    import("../components/pricing-templates-dialog").then(
      (module) => module.PricingTemplatesDialog,
    ),
  { loading: () => <SidePanelLoading /> },
)

type Catalog = {
  services: Service[]
  departments: Department[]
  pricingTemplates: PricingTemplate[]
}

const emptyCatalog: Catalog = {
  services: [],
  departments: [],
  pricingTemplates: [],
}

async function loadCatalog(signal: AbortSignal): Promise<Catalog> {
  const [services, departments, pricingTemplates] = await Promise.all([
    listServices(signal),
    listDepartments(),
    listPricingTemplates(signal),
  ])
  return { services, departments, pricingTemplates }
}

export function ServiceManagementPage() {
  const actor = usePortalAccount()
  const canManage = hasPermission(actor, Permissions.SERVICES_MANAGE)
  const catalog = useAsyncResource(loadCatalog, [], {
    fallbackError: "Couldn't load services. Please try again.",
  })
  const { loading, error, setData } = catalog
  const { services, departments, pricingTemplates } =
    catalog.data ?? emptyCatalog
  const [formTarget, setFormTarget] = useState<Service | "create" | null>(null)
  const [detailsTarget, setDetailsTarget] = useState<Service | null>(null)
  const [statusTarget, setStatusTarget] = useState<Service | null>(null)
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusError, setStatusError] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [templateManagerId, setTemplateManagerId] = useState<string | null>(
    null,
  )

  function setServices(update: (current: Service[]) => Service[]) {
    setData((current) => {
      const value = current ?? emptyCatalog
      return { ...value, services: update(value.services) }
    })
  }
  function setPricingTemplates(
    update: (current: PricingTemplate[]) => PricingTemplate[],
  ) {
    setData((current) => {
      const value = current ?? emptyCatalog
      return { ...value, pricingTemplates: update(value.pricingTemplates) }
    })
  }

  function savePricingTemplate(saved: PricingTemplate) {
    setPricingTemplates((current) =>
      current
        .map((template) => (template.id === saved.id ? saved : template))
        .sort((left, right) => left.name.localeCompare(right.name)),
    )
    setServices((current) =>
      current.map((service) =>
        service.pricingTemplateId === saved.id
          ? { ...service, pricingTemplate: saved }
          : service,
      ),
    )
  }

  function saveInList(saved: Service) {
    setServices((current) => {
      const exists = current.some((service) => service.id === saved.id)
      return exists
        ? current.map((service) => (service.id === saved.id ? saved : service))
        : [saved, ...current]
    })
    if (saved.pricingTemplate) {
      setPricingTemplates((current) =>
        current.some((template) => template.id === saved.pricingTemplate?.id)
          ? current
          : [...current, saved.pricingTemplate!].sort((left, right) =>
              left.name.localeCompare(right.name),
            ),
      )
    }
    const edited = formTarget !== "create"
    setFormTarget(null)
    sileo.success({
      title: edited ? "Service updated" : "Service created",
      description: `${saved.name} was saved successfully.`,
    })
  }

  async function saveStatus() {
    if (!statusTarget || statusSaving || !canManage) return
    setStatusSaving(true)
    setStatusError("")
    const nextStatus = !statusTarget.isActive
    try {
      const updated = await changeServiceStatus(statusTarget.id, nextStatus)
      setServices((current) =>
        current.map((service) =>
          service.id === updated.id ? updated : service,
        ),
      )
      setStatusTarget(null)
      sileo.success({
        title: nextStatus ? "Service activated" : "Service deactivated",
        description: nextStatus
          ? `${updated.name} is available for new client requests.`
          : `${updated.name} is no longer available for new client requests.`,
      })
    } catch (caught) {
      setStatusError(
        errorMessage(
          caught,
          "Couldn't update the service status. Please try again.",
        ),
      )
    } finally {
      setStatusSaving(false)
    }
  }

  async function removeService() {
    if (!deleteTarget || deleteTarget.isActive || deleting || !canManage) return
    setDeleting(true)
    setDeleteError("")
    try {
      await deleteService(deleteTarget.id)
      setServices((current) =>
        current.filter((service) => service.id !== deleteTarget.id),
      )
      const deletedName = deleteTarget.name
      setDeleteTarget(null)
      sileo.success({
        title: "Service deleted",
        description: `${deletedName} was permanently deleted.`,
      })
    } catch (caught) {
      setDeleteError(
        errorMessage(caught, "Couldn't delete the service. Please try again."),
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Service management"
    >
      <PageHeader
        headingId="service-management-heading"
        title="Service Management"
        description="Create and manage company services and assign responsible departments."
        actions={
          canManage && (
            <>
              <Button
                type="button"
                variant="brandOutline"
                size="header"
                disabled={loading || Boolean(error)}
                className={cn("cursor-pointer", focusRing)}
                onClick={() => setTemplateManagerId("")}
              >
                Pricing Templates
              </Button>
              <PageHeaderButton
                type="button"
                onClick={() => setFormTarget("create")}
              >
                <PlusIcon width="14" height="14" /> Create Service
              </PageHeaderButton>
            </>
          )
        }
      />

      <section
        className="mt-[18px] min-w-0 max-[560px]:mt-[14px]"
        aria-label="Services"
      >
        <ServiceTable
          services={services}
          departments={departments}
          loading={loading}
          error={error}
          canManage={canManage}
          onView={setDetailsTarget}
          onEdit={setFormTarget}
          onStatus={(service) => {
            setStatusError("")
            setStatusTarget(service)
          }}
          onDelete={(service) => {
            if (service.isActive) return
            setDeleteError("")
            setDeleteTarget(service)
          }}
          onRetry={catalog.retry}
        />
      </section>

      {formTarget && (
        <ServiceFormDialog
          service={formTarget === "create" ? null : formTarget}
          departments={departments}
          pricingTemplates={pricingTemplates}
          onManagePricingTemplates={(id) => setTemplateManagerId(id ?? "")}
          onClose={() => setFormTarget(null)}
          onSaved={saveInList}
        />
      )}
      {templateManagerId !== null && canManage && (
        <PricingTemplatesDialog
          templates={pricingTemplates.map((template) => ({
            ...template,
            services: services
              .filter((service) => service.pricingTemplateId === template.id)
              .map(({ id, name }) => ({ id, name })),
          }))}
          initialTemplateId={templateManagerId || undefined}
          onClose={() => setTemplateManagerId(null)}
          onSaved={savePricingTemplate}
          onDeleted={(id) =>
            setPricingTemplates((current) =>
              current.filter((template) => template.id !== id),
            )
          }
        />
      )}
      {detailsTarget && (
        <ServiceDetailsDialog
          service={detailsTarget}
          onClose={() => setDetailsTarget(null)}
          onEdit={canManage ? setFormTarget : undefined}
        />
      )}
      {statusTarget && (
        <ServiceStatusDialog
          service={statusTarget}
          saving={statusSaving}
          error={statusError}
          onClose={() => {
            if (!statusSaving) setStatusTarget(null)
          }}
          onConfirm={() => void saveStatus()}
        />
      )}
      {deleteTarget && (
        <DeleteServiceDialog
          service={deleteTarget}
          deleting={deleting}
          error={deleteError}
          onClose={() => {
            if (!deleting) setDeleteTarget(null)
          }}
          onConfirm={() => void removeService()}
        />
      )}
    </main>
  )
}
