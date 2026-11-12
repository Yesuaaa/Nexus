"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { PanelLoading } from "@/components/ui/panel-loading"
import { sileo } from "@/lib/toast"
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Pill } from "@/components/ui/pill"
import { ProgressMeter } from "@/components/ui/stat-strip"
import { serviceRequestStatuses } from "../model/service-request-status"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { contentClass, focusRing } from "@/components/layout/styles"
import { ClientPageHeader } from "@/components/layout/client-page-header"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  type Service,
  type ServiceSpecialist,
  type ServiceRequestReceipt,
} from "../api/services-api"
import {
  getClientService,
  getClientServiceSpecialists,
  listClientServices,
  submitClientServiceRequest,
} from "../api/client-services-api"
import { Button } from "@/components/ui/button"
import { SearchField } from "@/components/ui/search-field"
import { ServiceCard } from "../components/service-card"
import {
  createProjectRequirementsDraft,
  validateProjectRequirements,
} from "../model/project-requirements"
import { getServicePricingOptions } from "../model/service-pricing"
import {
  readServiceDraft,
  writeServiceDraft,
  clearServiceDraft,
} from "../model/service-draft"
import { errorMessage } from "@/lib/error-message"

const pageSize = 8

const ServiceShowcaseDialog = dynamic(
  () =>
    import("../components/service-showcase-dialog").then(
      (module) => module.ServiceShowcaseDialog,
    ),
  { loading: PanelLoading },
)
const ServicePackagesStep = dynamic(() =>
  import("../components/service-packages-step").then(
    (module) => module.ServicePackagesStep,
  ),
)
const ServiceRequirementsStep = dynamic(() =>
  import("../components/service-requirements-step").then(
    (module) => module.ServiceRequirementsStep,
  ),
)
const ServiceSpecialistStep = dynamic(() =>
  import("../components/service-specialist-step").then(
    (module) => module.ServiceSpecialistStep,
  ),
)
const ServiceRequestConfirmation = dynamic(() =>
  import("../components/service-request-confirmation").then(
    (module) => module.ServiceRequestConfirmation,
  ),
)

function ServiceCardSkeleton() {
  return (
    <div
      className="aspect-square w-full animate-pulse rounded-2xl bg-[#e9eef7] motion-reduce:animate-none"
      aria-hidden="true"
    />
  )
}

