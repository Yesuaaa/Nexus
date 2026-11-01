"use client"

import { useState, type ReactNode } from "react"
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ExternalLink,
  ImageIcon,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  Camera,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { contentClass, focusRing } from "@/components/layout/styles"
import type { Account } from "@/features/auth/model/types"
import type { Profile, PortfolioProject } from "../api/profile-api"

const roles = {
  USER: "Client",
  STAFF: "Staff",
  ADMIN: "Admin",
  SUPERADMIN: "Superadmin",
}
function Photo({
  url,
  alt,
  className,
  fallback,
}: {
  url?: string
  alt: string
  className: string
  fallback: ReactNode
}) {
  const [failed, setFailed] = useState(false)
  return url?.startsWith("https://") && !failed ? (
    <img
      src={url}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  ) : (
    <div
      className={`${className} grid place-items-center bg-[#edf2fb] text-[#294a9b]`}
    >
      {fallback}
    </div>
  )
}
function Card({
  title,
  children,
  onEdit,
  actionLabel,
}: {
  title: string
  children: ReactNode
  onEdit?: () => void
  actionLabel?: string
}) {
  return (
    <section className="min-w-0 rounded-xl border border-[#dce3ee] bg-background p-5 sm:p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="m-0 text-base font-semibold text-[#17243a]">{title}</h2>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={actionLabel || `Edit ${title.toLowerCase()}`}
            title={actionLabel || `Edit ${title.toLowerCase()}`}
            className={`grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-[#52627a] hover:bg-[#edf2fb] hover:text-[#294a9b] ${focusRing}`}
          >
            <Pencil size={17} aria-hidden="true" />
          </button>
        )}
      </header>
      {children}
    </section>
  )
}

