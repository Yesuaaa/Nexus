"use client"

import { useEffect, useState } from "react"
import { sileo } from "sileo"
import { PlusIcon } from "@/components/layout/icons"
import { contentClass, focusRing } from "@/components/layout/styles"
import { hasPermission, Permissions } from "@/features/auth/model/permissions"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import {
  listDepartments,
  type Department,
} from "@/features/departments/api/departments-api"
import { cn } from "@/lib/utils"
import {
  changeServiceStatus,
  deleteService,
  listServices,
  type Service,
} from "../api/services-api"
import { ServiceDetailsDialog } from "../components/service-details-dialog"
import { DeleteServiceDialog } from "../components/delete-service-dialog"
import { ServiceFormDialog } from "../components/service-form-dialog"
import { ServiceKpiCards } from "../components/service-kpi-cards"
import { ServiceStatusDialog } from "../components/service-status-dialog"
import { ServiceTable } from "../components/service-table"

export function ServiceManagementPage() {
  const actor = usePortalAccount()
  const canManage = hasPermission(actor, Permissions.SERVICES_MANAGE)
  const [services, setServices] = useState<Service[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)
  const [formTarget, setFormTarget] = useState<Service | "create" | null>(null)
  const [detailsTarget, setDetailsTarget] = useState<Service | null>(null)
  const [statusTarget, setStatusTarget] = useState<Service | null>(null)
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusError, setStatusError] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  useEffect(() => {
    let active = true
    Promise.all([listServices(), listDepartments()])
      .then(([serviceData, departmentData]) => {
        if (!active) return
        setServices(serviceData)
        setDepartments(departmentData)
        setError("")
      })
      .catch((caught: unknown) => {
        if (!active) return
        setError(
          caught instanceof Error
            ? caught.message
            : "Couldn't load services. Please try again.",
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [revision])

  function saveInList(saved: Service) {
    setServices((current) => {
      const exists = current.some((service) => service.id === saved.id)
      return exists
        ? current.map((service) => (service.id === saved.id ? saved : service))
        : [saved, ...current]
    })
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
        caught instanceof Error
          ? caught.message
          : "Couldn't update the service status. Please try again.",
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
        caught instanceof Error
          ? caught.message
          : "Couldn't delete the service. Please try again.",
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
      <header className="-mx-[clamp(16px,2.1vw,32px)] flex items-center justify-between gap-6 border-b border-[#eceef1] px-[clamp(16px,2.1vw,32px)] pt-0.5 pb-5 max-[560px]:flex-col max-[560px]:items-start max-[560px]:gap-4 max-[560px]:pb-[18px]">
        <div>
          <h1 className="m-0 text-[clamp(21px,2vw,25px)] leading-[1.25] font-[650] tracking-[-0.03em] text-foreground">
            Service Management
          </h1>
          <p className="mt-[5px] mb-0 text-xs leading-[1.45] text-[#738096]">
            Create and manage company services and assign responsible
            departments.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            className={cn(
              "inline-flex min-h-[34px] flex-none cursor-pointer items-center justify-center gap-[7px] rounded-lg border border-transparent bg-[#203f8c] px-[13px] text-xs leading-[1.2] font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#172f70]",
              focusRing,
            )}
            onClick={() => setFormTarget("create")}
          >
            <PlusIcon width="14" height="14" /> Create Service
          </button>
        )}
      </header>

      <div className="mt-[18px] max-[560px]:mt-[14px]">
        <ServiceKpiCards
          services={services}
          loading={loading}
          unavailable={Boolean(error)}
        />
      </div>

      <section className="mt-4 min-w-0" aria-label="Services">
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
          onRetry={() => {
            setLoading(true)
            setRevision((current) => current + 1)
          }}
        />
      </section>

      {formTarget && (
        <ServiceFormDialog
          service={formTarget === "create" ? null : formTarget}
          departments={departments}
          onClose={() => setFormTarget(null)}
          onSaved={saveInList}
        />
      )}
      {detailsTarget && (
        <ServiceDetailsDialog
          service={detailsTarget}
          onClose={() => setDetailsTarget(null)}
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
