export type ShowcaseCard = {
  slug: string
  name: string
  client: string
  type: string
  image: string
  fictional: boolean
}

export type ShowcaseProject = ShowcaseCard & {
  year: number | null
  description: string
  galleryLayout: string
  additionalImages: string[]
}

export type ShowcaseEntryInput = ShowcaseProject & {
  position: number
  published: boolean
  featured: boolean
}

export type ShowcaseEntry = ShowcaseEntryInput & {
  id: string
  version: number
  archivedAt: string | null
}
