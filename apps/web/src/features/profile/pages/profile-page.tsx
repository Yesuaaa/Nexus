"use client"

import { FormInput, FormTextarea } from "@/components/ui/form-input"
import { formFieldClass } from "@/components/ui/form-control-styles"

import { Form } from "@/components/ui/form"

import { useId, useState, type FormEvent, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"
import { sileo } from "@/lib/toast"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ProfileOverview } from "../components/profile-overview"
import { ProfileImagesEditor } from "../components/profile-images-editor"
import { ProfileImageUpload } from "../components/profile-image-upload"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { roleLabels } from "@/features/auth/model/roles"
import {
  getProfile,
  savePersonalProfile,
  saveSpecialistProfile,
  type Profile,
  type SpecialistProfile,
  type PortfolioProject,
} from "../api/profile-api"
import { errorMessage } from "@/lib/error-message"
import { useAsyncResource } from "@/lib/use-async-resource"

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className={`${formFieldClass} content-start`}>
      {label}
      {children}
      {hint && (
        <span className="text-[11px] font-normal leading-5 text-[#738096]">
          {hint}
        </span>
      )}
    </label>
  )
}
function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-6 rounded-xl border border-[#e1e6ee] bg-background p-5 sm:p-6"
    >
      <header className="mb-6 pr-8">
        <h2 className="m-0 text-base font-semibold text-[#182235]">{title}</h2>
        <p className="mt-2 mb-0 text-xs leading-5 text-[#738096]">
          {description}
        </p>
      </header>
      {children}
    </section>
  )
}
function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <Alert variant="text" className="leading-5">
      {message}
    </Alert>
  ) : null
}