export function ProfileOverview({
  user,
  profile,
  error,
  onRetry,
  onEditPersonal,
  onEditSpecialist,
  onEditSecurity,
  onEditImages,
}: {
  user: Account
  profile: Profile | null
  error: string
  onRetry: () => void
  onEditPersonal: () => void
  onEditSpecialist: () => void
  onEditSecurity: () => void
  onEditImages: () => void
}) {
  const [selectedProject, setSelectedProject] =
    useState<PortfolioProject | null>(null)
  const specialist = profile?.specialist
  const employee = profile?.employee
  const initials = (user.fullName || user.email)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
  const memberSince = new Date(user.createdAt).toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  })
  return (
    <main
      className={`${contentClass} p-4 sm:p-6 lg:p-8`}
      aria-label="My profile"
    >
      <h1 className="mt-0 mb-5 text-lg font-semibold text-[#17243a]">
        My profile
      </h1>
      <section
        aria-label="Profile overview"
        className="mb-6 overflow-hidden rounded-2xl border border-[#dce3ee] bg-background"
      >
        <div
          className="relative h-32 overflow-hidden bg-[#203f80] sm:h-44"
        >
          {profile?.bannerUrl ? <Photo key={profile.bannerUrl} url={profile.bannerUrl} alt="Profile banner" className="absolute inset-0 size-full object-cover" fallback={null} /> : <><div aria-hidden="true" className="absolute -top-24 -right-10 size-80 rounded-full border-[40px] border-white/5" /><div aria-hidden="true" className="absolute -bottom-48 right-60 size-80 rounded-full bg-white/5" /></>}
          <button type="button" onClick={onEditImages} disabled={!profile} className={`absolute top-4 right-4 flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-white/30 bg-[#17243a]/70 px-3 text-xs font-medium text-white hover:bg-[#17243a] disabled:opacity-50 ${focusRing}`}><Camera size={16} aria-hidden="true" />Edit banner</button>
        </div>
        <div className="relative px-5 pb-6 sm:px-7">
          <button type="button" aria-label="Change profile picture" disabled={!profile} onClick={onEditImages} className={`relative -mt-12 mb-4 inline-block cursor-pointer rounded-full border-[5px] border-background bg-background shadow-sm sm:-mt-14 ${focusRing}`}>
            <Photo
              key={profile?.imageUrl || specialist?.imageUrl || "avatar"}
              url={profile?.imageUrl || specialist?.imageUrl}
              alt={`${user.fullName || "Your"} profile photo`}
              className="size-24 rounded-full object-cover text-2xl font-semibold sm:size-28"
              fallback={initials}
            />
            <span className="absolute right-0 bottom-0 grid size-8 place-items-center rounded-full border border-[#dce3ee] bg-background text-[#294a9b]"><Camera size={15} aria-hidden="true" /></span>
          </button>
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="m-0 break-words text-2xl leading-tight font-semibold tracking-tight text-[#17243a] sm:text-3xl">
                  {user.fullName || "Your account"}
                </h2>
                <span className="rounded-full bg-[#edf2fb] px-3 py-1 text-[11px] font-medium text-[#294a9b]">
                  {roles[user.role]}
                </span>
              </div>
              <p className="mt-2 mb-0 text-sm font-medium text-[#294a9b]">
                {employee?.position ||
                  user.position ||
                  (user.role === "USER"
                    ? "Client at EXP Digital Solutions"
                    : `${roles[user.role]} at EXP Digital Solutions`)}
              </p>
              {(employee?.department || user.department) && (
                <p className="mt-2 mb-0 flex items-center gap-2 text-xs text-[#738096]">
                  <Building2 size={14} aria-hidden="true" />
                  {employee?.department?.name || user.department?.name}
                </p>
              )}
              <p className="mt-3 mb-0 text-xs text-[#738096]">
                Member since {memberSince}
              </p>
              {specialist && specialist.socialLinks.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                  {specialist.socialLinks.map((link, index) => (
                    <a
                      key={`${link.url}-${index}`}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex min-h-9 items-center gap-1.5 text-xs font-medium text-[#294a9b] no-underline hover:underline ${focusRing}`}
                    >
                      {link.platform}
                      <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                disabled={!profile}
                onClick={onEditPersonal}
                className="min-h-11 bg-[#203f8c] text-xs text-white hover:bg-[#172f70]"
              >
                <Pencil size={15} aria-hidden="true" />
                Edit profile
              </Button>
              {specialist && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 text-xs text-[#294a9b]"
                  onClick={onEditSpecialist}
                >
                  Edit specialist profile
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
      {error ? (
        <div
          role="alert"
          className="grid gap-4 rounded-xl border border-[#e1e6ee] p-6"
        >
          <p className="m-0 text-sm text-[#bc3649]">{error}</p>
          <Button
            type="button"
            variant="outline"
            className="justify-self-start"
            onClick={onRetry}
          >
            Try again
          </Button>
        </div>
      ) : !profile ? (
        <p role="status" className="p-6 text-sm text-[#52627a]">
          Loading your profile…
        </p>
      ) : (
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="grid min-w-0 gap-5">
            <Card
              title="About"
              onEdit={specialist ? onEditSpecialist : onEditPersonal}
            >
              <p className="m-0 text-sm leading-7 whitespace-pre-wrap text-[#52627a] [overflow-wrap:anywhere]">
                {specialist?.bio ||
                  (user.role === "STAFF"
                    ? "Introduce yourself, your experience, and how you help clients."
                    : "Manage your contact details and account information from your profile.")}
              </p>
            </Card>
            {user.role === "STAFF" && (
              <>
                <Card
                  title="Specialties"
                  onEdit={specialist ? onEditSpecialist : undefined}
                >
                  {specialist?.specialties.length ? (
                    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                      {specialist.specialties.map((value, index) => (
                        <li
                          key={`${value}-${index}`}
                          className="rounded-full border border-[#dce3ee] bg-[#f8faff] px-3 py-2 text-xs font-medium text-[#344b70]"
                        >
                          {value}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="m-0 text-sm leading-6 text-[#738096]">
                      Add your areas of expertise to help clients understand
                      your strengths.
                    </p>
                  )}
                </Card>
                <Card
                  title="Featured projects"
                  onEdit={specialist ? onEditSpecialist : undefined}
                >
                  {specialist?.projects.length ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {specialist.projects.map((project, index) => (
                        <article
                          key={`${project.title}-${index}`}
                          className="min-w-0 overflow-hidden rounded-xl border border-[#dce3ee] bg-background p-1.5"
                        >
                          <Photo
                            key={project.thumbnailUrl || `project-${index}`}
                            url={project.thumbnailUrl}
                            alt={project.title}
                            className="aspect-[16/10] w-full rounded-lg object-cover"
                            fallback={
                              <ImageIcon size={30} aria-hidden="true" />
                            }
                          />
                          <div className="px-2 pt-3">
                            <span className="text-[10px] font-medium text-[#738096]">
                              {project.isPublished
                                ? "Published"
                                : "Draft · only visible to you"}
                            </span>
                            <h3 className="mt-2 mb-0 line-clamp-2 text-sm leading-5 font-semibold text-[#243c69] [overflow-wrap:anywhere]">
                              {project.title}
                            </h3>
                            <p className="mt-1 mb-0 line-clamp-2 text-xs leading-5 text-[#738096]">
                              {project.summary}
                            </p>
                            <button
                              type="button"
                              aria-label={`View project: ${project.title}`}
                              onClick={() => setSelectedProject(project)}
                              className={`mt-3 flex min-h-11 w-full cursor-pointer items-center gap-2 border-t border-[#e6eaf0] text-xs font-semibold text-[#294a9b] hover:underline ${focusRing}`}
                            >
                              View project
                              <ArrowRight size={14} aria-hidden="true" />
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg bg-[#f5f8fd] p-5">
                      <p className="m-0 text-sm leading-6 text-[#738096]">
                        Highlight work you’re proud of. Add project images, a
                        short summary, and your contribution.
                      </p>
                      {specialist ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-4 min-h-11 text-xs"
                          onClick={onEditSpecialist}
                        >
                          Add featured projects
                        </Button>
                      ) : (
                        <p className="mt-3 mb-0 text-xs leading-5 text-[#738096]">
                          Ask an administrator to link your employee record to
                          enable specialist profile editing.
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              </>
            )}
          </div>
          <aside className="grid min-w-0 gap-5">
            <Card
              title="Contact information"
              onEdit={onEditPersonal}
              actionLabel="Edit contact information"
            >
              <dl className="m-0 grid gap-5 text-xs">
                <div>
                  <dt className="mb-2 flex items-center gap-2 text-[#738096]">
                    <Mail size={14} aria-hidden="true" />
                    Email
                  </dt>
                  <dd className="m-0 break-all text-[#182235]">{user.email}</dd>
                </div>
                <div>
                  <dt className="mb-2 flex items-center gap-2 text-[#738096]">
                    <Phone size={14} aria-hidden="true" />
                    Contact number
                  </dt>
                  <dd className="m-0 text-[#182235]">
                    {user.contactNumber || "Not provided"}
                  </dd>
                </div>
              </dl>
            </Card>
            {employee && (
              <Card title="Employment details">
                <dl className="m-0 grid gap-4 text-xs">
                  {[
                    ["Employee ID", employee.employeeId],
                    ["Position", employee.position],
                    ["Department", employee.department?.name],
                    ["Team", employee.team?.name],
                    [
                      "Employment type",
                      employee.employmentType
                        .replaceAll("_", " ")
                        .toLowerCase(),
                    ],
                    [
                      "Status",
                      employee.status.replaceAll("_", " ").toLowerCase(),
                    ],
                    [
                      "Start date",
                      employee.startDate
                        ? new Date(employee.startDate).toLocaleDateString(
                            "en-PH",
                          )
                        : null,
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[#738096]">{label}</dt>
                      <dd className="mt-1.5 ml-0 break-words font-medium text-[#182235]">
                        {value || "Not assigned"}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-5 mb-0 flex items-start gap-2 border-t border-[#e6eaf0] pt-4 text-[11px] leading-5 text-[#738096]">
                  <BriefcaseBusiness
                    size={14}
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  Managed by your administrator.
                </p>
              </Card>
            )}
            <Card title="Account security">
              <ShieldCheck
                size={22}
                className="mb-3 text-[#294a9b]"
                aria-hidden="true"
              />
              <p className="m-0 text-xs leading-6 text-[#738096]">
                Keep your account protected with a strong password.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={onEditSecurity}
                className="mt-4 min-h-11 w-full text-xs text-[#294a9b]"
              >
                Change password
              </Button>
              <p className="mt-4 mb-0 flex items-center gap-2 text-[11px] text-[#738096]">
                <CalendarDays size={14} aria-hidden="true" />
                Joined {memberSince}
              </p>
            </Card>
          </aside>
        </div>
      )}
      <Dialog
        open={Boolean(selectedProject)}
        onOpenChange={(open) => {
          if (!open) setSelectedProject(null)
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-32px)] w-[min(720px,calc(100vw-32px))] max-w-[720px] overflow-y-auto rounded-2xl p-6">
          {selectedProject && (
            <>
              <DialogTitle className="pr-7 text-xl">
                {selectedProject.title}
              </DialogTitle>
              <DialogDescription>
                {selectedProject.isPublished
                  ? "Featured project"
                  : "Draft project · only visible to you"}
              </DialogDescription>
              <Photo
                key={selectedProject.thumbnailUrl}
                url={selectedProject.thumbnailUrl}
                alt={selectedProject.title}
                className="aspect-video w-full rounded-xl object-contain"
                fallback={<ImageIcon size={36} aria-hidden="true" />}
              />
              <p className="m-0 text-sm leading-7 whitespace-pre-wrap text-[#52627a]">
                {selectedProject.summary}
              </p>
              {selectedProject.contribution && (
                <div>
                  <h3 className="text-sm font-semibold">My contribution</h3>
                  <p className="text-sm leading-7 whitespace-pre-wrap text-[#52627a]">
                    {selectedProject.contribution}
                  </p>
                </div>
              )}
              {selectedProject.projectUrl && (
                <Button
                  asChild
                  className="min-h-11 bg-[#203f8c] text-white hover:bg-[#172f70]"
                >
                  <a
                    href={selectedProject.projectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open project
                    <ExternalLink size={15} aria-hidden="true" />
                  </a>
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}
