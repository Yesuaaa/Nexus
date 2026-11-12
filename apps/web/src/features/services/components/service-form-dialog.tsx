"use client"

import { Form } from "@/components/ui/form"

import Image from "next/image"
import { useRef, useState, type ReactNode } from "react"
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Plus,
  Trash2,
} from "lucide-react"
import { focusRing } from "@/components/layout/styles"
import { FormInput } from "@/components/ui/form-input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  SidePanel,
  SidePanelAlert,
  SidePanelBody,
  SidePanelButton,
  SidePanelFooter,
  SidePanelHeader,
  useSidePanel,
} from "@/components/ui/side-panel"
import type { Department } from "@/features/departments/api/departments-api"
import { cn } from "@/lib/utils"
import {
  createService,
  updateService,
  type BillingInterval,
  type PricingModel,
  type PricingTemplate,
  type Service,
  type ServiceIconKey,
  type ServiceInput,
  type ServicePackage,
} from "../api/services-api"
import { ServiceIcon, serviceIconOptions } from "./service-icon"
import { needsAmount, PriceFields } from "./service-price-fields"
import { serviceActionsTriggerId } from "./service-row-actions"

const fieldClass = "grid min-w-0 gap-1.5"
const labelClass = "text-xs font-semibold"
const inputClass = `w-full min-w-0 rounded-lg border border-[#d6dfec] bg-background px-3 text-sm text-foreground placeholder:text-[#9aa8bb] ${focusRing}`
const secondaryButtonClass = `inline-flex h-[34px] flex-none cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#e1e4ea] bg-background px-3 text-xs font-semibold whitespace-nowrap text-foreground transition-colors hover:bg-[#f1f5fc] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${focusRing}`
const removeButtonClass = `inline-flex cursor-pointer items-center gap-1 rounded-sm border-0 bg-transparent p-0 text-xs font-semibold text-[#b4234d] ${focusRing}`
const cardClass = "grid gap-3 rounded-lg border border-[#e8ebef] p-3.5"
// Shared popup style: no border/ring, soft navy-tinted shadow
const menuContentClass =
  "z-[130] border-0 bg-white p-1 ring-0 shadow-[0_8px_24px_rgb(18_36_73_/_14%)]"
const imageTypes = ["image/webp"]
const maxImageBytes = 2 * 1024 * 1024
const initialFormSteps = [
  { label: "Details", description: "Basic information and service image" },
  { label: "Benefits", description: "Client-facing value and outcomes" },
  { label: "Requirements", description: "Client needs and consultation" },
  {
    label: "Options",
    description: "Choose single pricing or multiple packages",
  },
] as const

type ServiceOffering = "pricing" | "packages"

type BenefitDraft = {
  id: string
  title: string
  description: string
}

function newBenefit(): BenefitDraft {
  return {
    id: `new-${crypto.randomUUID()}`,
    title: "",
    description: "",
  }
}

type PackageDraft = Omit<
  ServicePackage,
  "amount" | "createdAt" | "updatedAt"
> & {
  amount: string
  featuresText: string
  isNew?: boolean
}

function packageDraft(servicePackage: ServicePackage): PackageDraft {
  return {
    ...servicePackage,
    amount: servicePackage.amount ?? "",
    featuresText: servicePackage.includedFeatures.join("\n"),
  }
}

function newPackage(index: number): PackageDraft {
  return {
    id: `new-${crypto.randomUUID()}`,
    name: "",
    description: "",
    includedFeatures: [],
    featuresText: "",
    pricingModel: "CUSTOM_QUOTE",
    currency: "PHP",
    amount: "",
    billingInterval: null,
    isPricingPublic: true,
    isActive: true,
    displayOrder: index,
    isRecommended: false,
    isNew: true,
  }
}

/**
 * Title and hint at the top of a wizard step. Plain text rather than a
 * heading, so the panel keeps a single heading (its title).
 */
