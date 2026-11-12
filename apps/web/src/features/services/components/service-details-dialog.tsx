import Image from "next/image"
import { DepartmentPill } from "@/components/ui/department-pill"
import { Pill } from "@/components/ui/pill"
import { SheetClose } from "@/components/ui/sheet"
import {
  DetailItem,
  DetailList,
  SidePanel,
  SidePanelBody,
  SidePanelButton,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelSection,
  useSidePanel,
} from "@/components/ui/side-panel"
import type { Service } from "../api/services-api"
import { ServiceIcon } from "./service-icon"
import { serviceActionsTriggerId } from "./service-row-actions"

function formatDate(value: string, includeTime = false) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(new Date(value))
}

const pricingLabels = {
  FIXED: "Fixed Price",
  STARTING: "Starting At",
  CUSTOM_QUOTE: "Custom Quotation",
  RECURRING: "Recurring",
  HOURLY: "Hourly Rate",
} as const

function formatPrice(amount: string | null, currency: string) {
  if (amount === null) return "Price on Request"
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount))
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <Pill tone={active ? "success" : "danger"}>
      {active ? "Active" : "Inactive"}
    </Pill>
  )
}

export function ServiceDetailsDialog({
  service,
  onClose,
  onEdit,
}: {
  service: Service
  onClose: () => void
  /** Shown as an "Edit service" action when provided (managers only). */
  onEdit?: (service: Service) => void
}) {
  const panel = useSidePanel(onClose)
  const template = service.pricingTemplate

  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      fallbackFocus={() =>
        document.getElementById(serviceActionsTriggerId(service.id))
      }
    >
      <SidePanelHeader
        leading={
          <span
            className="grid size-11 flex-none place-items-center rounded-xl bg-[#e5edff] text-[#2058d4]"
            aria-hidden="true"
          >
            <ServiceIcon iconKey={service.iconKey} size={20} />
          </span>
        }
        title={service.name}
        meta={<StatusPill active={service.isActive} />}
        description={
          service.departments.map((department) => department.name).join(", ") ||
          "No responsible department"
        }
        closeLabel="Close details"
      />
      <SidePanelBody>
        {service.imageUrl && (
          <div className="relative aspect-[16/7] overflow-hidden rounded-xl bg-[#eef2f8]">
            <Image
              src={service.imageUrl}
              alt={service.imageAltText ?? service.name}
              fill
              className="object-cover"
            />
          </div>
        )}
        <p className="m-0 text-xs leading-relaxed break-words text-[#526686]">
          {service.description}
        </p>
        <SidePanelSection title="Service information">
          <DetailList>
            <DetailItem label="Departments">
              {service.departments.length > 0 ? (
                <span className="flex flex-wrap justify-end gap-1.5">
                  {service.departments.map((department) => (
                    <DepartmentPill
                      key={department.id}
                      department={department}
                    />
                  ))}
                </span>
              ) : null}
            </DetailItem>
            <DetailItem label="Pricing">
              {template
                ? `${pricingLabels[template.pricingModel]} · ${formatPrice(
                    template.amount,
                    template.currency,
                  )}${template.billingInterval ? ` / ${template.billingInterval.toLocaleLowerCase()}` : ""}${template.isPublic ? "" : " (hidden publicly)"}`
                : service.packages.length > 0
                  ? "Set per package"
                  : "Not configured"}
            </DetailItem>
            <DetailItem label="Requirements">
              {service.clientRequirements.length > 0
                ? service.clientRequirements.join("; ")
                : "None specified"}
            </DetailItem>
            <DetailItem label="Consultation">
              {service.requiresConsultation
                ? service.consultationNotes || "Required before proceeding"
                : "Not required"}
            </DetailItem>
            <DetailItem label="Status">
              <StatusPill active={service.isActive} />
            </DetailItem>
            <DetailItem label="Date created">
              {formatDate(service.createdAt, true)}
            </DetailItem>
            <DetailItem label="Last updated">
              {formatDate(service.updatedAt, true)}
            </DetailItem>
          </DetailList>
        </SidePanelSection>
        {service.packages.length > 0 && (
          <SidePanelSection title="Packages">
            <div className="grid gap-2.5">
              {service.packages.map((servicePackage) => (
                <article
                  key={servicePackage.id}
                  className="rounded-lg border border-[#e8ebef] p-3.5"
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <strong className="min-w-0 truncate text-xs font-[650]">
                      {servicePackage.name}
                    </strong>
                    <span className="flex flex-none gap-1.5">
                      {servicePackage.isRecommended && (
                        <Pill tone="info">Recommended</Pill>
                      )}
                      <StatusPill active={servicePackage.isActive} />
                    </span>
                  </div>
                  <p className="mt-1.5 mb-0 text-xs leading-relaxed break-words text-[#526686]">
                    {servicePackage.description}
                  </p>
                  {servicePackage.includedFeatures.length > 0 && (
                    <ul className="mt-2 mb-0 grid gap-1 pl-4 text-[11px] text-[#526686]">
                      {servicePackage.includedFeatures.map((feature) => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2.5 mb-0 border-t border-[#eceef1] pt-2.5 text-xs font-semibold text-[#203f8c]">
                    {pricingLabels[servicePackage.pricingModel]} ·{" "}
                    {formatPrice(
                      servicePackage.amount,
                      servicePackage.currency,
                    )}
                    {servicePackage.billingInterval
                      ? ` / ${servicePackage.billingInterval.toLocaleLowerCase()}`
                      : ""}
                    {!servicePackage.isPricingPublic
                      ? " (hidden publicly)"
                      : ""}
                  </p>
                </article>
              ))}
            </div>
          </SidePanelSection>
        )}
      </SidePanelBody>
      <SidePanelFooter className={onEdit ? "justify-between" : undefined}>
        {onEdit && (
          <SidePanelButton
            variant="secondary"
            onClick={() => panel.close(() => onEdit(service))}
          >
            Edit service
          </SidePanelButton>
        )}
        <SheetClose asChild>
          <SidePanelButton aria-label="Done viewing service details">
            Done
          </SidePanelButton>
        </SheetClose>
      </SidePanelFooter>
    </SidePanel>
  )
}
