"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  FileImage,
  LoaderCircle,
  X,
} from "lucide-react"
import { focusRing } from "@/components/layout/styles"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAnimatedPanelClose } from "@/components/ui/use-animated-panel-close"
import { cn } from "@/lib/utils"
import {
  getServiceSpecialistProfile,
  type ServiceSpecialist,
  type ServiceSpecialistProfile,
  type SpecialistPortfolioProject,
} from "../api/services-api"

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

function safeHttpsUrl(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : null
  } catch {
    return null
  }
}

function ProjectThumbnail({
  project,
}: {
  project: SpecialistPortfolioProject
}) {
  const [failed, setFailed] = useState(false)
  const imageUrl = safeHttpsUrl(project.thumbnailUrl)

  return (
    <div className="relative aspect-[16/10] max-h-[320px] overflow-hidden rounded-lg bg-[#edf2f8]">
      {imageUrl && !failed ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          unoptimized
          sizes="(max-width: 640px) calc(100vw - 80px), 220px"
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="grid size-full place-items-center text-[#8191aa]"
          aria-hidden="true"
        >
          <FileImage size={28} strokeWidth={1.5} />
        </div>
      )}
    </div>
  )
}

export function SpecialistProfileDialog({
  serviceId,
  specialist,
  selected,
  disabled = false,
  allowSelection = true,
  onChoose,
  onClose,
}: {
  serviceId: string
  specialist: ServiceSpecialist
  selected: boolean
  disabled?: boolean
  allowSelection?: boolean
  onChoose: (specialist: ServiceSpecialist) => void
  onClose: () => void
}) {
  const { open, handleOpenChange, closeAfterTransition } =
    useAnimatedPanelClose(onClose)
  const [profile, setProfile] = useState<ServiceSpecialistProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  const [activeProject, setActiveProject] =
    useState<SpecialistPortfolioProject | null>(null)
  const projectHeadingRef = useRef<HTMLHeadingElement>(null)
  const projectTriggersRef = useRef(new Map<string, HTMLButtonElement>())
  const lastProjectIdRef = useRef<string | null>(null)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const openerRef = useRef<HTMLElement | null>(
    typeof document === "undefined"
      ? null
      : (document.activeElement as HTMLElement),
  )
  const imageUrl = safeHttpsUrl(profile?.imageUrl ?? null)
  const socialLinks =
    profile?.socialLinks?.flatMap((link) => {
      const url = safeHttpsUrl(link.url)
      return url ? [{ ...link, url }] : []
    }) ?? []
  const departmentName = specialist.department?.name

  useEffect(() => {
    let active = true
    getServiceSpecialistProfile(serviceId, specialist.id)
      .then((result) => {
        if (active) setProfile(result)
      })
      .catch(() => {
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [serviceId, specialist.id, revision])

  useEffect(() => {
    if (activeProject) {
      projectHeadingRef.current?.focus()
      return
    }
    if (lastProjectIdRef.current) {
      projectTriggersRef.current.get(lastProjectIdRef.current)?.focus()
      lastProjectIdRef.current = null
    }
  }, [activeProject])

  function showProject(project: SpecialistPortfolioProject) {
    lastProjectIdRef.current = project.id
    setActiveProject(project)
  }

  function chooseSpecialist() {
    if (!profile || disabled) return
    closeAfterTransition(() => onChoose(specialist))
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="nexus-panel-overlay z-[110] bg-[rgb(13_28_57_/_58%)]"
        className="nexus-detail-dialog z-[110] flex max-h-[calc(100dvh-32px)] w-[min(1000px,calc(100vw-32px))] max-w-[1000px] flex-col gap-0 overflow-hidden rounded-2xl border border-[#dce3ee] bg-white p-0 text-[#17243a] shadow-[0_24px_80px_rgb(7_20_48_/_28%)] max-[560px]:max-h-[calc(100dvh-20px)] max-[560px]:w-[calc(100vw-20px)]"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (openerRef.current?.isConnected) openerRef.current.focus()
        }}
      >
        <header className="relative flex min-h-20 shrink-0 items-center gap-4 bg-[#203f80] px-6 py-4 text-white max-[560px]:px-4">
          <div className="relative -mb-9 mt-1 grid size-[76px] shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white bg-[#eaf0fa] text-lg font-bold text-[#294c96] shadow-sm">
            {imageUrl && !avatarFailed ? (
              <Image
                src={imageUrl}
                alt=""
                width={68}
                height={68}
                unoptimized
                className="size-full object-cover"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              initials(specialist.fullName)
            )}
          </div>
          <div className="min-w-0 flex-1 self-start pt-1">
            <p className="m-0 text-[11px] font-bold tracking-[0.14em] text-white/75 uppercase">
              Specialist profile
            </p>
          </div>
          <button
            type="button"
            onClick={() => closeAfterTransition()}
            aria-label="Close specialist profile"
            className={cn(
              "grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border border-white/35 bg-white/10 text-white hover:bg-white/20",
              focusRing,
            )}
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <DialogTitle className="sr-only">Specialist profile</DialogTitle>
        <DialogDescription className="sr-only">
          {allowSelection
            ? "Review this specialist’s background and featured projects before setting a preference."
            : "Review this specialist’s background, specialties, social links, and featured projects."}
        </DialogDescription>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-6 pt-12 max-[560px]:px-5">
          {activeProject ? (
            <section aria-labelledby="specialist-project-detail-title">
              <button
                type="button"
                onClick={() => setActiveProject(null)}
                className={cn(
                  "mb-5 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#294c96] hover:bg-[#eef3ff]",
                  focusRing,
                )}
              >
                <ArrowLeft size={17} aria-hidden="true" /> Back to profile
              </button>
              <ProjectThumbnail project={activeProject} />
              <h2
                ref={projectHeadingRef}
                id="specialist-project-detail-title"
                tabIndex={-1}
                className="mt-5 mb-0 text-2xl font-bold tracking-[-0.03em] text-[#17243a] [overflow-wrap:anywhere]"
              >
                {activeProject.title}
              </h2>
              <p className="mt-3 mb-0 whitespace-pre-wrap text-sm leading-6 text-[#40516b] [overflow-wrap:anywhere]">
                {activeProject.summary || "No project summary provided."}
              </p>
              {activeProject.contribution && (
                <div className="mt-5 rounded-xl bg-[#f5f8fd] p-4">
                  <h3 className="m-0 text-xs font-bold tracking-[0.12em] text-[#526584] uppercase">
                    Contribution
                  </h3>
                  <p className="mt-2 mb-0 whitespace-pre-wrap text-sm leading-6 text-[#40516b] [overflow-wrap:anywhere]">
                    {activeProject.contribution}
                  </p>
                </div>
              )}
              {safeHttpsUrl(activeProject.projectUrl) && (
                <a
                  href={safeHttpsUrl(activeProject.projectUrl) ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View project: ${activeProject.title}`}
                  className={cn(
                    "mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#dce3ee] px-4 text-sm font-semibold text-[#294c96] hover:bg-[#f5f8fd]",
                    focusRing,
                  )}
                >
                  View project <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              )}
            </section>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="m-0 text-[clamp(24px,4vw,32px)] leading-tight font-bold tracking-[-0.04em] text-[#17243a] [overflow-wrap:anywhere]">
                    {specialist.fullName}
                  </h2>
                  <p className="mt-1 mb-0 text-sm font-semibold text-[#40516b]">
                    {specialist.position || "Specialist"}
                  </p>
                  {departmentName && (
                    <p className="mt-2 mb-0 inline-flex rounded-full bg-[#eaf0fa] px-3 py-1 text-xs font-semibold text-[#294c96]">
                      {departmentName}
                    </p>
                  )}
                  {socialLinks.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-xs font-semibold text-[#687e9e]">
                        Socials:
                      </span>
                      {socialLinks.map((link) => (
                        <a
                          key={`${link.platform}-${link.url}`}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open ${link.platform} profile for ${specialist.fullName}`}
                          className={cn(
                            "inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-[#294c96] underline-offset-4 hover:underline",
                            focusRing,
                          )}
                        >
                          {link.platform.toLowerCase() === "linkedin" && (
                            <span
                              className="inline-grid size-4 place-items-center rounded-[3px] bg-[#294c96] text-[10px] leading-none font-extrabold text-white"
                              aria-hidden="true"
                            >
                              in
                            </span>
                          )}
                          {link.platform} profile
                          <ArrowUpRight size={14} aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {loading ? (
                <div className="grid min-h-48 place-items-center" role="status">
                  <span className="inline-flex items-center gap-3 text-sm font-medium text-[#526584]">
                    <LoaderCircle
                      className="animate-spin motion-reduce:animate-none"
                      size={19}
                      aria-hidden="true"
                    />
                    Loading profile…
                  </span>
                </div>
              ) : error ? (
                <div
                  className="mt-8 rounded-xl border border-[#efd1d9] bg-[#fff8f9] p-5"
                  role="alert"
                >
                  <p className="m-0 text-sm leading-6 text-[#87223d]">
                    We couldn’t load this profile. Try again to review their
                    background and projects.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setError(false)
                      setLoading(true)
                      setRevision((current) => current + 1)
                    }}
                    className={cn(
                      "mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-[#dce3ee] bg-white px-4 text-sm font-semibold text-[#294c96] hover:bg-[#f5f8fd]",
                      focusRing,
                    )}
                  >
                    Retry profile
                  </button>
                </div>
              ) : profile ? (
                <>
                  <section
                    className="mt-7"
                    aria-labelledby="specialist-about-title"
                  >
                    <h2
                      id="specialist-about-title"
                      className="m-0 text-xs font-bold tracking-[0.14em] text-[#687e9e] uppercase"
                    >
                      About
                    </h2>
                    <p className="mt-2 mb-0 whitespace-pre-wrap text-sm leading-6 text-[#40516b] [overflow-wrap:anywhere]">
                      {profile.bio?.trim() ||
                        "No biography has been added yet."}
                    </p>
                  </section>

                  <section
                    className="mt-7"
                    aria-labelledby="specialist-specialties-title"
                  >
                    <h2
                      id="specialist-specialties-title"
                      className="m-0 text-xs font-bold tracking-[0.14em] text-[#687e9e] uppercase"
                    >
                      Specialties
                    </h2>
                    {profile.specialties.length ? (
                      <ul className="mt-3 mb-0 flex list-none flex-wrap gap-2 p-0">
                        {profile.specialties.map((specialty, index) => (
                          <li
                            key={`${specialty}-${index}`}
                            className="rounded-full border border-[#dce3ee] bg-[#f8faff] px-3 py-1.5 text-sm font-medium text-[#344b70]"
                          >
                            {specialty}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 mb-0 text-sm leading-6 text-[#687e9e]">
                        No specialties listed.
                      </p>
                    )}
                  </section>

                  <section
                    className="mt-8"
                    aria-labelledby="specialist-featured-title"
                  >
                    <h2
                      id="specialist-featured-title"
                      className="m-0 text-base font-bold tracking-[-0.02em] text-[#17243a]"
                    >
                      Featured projects
                    </h2>
                    {profile.projects.length ? (
                      <div className="mt-3 grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[900px]:grid-cols-3">
                        {profile.projects.map((project) => (
                          <article
                            key={project.id}
                            className="min-w-0 overflow-hidden rounded-xl border border-[#dce3ee] bg-white p-1.5"
                          >
                            <ProjectThumbnail project={project} />
                            <h3 className="mt-2 mb-0 line-clamp-2 px-1.5 text-sm leading-5 font-bold text-[#243c69] [overflow-wrap:anywhere]">
                              {project.title}
                            </h3>
                            <p className="mt-0.5 mb-0 line-clamp-2 px-1.5 text-xs leading-5 text-[#687e9e] [overflow-wrap:anywhere]">
                              {project.summary ||
                                "Project details available in the full view."}
                            </p>
                            <button
                              type="button"
                              ref={(node) => {
                                if (node)
                                  projectTriggersRef.current.set(
                                    project.id,
                                    node,
                                  )
                              }}
                              onClick={() => showProject(project)}
                              aria-label={`View project: ${project.title}`}
                              className={cn(
                                "mt-2 inline-flex min-h-11 w-full cursor-pointer items-center justify-start gap-1.5 border-t border-[#e6eaf0] px-1.5 pt-1 text-sm font-semibold text-[#294c96] hover:underline",
                                focusRing,
                              )}
                            >
                              View project{" "}
                              <ArrowRight size={15} aria-hidden="true" />
                            </button>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 mb-0 rounded-xl bg-[#f5f8fd] p-4 text-sm leading-6 text-[#687e9e]">
                        No featured projects have been added yet.
                      </p>
                    )}
                  </section>
                </>
              ) : null}
            </>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#e6eaf0] bg-white px-6 py-4 max-[560px]:px-4">
          <p className="m-0 max-w-[390px] text-xs leading-5 text-[#687e9e]">
            {allowSelection
              ? "Availability and project fit are reviewed by the department before a specialist is confirmed."
              : "View the specialist’s background and featured work from your request conversation."}
          </p>
          <div className="ml-auto flex flex-wrap gap-2 max-[560px]:w-full max-[560px]:flex-col-reverse">
            <button
              type="button"
              onClick={() => closeAfterTransition()}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-[#dce3ee] bg-white px-4 text-sm font-semibold text-[#294c96] hover:bg-[#f5f8fd]",
                focusRing,
              )}
            >
              Close profile
            </button>
            {allowSelection && !activeProject && (
              <button
                type="button"
                disabled={!profile || loading || error || disabled || selected}
                onClick={chooseSpecialist}
                className={cn(
                  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border-0 bg-[#294c96] px-5 text-sm font-bold text-white hover:enabled:bg-[#203f80] disabled:cursor-not-allowed disabled:opacity-50 max-[560px]:w-full",
                  focusRing,
                )}
              >
                {selected
                  ? "Selected as preferred specialist"
                  : `Choose ${specialist.fullName.trim().split(/\s+/)[0]} as preferred specialist`}
              </button>
            )}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