function StepIntro({
  id,
  title,
  description,
  action,
}: {
  id: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0">
        <p
          id={id}
          className="m-0 text-[13px] font-[650] tracking-[-0.01em] text-foreground"
        >
          {title}
        </p>
        {description && (
          <p className="mt-0.5 mb-0 text-[11px] leading-relaxed text-[#738096]">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

export function ServiceFormDialog({
  service,
  departments,
  pricingTemplates,
  onManagePricingTemplates,
  onClose,
  onSaved,
}: {
  service: Service | null
  departments: Department[]
  pricingTemplates: PricingTemplate[]
  onManagePricingTemplates?: (id?: string) => void
  onClose: () => void
  onSaved: (service: Service) => void
}) {
  const panel = useSidePanel(onClose)
  const bodyRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(service?.name ?? "")
  const [description, setDescription] = useState(service?.description ?? "")
  const [iconKey, setIconKey] = useState<ServiceIconKey>(
    service?.iconKey ?? "sparkles",
  )
  const [departmentIds, setDepartmentIds] = useState(
    service?.departments.map((department) => department.id) ?? [],
  )
  const [imagePreviewUrl, setImagePreviewUrl] = useState(
    service?.imageUrl ?? null,
  )
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [imageAltText, setImageAltText] = useState(service?.imageAltText ?? "")
  const [clientRequirements, setClientRequirements] = useState(
    service?.clientRequirements.join("\n") ?? "",
  )
  const [requiresConsultation, setRequiresConsultation] = useState(
    service?.requiresConsultation ?? false,
  )
  const [requiresAgreement, setRequiresAgreement] = useState(
    service?.requiresAgreement ?? true,
  )
  const [requiresPayment, setRequiresPayment] = useState(
    service?.requiresPayment ?? true,
  )
  const [requiresQuotationApproval, setRequiresQuotationApproval] = useState(
    service?.requiresQuotationApproval ?? false,
  )
  const [consultationNotes, setConsultationNotes] = useState(
    service?.consultationNotes ?? "",
  )
  const [keyBenefits, setKeyBenefits] = useState<BenefitDraft[]>(
    service?.keyBenefits.map(({ id, title, description }) => ({
      id,
      title,
      description,
    })) ?? [],
  )
  const [requestedPricingChoice, setPricingChoice] = useState(
    service?.pricingTemplateId ?? "none",
  )
  const pricingChoice =
    requestedPricingChoice === "new" ||
    requestedPricingChoice === "none" ||
    pricingTemplates.some((template) => template.id === requestedPricingChoice)
      ? requestedPricingChoice
      : "none"
  const [templateName, setTemplateName] = useState(
    service ? `${service.name} Pricing` : "",
  )
  const [pricingModel, setPricingModel] = useState<PricingModel>("CUSTOM_QUOTE")
  const [amount, setAmount] = useState("")
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval | null>(null)
  const [isPricingPublic, setIsPricingPublic] = useState(true)
  const [packages, setPackages] = useState<PackageDraft[]>(
    service?.packages.map(packageDraft) ?? [],
  )
  const [offering, setOffering] = useState<ServiceOffering | null>(
    service ? (service.packages.length > 0 ? "packages" : "pricing") : null,
  )
  const [currentStep, setCurrentStep] = useState(0)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const isEditing = Boolean(service)
  const formSteps = [
    ...initialFormSteps,
    offering === "packages"
      ? { label: "Packages", description: "Configure multiple service options" }
      : offering === "pricing"
        ? {
            label: "Pricing",
            description: "Configure one service pricing option",
          }
        : {
            label: "Setup",
            description: "Configure your selected service option",
          },
  ]

  /** Bring the top of the body (where errors and step intros sit) into view. */
  function scrollBodyToTop() {
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }

  function showError(message: string) {
    setError(message)
    scrollBodyToTop()
  }

  function goToStep(step: number) {
    setError("")
    setCurrentStep(step)
    scrollBodyToTop()
  }

  function selectOffering(value: ServiceOffering) {
    setOffering(value)
    setError("")
    if (value === "packages" && packages.length === 0) {
      setPackages([newPackage(0), newPackage(1)])
    }
  }

  function updatePackage(id: string, update: Partial<PackageDraft>) {
    setPackages((current) =>
      current.map((item) => (item.id === id ? { ...item, ...update } : item)),
    )
  }

  function updateBenefit(id: string, update: Partial<BenefitDraft>) {
    setKeyBenefits((current) =>
      current.map((item) => (item.id === id ? { ...item, ...update } : item)),
    )
  }

  function selectRecommended(id: string, checked: boolean) {
    setPackages((current) =>
      current.map((item) => ({
        ...item,
        isRecommended: item.id === id ? checked : false,
      })),
    )
  }

  function handleImage(file: File | undefined) {
    if (!file) return
    if (!imageTypes.includes(file.type) || file.size > maxImageBytes) {
      showError("Choose a WebP image up to 2 MB")
      if (imageInputRef.current) imageInputRef.current.value = ""
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageDataUrl(reader.result)
        setImagePreviewUrl(reader.result)
        setRemoveImage(false)
        setImageAltText((current) => current || `${name || "Service"} image`)
        setError("")
      }
    }
    reader.onerror = () => showError("The selected image could not be read")
    reader.readAsDataURL(file)
  }

  function validateStep(step: number) {
    if (step === 0) {
      if (name.trim().length < 2)
        return "Service name must contain at least 2 characters"
      if (description.trim().length < 2)
        return "Please enter a brief service description"
      if (departmentIds.length === 0)
        return "Please select at least one responsible department"
      if (imagePreviewUrl && imageAltText.trim().length < 2)
        return "Add alternative text for the service image"
    }
    if (step === 1) {
      for (const [index, benefit] of keyBenefits.entries()) {
        if (benefit.title.trim().length < 2)
          return `Enter a title for key benefit ${index + 1}`
        if (benefit.description.trim().length < 2)
          return `Enter a description for key benefit ${index + 1}`
      }
    }
    if (step === 3 && !offering) return "Choose Pricing or Packages to continue"
    if (step === 4 && offering === "pricing" && pricingChoice === "new") {
      if (templateName.trim().length < 2)
        return "Enter a name for the pricing template"
      if (
        needsAmount(pricingModel) &&
        (!Number.isFinite(Number(amount)) || Number(amount) <= 0)
      )
        return "Enter a valid service price"
      if (pricingModel === "RECURRING" && !billingInterval)
        return "Select a billing interval"
    }
    if (step === 4 && offering === "packages") {
      if (packages.length < 2)
        return "Add at least two packages, or choose Pricing for a single option"
      for (const [index, servicePackage] of packages.entries()) {
        if (servicePackage.name.trim().length < 2)
          return `Enter a name for package ${index + 1}`
        if (servicePackage.description.trim().length < 2)
          return `Enter a description for package ${index + 1}`
        if (
          !servicePackage.featuresText
            .split("\n")
            .some((feature) => feature.trim())
        ) {
          return `Add at least one included feature to package ${index + 1}`
        }
        if (
          needsAmount(servicePackage.pricingModel) &&
          (!Number.isFinite(Number(servicePackage.amount)) ||
            Number(servicePackage.amount) <= 0)
        ) {
          return `Enter a valid price for package ${index + 1}`
        }
        if (
          servicePackage.pricingModel === "RECURRING" &&
          !servicePackage.billingInterval
        ) {
          return `Select a billing interval for package ${index + 1}`
        }
      }
    }
    return ""
  }

  function goToNextStep() {
    const validationError = validateStep(currentStep)
    if (validationError) {
      showError(validationError)
      return
    }
    goToStep(Math.min(currentStep + 1, formSteps.length - 1))
  }

  function goToPreviousStep() {
    goToStep(Math.max(currentStep - 1, 0))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return
    if (currentStep < formSteps.length - 1) {
      goToNextStep()
      return
    }
    for (let step = 0; step < formSteps.length; step++) {
      const validationError = validateStep(step)
      if (validationError) {
        setCurrentStep(step)
        showError(validationError)
        return
      }
    }

    const input: ServiceInput = {
      name: name.trim(),
      description: description.trim(),
      iconKey,
      departmentIds,
      isActive: service?.isActive ?? true,
      imageDataUrl,
      imageAltText: imagePreviewUrl ? imageAltText.trim() : null,
      removeImage,
      clientRequirements: clientRequirements
        .split("\n")
        .map((requirement) => requirement.trim())
        .filter(Boolean),
      requiresConsultation,
      requiresAgreement,
      requiresPayment,
      requiresQuotationApproval,
      consultationNotes: requiresConsultation
        ? consultationNotes.trim() || null
        : null,
      keyBenefits: keyBenefits.map(({ title, description }) => ({
        title: title.trim(),
        description: description.trim(),
      })),
      pricingTemplateId:
        offering !== "pricing" ||
        pricingChoice === "none" ||
        pricingChoice === "new"
          ? null
          : pricingChoice,
      pricingTemplate:
        offering === "pricing" && pricingChoice === "new"
          ? {
              name: templateName.trim(),
              pricingModel,
              currency: "PHP",
              amount: needsAmount(pricingModel) ? Number(amount) : null,
              billingInterval:
                pricingModel === "RECURRING" ? billingInterval : null,
              isPublic: isPricingPublic,
            }
          : null,
      packages: (offering === "packages" ? packages : []).map(
        ({ featuresText, isNew, ...servicePackage }) => ({
          ...servicePackage,
          ...(isNew ? { id: undefined } : {}),
          includedFeatures: featuresText
            .split("\n")
            .map((feature) => feature.trim())
            .filter(Boolean),
          amount: needsAmount(servicePackage.pricingModel)
            ? Number(servicePackage.amount)
            : null,
          billingInterval:
            servicePackage.pricingModel === "RECURRING"
              ? servicePackage.billingInterval
              : null,
        }),
      ),
    }

    setSubmitting(true)
    setError("")
    try {
      const saved = service
        ? await updateService(service.id, input)
        : await createService(input)
      panel.close(() => onSaved(saved))
    } catch (caught) {
      showError(
        caught instanceof Error
          ? caught.message
          : "Couldn't save the service. Please try again.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      dismissible={false}
      busy={submitting}
      fallbackFocus={() =>
        service
          ? document.getElementById(serviceActionsTriggerId(service.id))
          : document.getElementById("service-management-heading")
      }
    >
      <SidePanelHeader
        title={isEditing ? "Edit Service" : "Create Service"}
        description={`Step ${currentStep + 1} of ${formSteps.length} · ${formSteps[currentStep].description}`}
        closeLabel="Close dialog"
        closeDisabled={submitting}
      />

      <nav
        className="@container flex-none border-b border-[#eceef1] px-6 pt-4 pb-3.5 max-[560px]:px-5"
        aria-label="Service form progress"
      >
        <ol className="m-0 grid list-none grid-cols-5 gap-1.5 p-0">
          {formSteps.map((step, index) => {
            const isComplete = !isEditing && index < currentStep
            const isCurrent = index === currentStep
            return (
              <li
                key={step.label}
                className="relative flex min-w-0 flex-col items-center text-center"
                aria-current={isCurrent ? "step" : undefined}
              >
                {index > 0 && (
                  <span
                    className={cn(
                      "absolute top-[13px] right-1/2 h-px w-full -translate-y-1/2",
                      index <= currentStep ? "bg-[#203f8c]" : "bg-[#dce3ed]",
                    )}
                    aria-hidden="true"
                  />
                )}
                <button
                  type="button"
                  className={cn(
                    "relative z-10 flex w-full min-w-0 flex-col items-center gap-1.5 rounded-lg border-0 bg-transparent px-0.5 py-0 disabled:cursor-default",
                    isEditing &&
                      "cursor-pointer hover:enabled:bg-[#f1f5fc] disabled:opacity-60",
                    focusRing,
                  )}
                  onClick={() => goToStep(index)}
                  disabled={
                    !isEditing || submitting || (index === 4 && !offering)
                  }
                  aria-current={isCurrent ? "step" : undefined}
                >
                  <span
                    className={cn(
                      "relative z-10 grid size-7 place-items-center rounded-full border text-[11px] font-bold transition-colors motion-reduce:transition-none",
                      isComplete && "border-[#203f8c] bg-[#203f8c] text-white",
                      isCurrent &&
                        "border-[#203f8c] bg-white text-[#203f8c] ring-2 ring-[#dce6fb]",
                      !isComplete &&
                        !isCurrent &&
                        "border-[#d4dce8] bg-white text-[#8290a5]",
                    )}
                  >
                    {isComplete ? (
                      <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span
                    className={cn(
                      "block w-full truncate text-[10px] font-semibold @min-[480px]:text-[11px]",
                      isCurrent || isComplete
                        ? "text-[#203f8c]"
                        : "text-[#8290a5]",
                    )}
                  >
                    {step.label}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <Form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <SidePanelBody ref={bodyRef} className="@container">
          {error && <SidePanelAlert>{error}</SidePanelAlert>}
          <fieldset
            disabled={submitting}
            className="m-0 grid min-w-0 content-start gap-5 border-0 p-0 disabled:opacity-60"
          >
            {currentStep === 0 && (
              <div
                role="group"
                className="grid gap-4"
                aria-labelledby="service-step-details"
              >
                <StepIntro id="service-step-details" title="Service details" />
                <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-4 @max-[440px]:grid-cols-1">
                  <div className="grid content-start gap-2">
                    <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-lg border border-dashed border-[#c9d4e5] bg-[#f5f7fb] text-[#738096]">
                      {imagePreviewUrl ? (
                        <Image
                          src={imagePreviewUrl}
                          alt={imageAltText || "Service preview"}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <ImagePlus size={26} aria-hidden="true" />
                      )}
                    </div>
                    <input
                      ref={imageInputRef}
                      id="service-image"
                      type="file"
                      accept="image/webp"
                      className="peer sr-only"
                      onChange={(event) => handleImage(event.target.files?.[0])}
                    />
                    <label
                      htmlFor="service-image"
                      className={cn(
                        secondaryButtonClass,
                        "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#294a9b]",
                      )}
                    >
                      Choose Image
                    </label>
                    {imagePreviewUrl && (
                      <button
                        type="button"
                        className={cn(removeButtonClass, "justify-center")}
                        onClick={() => {
                          setImageDataUrl(null)
                          setImagePreviewUrl(null)
                          setImageAltText("")
                          setRemoveImage(true)
                          if (imageInputRef.current)
                            imageInputRef.current.value = ""
                        }}
                      >
                        Remove image
                      </button>
                    )}
                    <p className="m-0 text-[10px] leading-relaxed text-[#8290a5]">
                      WebP only. Maximum 2 MB.
                    </p>
                  </div>
                  <div className="grid content-start gap-4">
                    <div className={fieldClass}>
                      <label className={labelClass} htmlFor="service-name">
                        Service Name{" "}
                        <strong className="text-[#d04b56]">*</strong>
                      </label>
                      <FormInput
                        id="service-name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        maxLength={100}
                        required
                        autoFocus
                      />
                    </div>
                    <div className={fieldClass}>
                      <label
                        className={labelClass}
                        htmlFor="service-description"
                      >
                        Description{" "}
                        <strong className="text-[#d04b56]">*</strong>
                      </label>
                      <textarea
                        id="service-description"
                        className={cn(inputClass, "min-h-24 resize-y py-2.5")}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        maxLength={500}
                        required
                      />
                    </div>
                    {imagePreviewUrl && (
                      <div className={fieldClass}>
                        <label
                          className={labelClass}
                          htmlFor="service-image-alt"
                        >
                          Image Alternative Text{" "}
                          <strong className="text-[#d04b56]">*</strong>
                        </label>
                        <FormInput
                          id="service-image-alt"
                          value={imageAltText}
                          onChange={(event) =>
                            setImageAltText(event.target.value)
                          }
                          maxLength={160}
                          required
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 @max-[440px]:grid-cols-1">
                  <div className={fieldClass}>
                    <label className={labelClass} htmlFor="service-icon">
                      Icon Category
                    </label>
                    <Select
                      value={iconKey}
                      onValueChange={(value) =>
                        setIconKey(value as ServiceIconKey)
                      }
                    >
                      <SelectTrigger
                        id="service-icon"
                        className={cn(inputClass, "h-10 shadow-none")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={menuContentClass}>
                        {serviceIconOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <span className="flex items-center gap-2">
                              <ServiceIcon iconKey={option.value} size={16} />
                              {option.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass} htmlFor="service-departments">
                      Responsible Departments{" "}
                      <strong className="text-[#d04b56]">*</strong>
                    </label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          id="service-departments"
                          type="button"
                          className={cn(
                            inputClass,
                            "flex h-10 cursor-pointer items-center justify-between gap-2 text-left shadow-none",
                          )}
                          aria-label="Select responsible departments"
                        >
                          <span
                            className={cn(
                              "truncate",
                              departmentIds.length === 0 && "text-[#9aa8bb]",
                            )}
                          >
                            {departmentIds.length === 0
                              ? "Select departments"
                              : `${departmentIds.length} selected`}
                          </span>
                          <ChevronDown size={15} aria-hidden="true" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className={cn(
                          menuContentClass,
                          "w-[var(--radix-dropdown-menu-trigger-width)]",
                        )}
                      >
                        {departments.map((department) => (
                          <DropdownMenuCheckboxItem
                            key={department.id}
                            checked={departmentIds.includes(department.id)}
                            onCheckedChange={(checked) =>
                              setDepartmentIds((current) =>
                                checked
                                  ? [...current, department.id]
                                  : current.filter(
                                      (id) => id !== department.id,
                                    ),
                              )
                            }
                            onSelect={(event) => event.preventDefault()}
                          >
                            {department.name}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {departments.length === 0 && (
                      <p className="m-0 text-[11px] text-[#bc3649]">
                        Create a department before creating a service.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div
                role="group"
                className="grid gap-4"
                aria-labelledby="service-step-benefits"
              >
                <StepIntro
                  id="service-step-benefits"
                  title="Key Benefits"
                  description="Add the outcomes clients can expect. These appear as expandable items in the service modal."
                  action={
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      onClick={() =>
                        setKeyBenefits((current) => [...current, newBenefit()])
                      }
                      disabled={keyBenefits.length >= 10}
                    >
                      <Plus size={14} aria-hidden="true" /> Add Benefit
                    </button>
                  }
                />
                {keyBenefits.length === 0 && (
                  <p className="m-0 rounded-lg border border-dashed border-[#d6dfec] p-4 text-center text-xs text-[#738096]">
                    No key benefits configured yet.
                  </p>
                )}
                {keyBenefits.map((benefit, index) => (
                  <article key={benefit.id} className={cardClass}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="m-0 text-xs font-[650]">
                        Benefit {index + 1}
                      </h3>
                      <button
                        type="button"
                        className={removeButtonClass}
                        onClick={() =>
                          setKeyBenefits((current) =>
                            current.filter((item) => item.id !== benefit.id),
                          )
                        }
                      >
                        <Trash2 size={13} aria-hidden="true" /> Remove
                      </button>
                    </div>
                    <div className={fieldClass}>
                      <label
                        className={labelClass}
                        htmlFor={`${benefit.id}-title`}
                      >
                        Benefit Title
                      </label>
                      <FormInput
                        id={`${benefit.id}-title`}
                        value={benefit.title}
                        onChange={(event) =>
                          updateBenefit(benefit.id, {
                            title: event.target.value,
                          })
                        }
                        maxLength={120}
                        required
                      />
                    </div>
                    <div className={fieldClass}>
                      <label
                        className={labelClass}
                        htmlFor={`${benefit.id}-description`}
                      >
                        Benefit Description
                      </label>
                      <textarea
                        id={`${benefit.id}-description`}
                        className={cn(inputClass, "min-h-20 resize-y py-2.5")}
                        value={benefit.description}
                        onChange={(event) =>
                          updateBenefit(benefit.id, {
                            description: event.target.value,
                          })
                        }
                        maxLength={500}
                        required
                      />
                    </div>
                  </article>
                ))}
              </div>
            )}

            {currentStep === 2 && (
              <div
                role="group"
                className="grid gap-4"
                aria-labelledby="service-step-requirements"
              >
                <StepIntro
                  id="service-step-requirements"
                  title="Client Requirements & Consultation"
                  description="Define what clients should provide before a request proceeds."
                />
                <div className={fieldClass}>
                  <label className={labelClass} htmlFor="client-requirements">
                    Client Requirements{" "}
                    <span className="font-normal text-[#8290a5]">
                      (one per line)
                    </span>
                  </label>
                  <textarea
                    id="client-requirements"
                    className={cn(inputClass, "min-h-24 resize-y py-2.5")}
                    value={clientRequirements}
                    onChange={(event) =>
                      setClientRequirements(event.target.value)
                    }
                    placeholder="Brand guidelines&#10;Project brief&#10;Target launch date"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={requiresConsultation}
                    onChange={(event) =>
                      setRequiresConsultation(event.target.checked)
                    }
                  />
                  Consultation is required before proceeding
                </label>
                {requiresConsultation && (
                  <div className={fieldClass}>
                    <label className={labelClass} htmlFor="consultation-notes">
                      Consultation Notes
                    </label>
                    <textarea
                      id="consultation-notes"
                      className={cn(inputClass, "min-h-20 resize-y py-2.5")}
                      value={consultationNotes}
                      onChange={(event) =>
                        setConsultationNotes(event.target.value)
                      }
                      maxLength={500}
                      placeholder="Explain the consultation process or preparation needed."
                    />
                  </div>
                )}
                <fieldset className="m-0 grid min-w-0 gap-3 rounded-lg border border-[#e8ebef] p-4">
                  <legend className="float-left w-full p-0">
                    <span className="block text-xs font-semibold text-foreground">
                      Commencement requirements
                    </span>
                    <span className="mt-1 block text-[11px] leading-5 font-normal text-[#738096]">
                      These rules apply to newly accepted requests. Existing
                      conversations retain their agreed requirements.
                    </span>
                  </legend>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={requiresAgreement}
                      onChange={(event) =>
                        setRequiresAgreement(event.target.checked)
                      }
                    />
                    Approved signed agreement required
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={requiresPayment}
                      onChange={(event) =>
                        setRequiresPayment(event.target.checked)
                      }
                    />
                    Verified commencement payment required
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={requiresQuotationApproval}
                      onChange={(event) =>
                        setRequiresQuotationApproval(event.target.checked)
                      }
                    />
                    Assigned approver must authorize quotations before the
                    client receives them
                  </label>
                </fieldset>
              </div>
            )}

            {currentStep === 3 && (
              <div
                role="group"
                className="grid gap-4"
                aria-labelledby="service-step-options"
              >
                <StepIntro
                  id="service-step-options"
                  title="How will this service be offered?"
                  description="Choose one pricing option or let clients choose between multiple packages."
                />
                <div className="grid grid-cols-2 gap-3 @max-[440px]:grid-cols-1">
                  {(
                    [
                      {
                        value: "pricing",
                        label: "Pricing",
                        description:
                          "One service option with a single pricing configuration.",
                      },
                      {
                        value: "packages",
                        label: "Packages",
                        description:
                          "Two or more service options, each with its own features and pricing.",
                      },
                    ] as const
                  ).map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-[#203f8c] motion-reduce:transition-none",
                        offering === option.value
                          ? "border-[#203f8c] bg-[#f1f5fc]"
                          : "border-[#d6dfec] bg-background hover:bg-[#f8fafc]",
                      )}
                    >
                      <input
                        type="radio"
                        name="service-offering"
                        value={option.value}
                        checked={offering === option.value}
                        onChange={() => selectOffering(option.value)}
                        className="mt-0.5 accent-[#203f8c]"
                      />
                      <span className="grid gap-1">
                        <span className="text-sm font-semibold">
                          {option.label}
                        </span>
                        <span className="text-xs leading-5 text-[#738096]">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                {offering === "pricing" &&
                  Boolean(service?.packages.length) && (
                    <p className="m-0 text-xs leading-5 text-[#738096]">
                      Saving with Pricing will replace this service&apos;s
                      existing packages with one pricing option. Existing
                      requests keep their agreed pricing.
                    </p>
                  )}
              </div>
            )}

            {currentStep === 4 && offering === "pricing" && (
              <div
                role="group"
                className="grid gap-4"
                aria-labelledby="service-step-pricing"
              >
                <StepIntro
                  id="service-step-pricing"
                  title="Pricing"
                  description="Reuse a template across services or create a new PHP pricing configuration."
                />
                <div className={fieldClass}>
                  <label className={labelClass} htmlFor="pricing-template">
                    Pricing Template
                  </label>
                  <Select
                    value={pricingChoice}
                    onValueChange={setPricingChoice}
                  >
                    <SelectTrigger
                      id="pricing-template"
                      className={cn(inputClass, "h-10 shadow-none")}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={menuContentClass}>
                      <SelectItem value="none">
                        No pricing configured
                      </SelectItem>
                      <SelectItem value="new">
                        Create a reusable template
                      </SelectItem>
                      {pricingTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {onManagePricingTemplates && (
                  <button
                    type="button"
                    className={cn(secondaryButtonClass, "justify-self-start")}
                    onClick={() =>
                      onManagePricingTemplates(
                        pricingChoice === "new" || pricingChoice === "none"
                          ? undefined
                          : pricingChoice,
                      )
                    }
                  >
                    {pricingChoice === "new" || pricingChoice === "none"
                      ? "Manage pricing templates"
                      : "Customize template"}
                  </button>
                )}
                {pricingChoice === "new" && (
                  <div className="grid gap-3 rounded-lg border border-[#e8ebef] bg-[#f8fafc] p-3.5">
                    <div className={fieldClass}>
                      <label
                        className={labelClass}
                        htmlFor="pricing-template-name"
                      >
                        Template Name
                      </label>
                      <FormInput
                        id="pricing-template-name"
                        value={templateName}
                        onChange={(event) =>
                          setTemplateName(event.target.value)
                        }
                        maxLength={100}
                        required
                      />
                    </div>
                    <PriceFields
                      idPrefix="service-pricing"
                      model={pricingModel}
                      amount={amount}
                      billingInterval={billingInterval}
                      onModelChange={(value) => {
                        setPricingModel(value)
                        if (value !== "RECURRING") setBillingInterval(null)
                      }}
                      onAmountChange={setAmount}
                      onBillingIntervalChange={setBillingInterval}
                    />
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={isPricingPublic}
                        onChange={(event) =>
                          setIsPricingPublic(event.target.checked)
                        }
                      />{" "}
                      Display pricing publicly
                    </label>
                  </div>
                )}
              </div>
            )}

            {currentStep === 4 && offering === "packages" && (
              <div
                role="group"
                className="grid gap-4"
                aria-labelledby="service-step-packages"
              >
                <StepIntro
                  id="service-step-packages"
                  title="Service Packages"
                  description="Add at least two options for clients to choose from. Active packages appear publicly in display order."
                  action={
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      onClick={() =>
                        setPackages((current) => [
                          ...current,
                          newPackage(current.length),
                        ])
                      }
                      disabled={packages.length >= 20}
                    >
                      <Plus size={14} aria-hidden="true" /> Add Package
                    </button>
                  }
                />
                {packages.length === 0 && (
                  <p className="m-0 rounded-lg border border-dashed border-[#d6dfec] p-4 text-center text-xs text-[#738096]">
                    No packages configured.
                  </p>
                )}
                {packages.map((servicePackage, index) => (
                  <article key={servicePackage.id} className={cardClass}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="m-0 text-xs font-[650]">
                        Package {index + 1}
                      </h3>
                      <button
                        type="button"
                        className={removeButtonClass}
                        onClick={() =>
                          setPackages((current) =>
                            current.filter(
                              (item) => item.id !== servicePackage.id,
                            ),
                          )
                        }
                      >
                        <Trash2 size={13} aria-hidden="true" /> Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 @max-[440px]:grid-cols-1">
                      <div className={fieldClass}>
                        <label
                          className={labelClass}
                          htmlFor={`${servicePackage.id}-name`}
                        >
                          Package Name
                        </label>
                        <FormInput
                          id={`${servicePackage.id}-name`}
                          value={servicePackage.name}
                          onChange={(event) =>
                            updatePackage(servicePackage.id, {
                              name: event.target.value,
                            })
                          }
                          maxLength={80}
                          required
                        />
                      </div>
                      <div className={fieldClass}>
                        <label
                          className={labelClass}
                          htmlFor={`${servicePackage.id}-order`}
                        >
                          Display Order
                        </label>
                        <FormInput
                          id={`${servicePackage.id}-order`}
                          type="number"
                          min="0"
                          max="10000"
                          value={servicePackage.displayOrder}
                          onChange={(event) =>
                            updatePackage(servicePackage.id, {
                              displayOrder: Number(event.target.value),
                            })
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className={fieldClass}>
                      <label
                        className={labelClass}
                        htmlFor={`${servicePackage.id}-description`}
                      >
                        Description
                      </label>
                      <textarea
                        id={`${servicePackage.id}-description`}
                        className={cn(inputClass, "min-h-20 resize-y py-2.5")}
                        value={servicePackage.description}
                        onChange={(event) =>
                          updatePackage(servicePackage.id, {
                            description: event.target.value,
                          })
                        }
                        maxLength={500}
                        required
                      />
                    </div>
                    <div className={fieldClass}>
                      <label
                        className={labelClass}
                        htmlFor={`${servicePackage.id}-features`}
                      >
                        Included Features{" "}
                        <span className="font-normal text-[#8290a5]">
                          (one per line)
                        </span>
                      </label>
                      <textarea
                        id={`${servicePackage.id}-features`}
                        className={cn(inputClass, "min-h-24 resize-y py-2.5")}
                        value={servicePackage.featuresText}
                        onChange={(event) =>
                          updatePackage(servicePackage.id, {
                            featuresText: event.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <PriceFields
                      idPrefix={servicePackage.id}
                      model={servicePackage.pricingModel}
                      amount={servicePackage.amount}
                      billingInterval={servicePackage.billingInterval}
                      onModelChange={(value) =>
                        updatePackage(servicePackage.id, {
                          pricingModel: value,
                          ...(value === "RECURRING"
                            ? {}
                            : { billingInterval: null }),
                        })
                      }
                      onAmountChange={(value) =>
                        updatePackage(servicePackage.id, { amount: value })
                      }
                      onBillingIntervalChange={(value) =>
                        updatePackage(servicePackage.id, {
                          billingInterval: value,
                        })
                      }
                    />
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={servicePackage.isActive}
                          onChange={(event) =>
                            updatePackage(servicePackage.id, {
                              isActive: event.target.checked,
                            })
                          }
                        />{" "}
                        Active
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={servicePackage.isPricingPublic}
                          onChange={(event) =>
                            updatePackage(servicePackage.id, {
                              isPricingPublic: event.target.checked,
                            })
                          }
                        />{" "}
                        Display pricing publicly
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={servicePackage.isRecommended}
                          onChange={(event) =>
                            selectRecommended(
                              servicePackage.id,
                              event.target.checked,
                            )
                          }
                        />{" "}
                        Recommended
                      </label>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </fieldset>
        </SidePanelBody>
        <SidePanelFooter className="justify-between">
          <div>
            {currentStep > 0 && (
              <SidePanelButton
                variant="secondary"
                className="gap-1"
                onClick={goToPreviousStep}
                disabled={submitting}
              >
                <ChevronLeft size={14} aria-hidden="true" /> Back
              </SidePanelButton>
            )}
          </div>
          <div className="flex gap-2">
            <SidePanelButton
              variant="secondary"
              onClick={() => panel.close()}
              disabled={submitting}
            >
              Cancel
            </SidePanelButton>
            <SidePanelButton
              type="submit"
              className="gap-1"
              disabled={submitting || departments.length === 0}
            >
              {currentStep < formSteps.length - 1 ? (
                <>
                  {isEditing ? "Next" : "Continue"}{" "}
                  <ChevronRight size={14} aria-hidden="true" />
                </>
              ) : submitting ? (
                "Saving..."
              ) : isEditing ? (
                "Save Changes"
              ) : (
                "Create Service"
              )}
            </SidePanelButton>
          </div>
        </SidePanelFooter>
      </Form>
    </SidePanel>
  )
}