function PersonalDetails({
  profile,
  onSaved,
}: {
  profile: Profile
  onSaved: (data: Profile) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setBusy(true)
    setError("")
    try {
      onSaved(
        await savePersonalProfile(
          String(data.get("fullName")),
          String(data.get("contactNumber")),
        ),
      )
      window.dispatchEvent(new Event("nexus:account-updated"))
      sileo.success({ title: "Personal details updated" })
    } catch (reason) {
      setError(
        errorMessage(reason, "Your changes could not be saved. Try again."),
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Section
      id="personal"
      title="Personal details"
      description="Keep your name and contact information up to date."
    >
      <Form onSubmit={save} className="grid gap-5">
        <fieldset
          disabled={busy}
          className="m-0 grid min-w-0 gap-5 border-0 p-0 sm:grid-cols-2"
        >
          <Field label="Full name">
            <FormInput
              name="fullName"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              defaultValue={profile.user.fullName || ""}
            />
          </Field>
          <Field label="Contact number">
            <FormInput
              name="contactNumber"
              type="tel"
              autoComplete="tel"
              maxLength={21}
              defaultValue={profile.user.contactNumber || ""}
            />
          </Field>
          <Field
            label="Email address"
            hint="Contact an administrator to change your email address."
          >
            <FormInput type="email" readOnly value={profile.user.email} />
          </Field>
          <Field label="Account role">
            <FormInput readOnly value={roleLabels[profile.user.role]} />
          </Field>
        </fieldset>
        <ErrorMessage message={error} />
        <div className="flex justify-end border-t border-[#eceef1] pt-4">
          <Button variant="brand" size="touch" disabled={busy}>
            {busy ? "Saving…" : "Save personal details"}
          </Button>
        </div>
      </Form>
    </Section>
  )
}

function SpecialistEditor({
  specialist,
  onSaved,
  onUploadingChange,
}: {
  specialist: SpecialistProfile
  onSaved: (data: Profile) => void
  onUploadingChange: (busy: boolean) => void
}) {
  const [draft, setDraft] = useState(specialist)
  const [original, setOriginal] = useState(specialist)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [specialties, setSpecialties] = useState(
    specialist.specialties.join(", "),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const id = useId()
  function project(index: number, patch: Partial<PortfolioProject>) {
    setDraft((value) => ({
      ...value,
      projects: value.projects.map((item, at) =>
        at === index ? { ...item, ...patch } : item,
      ),
    }))
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (uploadingImage) return
    setBusy(true)
    setError("")
    try {
      const data = await saveSpecialistProfile({
        ...draft,
        updatedAt:
          JSON.stringify({ ...specialist, updatedAt: "" }) ===
          JSON.stringify({ ...original, updatedAt: "" })
            ? specialist.updatedAt
            : original.updatedAt,
        specialties: specialties
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      })
      onSaved(data)
      if (data.specialist) {
        setDraft(data.specialist)
        setOriginal(data.specialist)
      }
      sileo.success({ title: "Specialist profile updated" })
    } catch (reason) {
      setError(
        errorMessage(reason, "Your changes could not be saved. Try again."),
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Section
      id="specialist"
      title="Specialist profile"
      description="Introduce yourself to clients. Published projects, specialties, and social links appear on your specialist profile."
    >
      <Form onSubmit={save} className="grid gap-6">
        <fieldset
          disabled={busy || uploadingImage}
          className="m-0 grid min-w-0 gap-6 border-0 p-0"
        >
          <Field label="About">
            <FormTextarea
              rows={4}
              maxLength={2000}
              value={draft.bio}
              onChange={(event) =>
                setDraft({ ...draft, bio: event.target.value })
              }
            />
          </Field>
          <Field
            label="Specialties"
            hint="Separate specialties with commas. Up to 20 specialties, 80 characters each."
          >
            <FormTextarea
              rows={2}
              value={specialties}
              onChange={(event) => setSpecialties(event.target.value)}
              placeholder="Web development, UI design, Project management"
            />
          </Field>
          <div className="grid gap-4 border-t border-[#eceef1] pt-6">
            <div>
              <h3 className="m-0 text-sm font-semibold">Social links</h3>
              <p className="mt-1 mb-0 text-xs leading-5 text-[#738096]">
                Add LinkedIn, your website, or other professional accounts.
              </p>
            </div>
            {draft.socialLinks.map((link, index) => (
              <div
                key={`${id}-social-${index}`}
                className="grid gap-3 rounded-lg border border-[#e1e6ee] p-4 sm:grid-cols-[1fr_2fr_auto]"
              >
                <Field label="Platform">
                  <FormInput
                    required
                    maxLength={40}
                    value={link.platform}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        socialLinks: draft.socialLinks.map((item, at) =>
                          at === index
                            ? { ...item, platform: event.target.value }
                            : item,
                        ),
                      })
                    }
                    placeholder="LinkedIn"
                  />
                </Field>
                <Field label="URL">
                  <FormInput
                    type="url"
                    required
                    maxLength={2048}
                    value={link.url}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        socialLinks: draft.socialLinks.map((item, at) =>
                          at === index
                            ? { ...item, url: event.target.value }
                            : item,
                        ),
                      })
                    }
                    placeholder="https://…"
                  />
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 self-end text-[#bc3649]"
                  aria-label={`Remove social link ${index + 1}`}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      socialLinks: draft.socialLinks.filter(
                        (_, at) => at !== index,
                      ),
                    })
                  }
                >
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="min-h-11 justify-self-start text-xs"
              disabled={draft.socialLinks.length >= 10}
              onClick={() =>
                setDraft({
                  ...draft,
                  socialLinks: [
                    ...draft.socialLinks,
                    { platform: "", url: "" },
                  ],
                })
              }
            >
              <Plus size={15} aria-hidden="true" />
              Add social link
            </Button>
          </div>
          <div className="grid gap-4 border-t border-[#eceef1] pt-6">
            <div>
              <h3 className="m-0 text-sm font-semibold">Featured projects</h3>
              <p className="mt-1 mb-0 text-xs leading-5 text-[#738096]">
                Show your best work. Only projects marked Published are visible
                to clients.
              </p>
            </div>
            {draft.projects.map((item, index) => (
              <section
                key={`${id}-project-${index}`}
                className="grid gap-4 rounded-xl border border-[#e1e6ee] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h4 className="m-0 text-sm font-medium">
                    Project {index + 1}
                  </h4>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 text-[#bc3649]"
                    aria-label={`Remove project ${index + 1}`}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        projects: draft.projects.filter(
                          (_, at) => at !== index,
                        ),
                      })
                    }
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                </div>
                <Field label="Project title">
                  <FormInput
                    required
                    maxLength={160}
                    value={item.title}
                    onChange={(event) =>
                      project(index, { title: event.target.value })
                    }
                  />
                </Field>
                <Field label="Summary">
                  <FormTextarea
                    required
                    rows={3}
                    maxLength={3000}
                    value={item.summary}
                    onChange={(event) =>
                      project(index, { summary: event.target.value })
                    }
                  />
                </Field>
                <Field label="Your contribution">
                  <FormTextarea
                    rows={2}
                    maxLength={2000}
                    value={item.contribution}
                    onChange={(event) =>
                      project(index, { contribution: event.target.value })
                    }
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <ProfileImageUpload
                      kind="project"
                      value={item.thumbnailUrl}
                      label={`Project ${index + 1} image`}
                      onUploaded={(url) =>
                        project(index, { thumbnailUrl: url })
                      }
                      onUploadingChange={(value) => {
                        setUploadingImage(value)
                        onUploadingChange(value)
                      }}
                    />
                  </div>
                  <Field label="Project image URL">
                    <FormInput
                      type="url"
                      maxLength={2048}
                      value={item.thumbnailUrl}
                      onChange={(event) =>
                        project(index, { thumbnailUrl: event.target.value })
                      }
                      placeholder="https://…"
                    />
                  </Field>
                  <Field label="Project link">
                    <FormInput
                      type="url"
                      maxLength={2048}
                      value={item.projectUrl}
                      onChange={(event) =>
                        project(index, { projectUrl: event.target.value })
                      }
                      placeholder="https://…"
                    />
                  </Field>
                </div>
                <label className="flex min-h-11 items-center gap-3 text-xs">
                  <input
                    type="checkbox"
                    checked={item.isPublished}
                    onChange={(event) =>
                      project(index, { isPublished: event.target.checked })
                    }
                    className="size-4 accent-[#203f8c]"
                  />
                  Published · visible to clients
                </label>
              </section>
            ))}
            <Button
              type="button"
              variant="outline"
              className="min-h-11 justify-self-start text-xs"
              disabled={draft.projects.length >= 12}
              onClick={() =>
                setDraft({
                  ...draft,
                  projects: [
                    ...draft.projects,
                    {
                      title: "",
                      summary: "",
                      contribution: "",
                      thumbnailUrl: "",
                      projectUrl: "",
                      isPublished: false,
                    },
                  ],
                })
              }
            >
              <Plus size={15} aria-hidden="true" />
              Add featured project
            </Button>
          </div>
        </fieldset>
        <ErrorMessage message={error} />
        <div className="flex justify-end border-t border-[#eceef1] pt-4">
          <Button
            variant="brand"
            size="touch"
            disabled={busy || uploadingImage}
          >
            {busy
              ? "Saving…"
              : uploadingImage
                ? "Uploading image…"
                : "Save specialist profile"}
          </Button>
        </div>
      </Form>
    </Section>
  )
}