export function ClientServicesPage() {
  const focusConfirmation = useCallback(
    (element: HTMLHeadingElement | null) => {
      element?.focus()
    },
    [],
  )
  const account = usePortalAccount()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [departmentId, setDepartmentId] = useState("all")
  const [page, setPage] = useState(1)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [detailState, setDetailState] = useState<{
    id: string
    error: string
  } | null>(null)
  const detailRequest = useRef(0)
  const [packageService, setPackageService] = useState<Service | null>(null)
  const [revision, setRevision] = useState(0)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1)
  const [preferredSpecialist, setPreferredSpecialist] =
    useState<ServiceSpecialist | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState("")
  const [submittedRequest, setSubmittedRequest] =
    useState<ServiceRequestReceipt | null>(null)
  const submissionKey = useRef<string | null>(null)
  const submittingRef = useRef(false)
  const submissionErrorToast = useRef<string | null>(null)
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    null,
  )
  const [requirementsDraft, setRequirementsDraft] = useState(
    createProjectRequirementsDraft,
  )
  const [requirementsSaved, setRequirementsSaved] = useState(false)
  const [draftReady, setDraftReady] = useState(false)
  const [draftNotice, setDraftNotice] = useState("")
  const [pendingService, setPendingService] = useState<Service | null>(null)
  const hydrated = useRef(false)
  const catalogRequest = useRef<{
    accountId: string
    revision: number
    promise: Promise<Service[]>
  } | null>(null)
  const selectedPackage = packageService
    ? getServicePricingOptions(packageService).find(
        (option) => option.id === selectedPackageId,
      )
    : undefined

  useEffect(() => {
    let active = true
    if (
      !catalogRequest.current ||
      catalogRequest.current.accountId !== account.id ||
      catalogRequest.current.revision !== revision
    ) {
      catalogRequest.current = {
        accountId: account.id,
        revision,
        promise: listClientServices(),
      }
    }
    catalogRequest.current.promise
      .then(async (availableServices) => {
        if (!active) return
        setServices(availableServices)
        setError("")
        if (!hydrated.current) {
          hydrated.current = true
          const draft = readServiceDraft(sessionStorage, account.id)
          if (draft) {
            const service = availableServices.find(
              (item) => item.id === draft.serviceId,
            )
            if (service) {
              const packageExists = getServicePricingOptions(service).some(
                (item) => item.id === draft.packageId,
              )
              setPackageService(service)
              setSelectedPackageId(packageExists ? draft.packageId : null)
              setRequirementsDraft(draft.requirements)
              submissionKey.current = draft.submissionKey
              const validRequirements =
                Object.keys(validateProjectRequirements(draft.requirements))
                  .length === 0
              setRequirementsSaved(validRequirements)
              setCurrentStep(
                !packageExists
                  ? 2
                  : draft.step === 4 && !validRequirements
                    ? 3
                    : draft.step,
              )
              setDraftNotice(
                packageExists
                  ? "Your draft was restored from this browser tab."
                  : "Your package is no longer available. Choose another package; your project details are still here.",
              )
              if (draft.specialistId) {
                try {
                  const specialists = await getClientServiceSpecialists(
                    service.id,
                  )
                  if (active)
                    setPreferredSpecialist(
                      specialists.find(
                        (item) => item.id === draft.specialistId,
                      ) ?? null,
                    )
                } catch {
                  /* The department assignment option remains available. */
                }
              }
            } else {
              clearServiceDraft(sessionStorage, account.id)
              setDraftNotice(
                "Your saved service is no longer available. Choose another service to start a new request.",
              )
            }
          }
        }
        if (active) setDraftReady(true)
      })
      .catch((caught: unknown) => {
        if (!active) return
        setError(
          errorMessage(caught, "Couldn't load services. Please try again."),
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [revision, account.id])

  useEffect(() => {
    if (!draftReady || !packageService || submittedRequest) return
    const saved = writeServiceDraft(sessionStorage, account.id, {
      serviceId: packageService.id,
      packageId: selectedPackageId,
      step: currentStep,
      requirements: requirementsDraft,
      specialistId: preferredSpecialist?.id ?? null,
      submissionKey: submissionKey.current,
    })
    if (!saved) {
      // Defer feedback so a blocked storage API does not interrupt typing.
      queueMicrotask(() =>
        setDraftNotice(
          "Your browser could not save this draft. Keep this page open until you submit.",
        ),
      )
    }
  }, [
    draftReady,
    packageService,
    selectedPackageId,
    currentStep,
    requirementsDraft,
    preferredSpecialist,
    account.id,
    submittedRequest,
  ])

  const departments = useMemo(() => {
    const uniqueDepartments = new Map<string, Service["departments"][number]>()
    services.forEach((service) => {
      service.departments.forEach((department) => {
        uniqueDepartments.set(department.id, department)
      })
    })
    return [...uniqueDepartments.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    )
  }, [services])

  const filteredServices = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return services.filter((service) => {
      const matchesDepartment =
        departmentId === "all" ||
        service.departments.some((department) => department.id === departmentId)
      const matchesSearch =
        query.length === 0 ||
        service.name.toLocaleLowerCase().includes(query) ||
        service.description.toLocaleLowerCase().includes(query) ||
        service.departments.some((department) =>
          department.name.toLocaleLowerCase().includes(query),
        )
      return matchesDepartment && matchesSearch
    })
  }, [departmentId, search, services])

  const pageCount = Math.max(1, Math.ceil(filteredServices.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageStart = (currentPage - 1) * pageSize
  const visibleServices = filteredServices.slice(
    pageStart,
    pageStart + pageSize,
  )
  const firstVisible = filteredServices.length === 0 ? 0 : pageStart + 1
  const lastVisible = Math.min(pageStart + pageSize, filteredServices.length)

  function updateSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  function updateDepartment(value: string) {
    setDepartmentId(value)
    setPage(1)
  }

  function applyService(service: Service) {
    if (packageService?.id !== service.id) {
      setSelectedPackageId(null)
      setRequirementsDraft(createProjectRequirementsDraft())
      setRequirementsSaved(false)
      setPreferredSpecialist(null)
      setSubmissionError("")
      submissionKey.current = null
    }
    setPackageService(service)
    setCurrentStep(2)
    setDraftNotice("")
  }

  function exploreService(service: Service) {
    if (
      packageService &&
      packageService.id !== service.id &&
      Object.values(requirementsDraft).some((value) => value.trim())
    ) {
      setPendingService(service)
      return
    }
    applyService(service)
  }

  async function selectService(service: Service) {
    const request = ++detailRequest.current
    setDetailState(null)
    try {
      const current = await getClientService(service.id)
      if (request !== detailRequest.current) return
      setSelectedService(current)
      setDetailState(null)
    } catch (reason) {
      if (request !== detailRequest.current) return
      setDetailState({
        id: service.id,
        error: errorMessage(reason, "Could not load this service."),
      })
    }
  }

  async function handleSubmitRequest() {
    if (
      submittingRef.current ||
      submittedRequest ||
      !packageService ||
      !selectedPackage
    )
      return
    submittingRef.current = true
    setSubmitting(true)
    setSubmissionError("")
    if (submissionErrorToast.current) {
      sileo.dismiss(submissionErrorToast.current)
      submissionErrorToast.current = null
    }
    try {
      submissionKey.current ??= crypto.randomUUID()
      writeServiceDraft(sessionStorage, account.id, {
        serviceId: packageService.id,
        packageId: selectedPackageId,
        step: 4,
        requirements: requirementsDraft,
        specialistId: preferredSpecialist?.id ?? null,
        submissionKey: submissionKey.current,
      })
      const receipt = await submitClientServiceRequest({
        ...requirementsDraft,
        serviceId: packageService.id,
        packageId:
          selectedPackage.id === "standard-service" ? null : selectedPackage.id,
        preferredSpecialistId: preferredSpecialist?.id ?? null,
        submissionKey: submissionKey.current,
      })
      setSubmittedRequest(receipt)
      clearServiceDraft(sessionStorage, account.id)
      setDraftNotice("")
      sileo.success({ title: "Service request submitted for review" })
    } catch (error) {
      const message = errorMessage(
        error,
        "We couldn’t submit your request. Please try again.",
      )
      setSubmissionError(message)
      submissionErrorToast.current = await sileo.error({
        title: "Request not submitted",
        description: message,
      })
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <main
      className={cn(contentClass, "p-[clamp(20px,2.1vw,32px)]")}
      aria-label="Services catalog"
      data-request-submitted={submittedRequest ? "" : undefined}
    >
      <ClientPageHeader
        headingRef={submittedRequest ? focusConfirmation : undefined}
        eyebrow={
          submittedRequest ? (
            <span className="text-[#203f8c]">Services</span>
          ) : (
            "Services"
          )
        }
        actions={
          submittedRequest ? (
            <Pill className="rounded-lg bg-[#fff4d6] px-3 py-1 text-sm font-semibold text-[#755400]">
              {serviceRequestStatuses.SUBMITTED.label}
            </Pill>
          ) : undefined
        }
        title={
          submittedRequest ? (
            <span className="flex items-center gap-3 text-black">
              <CheckCircle2
                size={32}
                className="shrink-0 text-[#19703a]"
                aria-hidden="true"
              />
              Request submitted
            </span>
          ) : currentStep === 4 ? (
            "Preferred Specialist"
          ) : currentStep === 3 ? (
            "Project Requirements"
          ) : currentStep === 2 ? (
            "Choose Your Package"
          ) : (
            "Build Your Brand with EXP"
          )
        }
        description={
          submittedRequest ? (
            <span className="text-[#52627a]">
              Your request is with the department for review.
            </span>
          ) : currentStep === 4 ? (
            "Let us know who you’d prefer to work with, subject to availability and Department Manager approval."
          ) : currentStep === 3 ? (
            "Share your goals, requirements, and expected timeline so we can understand your project."
          ) : currentStep === 2 ? (
            "Find the right package for your goals, with clear pricing and everything you need to get started."
          ) : (
            "Discover powerful digital services crafted to amplify your presence, connect with your audience, and turn ideas into real business impact."
          )
        }
      />

      {detailState && (
        <div
          className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-[#dce3ee] p-3 text-xs text-[#52627a]"
          role="alert"
        >
          {detailState.error}
          <Button
            variant="outline"
            className="h-8 text-xs"
            onClick={() => {
              const service = services.find(
                (item) => item.id === detailState.id,
              )
              if (service) void selectService(service)
            }}
          >
            Try again
          </Button>
        </div>
      )}

      <div className="mt-[clamp(30px,4vw,52px)] flex items-center gap-4">
        <div className="-mt-1 min-w-0 flex-1">
          <ProgressMeter
            value={currentStep}
            max={4}
            label="Service request progress"
            colorClass={submittedRequest ? "bg-[#203f8c]" : "bg-[#294c96]"}
          />
        </div>
        <span
          className={cn(
            "flex-none text-xs font-bold tracking-[0.04em] uppercase",
            submittedRequest ? "text-[#203f8c]" : "text-[#173d8d]",
          )}
        >
          Step {currentStep} of 4
        </span>
      </div>
      {draftNotice && !submittedRequest && (
        <p
          role="status"
          className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-[#dce3ee] bg-white px-4 py-3 text-sm leading-6 text-[#405b80]"
        >
          <span>{draftNotice}</span>
          <button
            type="button"
            onClick={() => setDraftNotice("")}
            className={cn(
              "min-h-9 shrink-0 cursor-pointer rounded-md px-2 text-sm font-semibold text-[#294c96]",
              focusRing,
            )}
            aria-label="Dismiss draft message"
          >
            Dismiss
          </button>
        </p>
      )}

      {submittedRequest && packageService && selectedPackage ? (
        <ServiceRequestConfirmation
          receipt={submittedRequest}
          serviceName={packageService.name}
          packageName={selectedPackage.name}
          specialistName={preferredSpecialist?.fullName ?? null}
          onBackToServices={() => {
            setSubmittedRequest(null)
            setPackageService(null)
            setSelectedPackageId(null)
            setRequirementsDraft(createProjectRequirementsDraft())
            setRequirementsSaved(false)
            setPreferredSpecialist(null)
            submissionKey.current = null
            setCurrentStep(1)
          }}
        />
      ) : currentStep === 4 && packageService && selectedPackage ? (
        <ServiceSpecialistStep
          key={packageService.id}
          service={packageService}
          selectedPackage={selectedPackage}
          timeline={requirementsDraft.expectedTimeline}
          requirements={requirementsDraft}
          onEditPackage={() => setCurrentStep(2)}
          value={preferredSpecialist}
          submitting={submitting}
          submissionError={submissionError}
          onChange={(specialist) => {
            setPreferredSpecialist(specialist)
            setSubmissionError("")
          }}
          onSubmit={handleSubmitRequest}
          onBack={() => setCurrentStep(3)}
        />
      ) : currentStep === 3 && packageService && selectedPackage ? (
        <ServiceRequirementsStep
          service={packageService}
          selectedPackage={selectedPackage}
          value={requirementsDraft}
          saved={requirementsSaved}
          onChange={(draft) => {
            setRequirementsDraft(draft)
            setRequirementsSaved(false)
          }}
          onSave={() => {
            if (!packageService) return
            const saved = writeServiceDraft(sessionStorage, account.id, {
              serviceId: packageService.id,
              packageId: selectedPackageId,
              step: currentStep,
              requirements: requirementsDraft,
              specialistId: preferredSpecialist?.id ?? null,
              submissionKey: submissionKey.current,
            })
            setRequirementsSaved(saved)
            if (!saved)
              sileo.error({
                title: "Draft could not be saved",
                description:
                  "Keep this tab open until you submit your request.",
              })
          }}
          onContinue={() => setCurrentStep(4)}
          onBack={() => setCurrentStep(2)}
        />
      ) : currentStep === 2 && packageService ? (
        <ServicePackagesStep
          key={packageService.id}
          service={packageService}
          onBack={() => setCurrentStep(1)}
          onViewDetails={() => setSelectedService(packageService)}
          selectedId={selectedPackageId}
          onSelect={setSelectedPackageId}
          onContinue={() => {
            if (selectedPackage) setCurrentStep(3)
          }}
        />
      ) : (
        <section className="mt-5" aria-label="Browse services">
          <div className="grid grid-cols-[minmax(0,1fr)_224px] gap-3 max-[700px]:grid-cols-1">
            <SearchField
              size="large"
              label="Search services"
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search services..."
              containerClassName="focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#294a9b]"
            />
            <Select value={departmentId} onValueChange={updateDepartment}>
              <SelectTrigger
                className={cn(
                  "h-12 rounded-xl border-[#dce3ee] bg-background px-4 text-sm font-semibold text-[#17233a] shadow-[0_1px_2px_rgb(31_55_94_/_4%)]",
                  focusRing,
                )}
                aria-label="Filter services by department"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All services ({services.length})
                </SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? (
            <EmptyState
              role="alert"
              className="mt-4 min-h-[360px] rounded-2xl"
              action={
                <button
                  type="button"
                  className={cn(
                    "min-h-10 cursor-pointer rounded-lg border border-[#294c96] bg-background px-4 text-xs font-semibold text-[#294c96] hover:bg-[#eef3ff]",
                    focusRing,
                  )}
                  onClick={() => {
                    setLoading(true)
                    setRevision((current) => current + 1)
                  }}
                >
                  Try again
                </button>
              }
            >
              <p className="m-0 text-sm font-semibold text-[#243c69]">
                {error}
              </p>
            </EmptyState>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-4 gap-3 max-[1200px]:grid-cols-3 max-[960px]:grid-cols-2 max-[560px]:grid-cols-1">
                {loading
                  ? Array.from({ length: pageSize }, (_, index) => (
                      <ServiceCardSkeleton key={index} />
                    ))
                  : visibleServices.map((service) => (
                      <ServiceCard
                        key={service.id}
                        service={service}
                        onSelect={(item) => void selectService(item)}
                      />
                    ))}
              </div>

              {!loading && filteredServices.length === 0 && (
                <EmptyState
                  title="No services found"
                  description="Try a different search or department."
                  className="mt-4 min-h-[280px] rounded-2xl"
                />
              )}

              {!loading && filteredServices.length > 0 && (
                <footer className="mt-5 flex min-h-[62px] items-center justify-between gap-4 rounded-xl border border-[#dce3ee] px-4 py-2 text-xs text-[#60789e] max-[560px]:flex-col max-[560px]:justify-center">
                  <span>
                    Showing {firstVisible}&ndash;{lastVisible} of{" "}
                    {filteredServices.length} services
                  </span>
                  <nav
                    className="flex items-center gap-1.5"
                    aria-label="Service pages"
                  >
                    <button
                      type="button"
                      className={cn(
                        "grid size-9 cursor-pointer place-items-center rounded-lg border border-[#dce3ee] bg-background text-[#294c96] hover:bg-[#eef3ff] disabled:cursor-not-allowed disabled:opacity-35",
                        focusRing,
                      )}
                      disabled={currentPage === 1}
                      onClick={() =>
                        setPage((current) => Math.max(1, current - 1))
                      }
                      aria-label="Previous page"
                    >
                      <ChevronLeft size={17} aria-hidden="true" />
                    </button>
                    {Array.from(
                      { length: pageCount },
                      (_, index) => index + 1,
                    ).map((pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        className={cn(
                          "size-9 cursor-pointer rounded-lg border-0 text-xs font-bold",
                          pageNumber === currentPage
                            ? "bg-[#294c96] text-white"
                            : "bg-transparent text-[#294c96] hover:bg-[#eef3ff]",
                          focusRing,
                        )}
                        onClick={() => setPage(pageNumber)}
                        aria-label={`Page ${pageNumber}`}
                        aria-current={
                          pageNumber === currentPage ? "page" : undefined
                        }
                      >
                        {pageNumber}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={cn(
                        "grid size-9 cursor-pointer place-items-center rounded-lg border border-[#dce3ee] bg-background text-[#294c96] hover:bg-[#eef3ff] disabled:cursor-not-allowed disabled:opacity-35",
                        focusRing,
                      )}
                      disabled={currentPage === pageCount}
                      onClick={() =>
                        setPage((current) => Math.min(pageCount, current + 1))
                      }
                      aria-label="Next page"
                    >
                      <ChevronRight size={17} aria-hidden="true" />
                    </button>
                  </nav>
                </footer>
              )}
            </>
          )}
        </section>
      )}

      {selectedService && (
        <ServiceShowcaseDialog
          service={selectedService}
          onClose={() => setSelectedService(null)}
          onExplore={exploreService}
        />
      )}
      {pendingService && (
        <ConfirmationDialog
          title="Start with a different service?"
          description={`Changing to ${pendingService.name} will clear the package, project details, and specialist preference in your current draft.`}
          confirmLabel="Change service"
          pendingLabel="Change service"
          cancelLabel="Keep current draft"
          pending={false}
          destructive={false}
          onClose={() => setPendingService(null)}
          onConfirm={() => {
            applyService(pendingService)
            setPendingService(null)
          }}
        />
      )}
    </main>
  )
}
