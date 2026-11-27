"use client"

import { useState, type FormEvent } from "react"
import { flushSync } from "react-dom"
import { sileo } from "@/lib/toast"
import { Checkbox } from "@/components/ui/checkbox"
import { Form } from "@/components/ui/form"
import { formFieldClass } from "@/components/ui/form-control-styles"
import { FormInput, FormTextarea } from "@/components/ui/form-input"
import { FilterSelect } from "@/components/ui/filter-select"
import {
  SidePanel,
  SidePanelBody,
  SidePanelButton,
  SidePanelFieldset,
  SidePanelFooter,
  SidePanelHeader,
  useSidePanel,
} from "@/components/ui/side-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiRequest } from "@/features/auth/api/auth-api"
import { errorMessage } from "@/lib/error-message"
import { useAsyncResource } from "@/lib/use-async-resource"
import { listServices } from "@/features/services/api/services-api"
import { showcaseImageLayouts } from "../model/showcase-images"
import type {
  ShowcaseEntry,
  ShowcaseEntryInput,
} from "../model/showcase-projects"
import { ShowcaseImagesFields } from "./showcase-images-fields"

export function ShowcaseEntryPanel({
  entry,
  nextPosition,
  onClose,
  onSaved,
}: {
  entry: ShowcaseEntry | null
  nextPosition: number
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [processingImage, setProcessingImage] = useState(false)
  const [tab, setTab] = useState("details")
  const [service, setService] = useState(entry?.type ?? "")
  const services = useAsyncResource((signal) => listServices(signal), [], {
    fallbackError: "Couldn't load services.",
  })
  const [layout, setLayout] = useState(
    () =>
      showcaseImageLayouts.find(({ id }) => id === entry?.galleryLayout) ??
      showcaseImageLayouts[0],
  )
  const [images, setImages] = useState(() =>
    Array.from(
      { length: 5 },
      (_, index) =>
        (index === 0 ? entry?.image : entry?.additionalImages?.[index - 1]) ??
        "",
    ),
  )
  const panel = useSidePanel(onClose)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || processingImage) return
    if (!service || services.loading || services.error) {
      setTab("details")
      sileo.error({
        title: services.error || "Select a service before saving.",
      })
      return
    }
    const missing = images
      .slice(0, layout.count)
      .findIndex((image) => !image.trim())
    if (missing !== -1) {
      setTab("images")
      sileo.error({
        title: `Upload ${missing === 0 ? "a cover image" : `image ${missing + 1}`} before saving.`,
      })
      return
    }
    const form = new FormData(event.currentTarget)
    const read = (name: string) => String(form.get(name) ?? "").trim()
    const year = read("year")
    const input: ShowcaseEntryInput = {
      name: read("name"),
      slug: read("slug"),
      client: read("client"),
      type: service,
      description: read("description"),
      image: images[0].trim(),
      galleryLayout: layout.id,
      additionalImages: images
        .slice(1, layout.count)
        .map((image) => image.trim()),
      year: year ? Number(year) : null,
      position: entry?.position ?? nextPosition,
      published: form.has("published"),
      featured: form.has("featured"),
      fictional: form.has("fictional"),
    }
    setSaving(true)
    try {
      await apiRequest(
        entry
          ? `/api/project-showcase/${encodeURIComponent(entry.id)}`
          : "/api/project-showcase",
        {
          method: entry ? "PATCH" : "POST",
          body: JSON.stringify(
            entry ? { ...input, version: entry.version } : input,
          ),
        },
      )
      onSaved()
      panel.close()
    } catch (cause) {
      sileo.error({
        title: errorMessage(cause, "Couldn't save the showcase project."),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <SidePanel
      open={panel.open}
      onOpenChange={panel.onOpenChange}
      busy={saving}
      dismissible={false}
    >
      <SidePanelHeader
        title={entry ? "Edit showcase project" : "Add showcase project"}
        description={
          entry?.name ?? "Set up the project and choose where it appears."
        }
        closeDisabled={saving}
      />
      <Form
        onSubmit={save}
        onSubmitCapture={(event) => {
          const invalid = event.currentTarget.querySelector(
            "input:invalid, textarea:invalid, select:invalid",
          )
          const invalidTab = invalid
            ?.closest("[data-showcase-tab]")
            ?.getAttribute("data-showcase-tab")
          // Reveal a hidden field before the shared form validation focuses it.
          if (invalidTab && invalidTab !== tab)
            flushSync(() => setTab(invalidTab))
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <Tabs
          value={tab}
          onValueChange={setTab}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList variant="underline" aria-label="Project showcase editor">
            <TabsTrigger variant="underline" value="details" disabled={saving}>
              Details
            </TabsTrigger>
            <TabsTrigger variant="underline" value="images" disabled={saving}>
              Images
            </TabsTrigger>
          </TabsList>
          <SidePanelBody className="min-w-0 grid-cols-1">
            <TabsContent
              forceMount
              value="details"
              data-showcase-tab="details"
              className="mt-0 min-w-0 data-[state=inactive]:hidden"
            >
              <fieldset disabled={saving} className="grid min-w-0 gap-5">
                <SidePanelFieldset title="Project details" className="gap-y-4">
                  <label className={formFieldClass}>
                    Project title
                    <FormInput
                      name="name"
                      required
                      maxLength={120}
                      defaultValue={entry?.name}
                    />
                  </label>
                  <label className={formFieldClass}>
                    Page address
                    <FormInput
                      name="slug"
                      required
                      maxLength={100}
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      placeholder="project-name"
                      defaultValue={entry?.slug}
                    />
                  </label>
                  <label className={formFieldClass}>
                    Client
                    <FormInput
                      name="client"
                      required
                      maxLength={120}
                      defaultValue={entry?.client}
                    />
                  </label>
                  <div className={formFieldClass}>
                    <span>Service</span>
                    <FilterSelect
                      label="Service"
                      value={service}
                      onChange={setService}
                      placeholder={
                        services.loading
                          ? "Loading services…"
                          : "Select a service"
                      }
                      disabled={
                        saving || services.loading || Boolean(services.error)
                      }
                      options={[
                        ...(entry &&
                        !services.data?.some((item) => item.name === entry.type)
                          ? [
                              {
                                value: entry.type,
                                label: `${entry.type} (previously selected)`,
                              },
                            ]
                          : []),
                        ...(services.data ?? []).map((item) => ({
                          value: item.name,
                          label: item.isActive
                            ? item.name
                            : `${item.name} (inactive)`,
                        })),
                      ]}
                      triggerClassName="h-10 w-full border-[#d6dfec] text-sm shadow-none max-[560px]:h-10"
                      className="w-full"
                    />
                    {services.error && (
                      <button
                        type="button"
                        onClick={services.retry}
                        className="text-left text-xs text-[#203f8c] underline"
                      >
                        Retry loading services
                      </button>
                    )}
                  </div>
                  <label className={formFieldClass}>
                    Year (optional)
                    <FormInput
                      name="year"
                      type="number"
                      min={1900}
                      max={9999}
                      defaultValue={entry?.year ?? undefined}
                    />
                  </label>
                  <label className={`${formFieldClass} sm:col-span-2`}>
                    Description
                    <FormTextarea
                      name="description"
                      required
                      maxLength={4000}
                      defaultValue={entry?.description}
                    />
                  </label>
                </SidePanelFieldset>
                <SidePanelFieldset
                  title="Publishing"
                  className="gap-y-3 sm:grid-cols-1"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      name="published"
                      defaultChecked={entry?.published}
                    />{" "}
                    Publish on the projects page
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      name="featured"
                      defaultChecked={entry?.featured}
                    />{" "}
                    Feature on the homepage when published
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      name="fictional"
                      defaultChecked={entry?.fictional}
                    />{" "}
                    Label as a fictional example
                  </label>
                </SidePanelFieldset>
              </fieldset>
            </TabsContent>
            <TabsContent
              forceMount
              value="images"
              data-showcase-tab="images"
              className="mt-0 min-w-0 data-[state=inactive]:hidden"
            >
              <fieldset disabled={saving} className="min-w-0">
                <ShowcaseImagesFields
                  layout={layout}
                  images={images}
                  onLayoutChange={setLayout}
                  onProcessingChange={setProcessingImage}
                  onImageChange={(index, value) => {
                    setImages((current) =>
                      current.map((image, slot) =>
                        slot === index ? value : image,
                      ),
                    )
                  }}
                  disabled={saving || processingImage}
                />
              </fieldset>
            </TabsContent>
          </SidePanelBody>
        </Tabs>
        <SidePanelFooter>
          <SidePanelButton
            variant="secondary"
            disabled={saving}
            onClick={() => panel.close()}
          >
            Cancel
          </SidePanelButton>
          <SidePanelButton type="submit" disabled={saving || processingImage}>
            {saving ? "Saving…" : entry ? "Save changes" : "Save project"}
          </SidePanelButton>
        </SidePanelFooter>
      </Form>
    </SidePanel>
  )
}
