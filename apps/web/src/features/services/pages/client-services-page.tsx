"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { sileo } from "sileo"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { contentClass, focusRing } from "@/components/layout/styles"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  listAvailableServices,
  type Service,
  type ServiceSpecialist,
  submitServiceRequest,
  type ServiceRequestReceipt,
} from "../api/services-api"
import { ServiceCard } from "../components/service-card"
import { ServiceShowcaseDialog } from "../components/service-showcase-dialog"
import { ServicePackagesStep } from "../components/service-packages-step"
import { ServiceRequirementsStep } from "../components/service-requirements-step"
import { ServiceSpecialistStep } from "../components/service-specialist-step"
import { ServiceRequestConfirmation } from "../components/service-request-confirmation"
import { createProjectRequirementsDraft } from "../model/project-requirements"
import { getServicePricingOptions } from "../model/service-pricing"

const pageSize = 8

function ServiceCardSkeleton() {
  return (
    <div
      className="aspect-square w-full animate-pulse rounded-2xl bg-[#e9eef7] motion-reduce:animate-none"
      aria-hidden="true"
    />
  )
}

export function ClientServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [departmentId, setDepartmentId] = useState("all")
  const [page, setPage] = useState(1)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
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
  const selectedPackage = packageService
    ? getServicePricingOptions(packageService).find(
        (option) => option.id === selectedPackageId,
      )
    : undefined

  useEffect(() => {
    let active = true
    listAvailableServices()
      .then((availableServices) => {
        if (!active) return
        setServices(availableServices)
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

  function exploreService(service: Service) {
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
      const receipt = await submitServiceRequest({
        ...requirementsDraft,
        serviceId: packageService.id,
        packageId:
          selectedPackage.id === "standard-service" ? null : selectedPackage.id,
        preferredSpecialistId: preferredSpecialist?.id ?? null,
        submissionKey: submissionKey.current,
      })
      setSubmittedRequest(receipt)
      sileo.success({ title: "Service request submitted for review" })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We couldn’t submit your request. Please try again."
      setSubmissionError(message)
      submissionErrorToast.current = sileo.error({
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
    >
      <header>
        <p className="m-0 text-[11px] font-bold tracking-[0.16em] text-[#2456b6] uppercase">
          Services
        </p>
        <h1 className="mt-1 mb-0 text-[clamp(23px,2.2vw,31px)] leading-tight font-bold tracking-[-0.035em] text-[#101d35]">
          {submittedRequest
            ? "Request Submitted"
            : currentStep === 4
              ? "Preferred Specialist"
              : currentStep === 3
                ? "Project Requirements"
                : currentStep === 2
                  ? "Choose Your Package"
                  : "Build Your Brand with EXP"}
        </h1>
        <p className="mt-1.5 mb-0 max-w-[760px] text-sm leading-relaxed text-[#587095]">
          {submittedRequest
            ? "Your service request is pending review."
            : currentStep === 4
              ? "Let us know who you’d prefer to work with, subject to availability and Department Manager approval."
              : currentStep === 3
                ? "Share your goals, requirements, and expected timeline so we can understand your project."
                : currentStep === 2
                  ? "Find the right package for your goals, with clear pricing and everything you need to get started."
                  : "Discover powerful digital services crafted to amplify your presence, connect with your audience, and turn ideas into real business impact."}
        </p>
      </header>

      <div className="mt-[clamp(30px,4vw,52px)] flex items-center gap-4">
        <div
          className="h-1 flex-1 overflow-hidden rounded-full bg-[#e4ebfa]"
          role="progressbar"
          aria-label="Service request progress"
          aria-valuemin={1}
          aria-valuemax={4}
          aria-valuenow={currentStep}
        >
          <div
            className={cn(
              "h-full rounded-full bg-[#294c96] transition-[width] duration-300 motion-reduce:transition-none",
              currentStep === 4
                ? "w-full"
                : currentStep === 3
                  ? "w-3/4"
                  : currentStep === 2
                    ? "w-1/2"
                    : "w-1/4",
            )}
          />
        </div>
        <span className="flex-none text-xs font-bold tracking-[0.04em] text-[#173d8d] uppercase">
          Step {currentStep} of 4
        </span>
      </div>

      {submittedRequest && packageService && selectedPackage ? (
        <ServiceRequestConfirmation
          receipt={submittedRequest}
          serviceName={packageService.name}
          packageName={selectedPackage.name}
          specialistName={preferredSpecialist?.fullName ?? null}
          onNewRequest={() => {
            setSubmittedRequest(null)
            setPackageService(null)
            setSelectedPackageId(null)
            setRequirementsDraft(createProjectRequirementsDraft())
            setRequirementsSaved(false)
            setPreferredSpecialist(null)
            setSubmissionError("")
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
          onSave={() => setRequirementsSaved(true)}
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
            <label className="relative block">
              <span className="sr-only">Search services</span>
              <Search
                size={19}
                strokeWidth={1.8}
                className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#7890b4]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Search services..."
                className={cn(
                  "h-12 w-full rounded-xl border border-[#dce3ee] bg-background pr-4 pl-11 text-sm text-[#17233a] shadow-[0_1px_2px_rgb(31_55_94_/_4%)] placeholder:text-[#8da0bd]",
                  focusRing,
                )}
              />
            </label>
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
            <div
              className="mt-4 grid min-h-[360px] place-items-center rounded-2xl border border-dashed border-[#ccd7e8] px-6 text-center"
              role="alert"
            >
              <div>
                <p className="m-0 text-sm font-semibold text-[#243c69]">
                  {error}
                </p>
                <button
                  type="button"
                  className={cn(
                    "mt-4 min-h-10 cursor-pointer rounded-lg border border-[#294c96] bg-background px-4 text-xs font-semibold text-[#294c96] hover:bg-[#eef3ff]",
                    focusRing,
                  )}
                  onClick={() => {
                    setLoading(true)
                    setRevision((current) => current + 1)
                  }}
                >
                  Try again
                </button>
              </div>
            </div>
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
                        onSelect={setSelectedService}
                      />
                    ))}
              </div>

              {!loading && filteredServices.length === 0 && (
                <div className="mt-4 grid min-h-[280px] place-items-center rounded-2xl border border-dashed border-[#ccd7e8] px-6 text-center">
                  <div>
                    <p className="m-0 text-base font-semibold text-[#243c69]">
                      No services found
                    </p>
                    <p className="mt-1.5 mb-0 text-sm text-[#6f83a2]">
                      Try a different search or department.
                    </p>
                  </div>
                </div>
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
    </main>
  )
}