export function ProfilePage() {
  const router = useRouter()
  const account = usePortalAccount()
  const {
    data: profile = null,
    error,
    retry,
    setData: setProfile,
  } = useAsyncResource((signal) => getProfile(signal), [], {
    fallbackError: "Your changes could not be saved. Try again.",
  })
  const [uploadingImage, setUploadingImage] = useState(false)
  const [editor, setEditor] = useState<
    "personal" | "specialist" | "images" | null
  >(null)
  const user = profile?.user || account
  const saved = (data: Profile) => {
    setProfile(data)
    setEditor(null)
  }
  return (
    <>
      <ProfileOverview
        user={user}
        profile={profile}
        error={error}
        onRetry={retry}
        onEditPersonal={() => setEditor("personal")}
        onEditSpecialist={() => setEditor("specialist")}
        onEditSecurity={() => router.push("/settings")}
        onEditImages={() => setEditor("images")}
      />
      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open && !uploadingImage) setEditor(null)
        }}
      >
        <DialogContent
          onEscapeKeyDown={(event) => {
            if (uploadingImage) event.preventDefault()
          }}
          onPointerDownOutside={(event) => {
            if (uploadingImage) event.preventDefault()
          }}
          className="max-h-[calc(100dvh-32px)] w-[min(820px,calc(100vw-32px))] max-w-[820px] overflow-y-auto rounded-2xl p-0"
        >
          <DialogTitle className="sr-only">
            {editor === "images"
              ? "Profile photo & banner"
              : editor === "specialist"
                ? "Edit specialist profile"
                : "Edit personal details"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Update your profile information and save your changes.
          </DialogDescription>
          <div className="[&>section]:rounded-none [&>section]:border-0">
            {editor === "images" && profile && (
              <ProfileImagesEditor
                profile={profile}
                onApplied={setProfile}
                onClose={() => setEditor(null)}
                onUploadingChange={setUploadingImage}
              />
            )}
            {editor === "personal" && profile && (
              <PersonalDetails profile={profile} onSaved={saved} />
            )}
            {editor === "specialist" && profile?.specialist && (
              <SpecialistEditor
                specialist={profile.specialist}
                onSaved={saved}
                onUploadingChange={setUploadingImage}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
