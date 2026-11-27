export const defaultShowcaseLayout = "single-wide"

export const showcaseImageLayouts = [
  {
    id: defaultShowcaseLayout,
    count: 1,
    label: "Wide",
    ratio: "16 / 9",
    rows: ["a"],
  },
  {
    id: "single-square",
    count: 1,
    label: "Square",
    ratio: "1",
    rows: ["a"],
    maxWidth: 720,
  },
  {
    id: "single-portrait",
    count: 1,
    label: "Portrait",
    ratio: "3 / 4",
    rows: ["a"],
    maxWidth: 500,
  },
  {
    id: "pair-equal",
    count: 2,
    label: "Side by side",
    ratio: "2 / 1",
    rows: ["a b"],
  },
  {
    id: "pair-lead",
    count: 2,
    label: "Wide left",
    ratio: "2 / 1",
    rows: ["a a b"],
  },
  {
    id: "pair-stacked",
    count: 2,
    label: "Stacked",
    ratio: "1",
    rows: ["a", "b"],
  },
  {
    id: "trio-equal",
    count: 3,
    label: "Three across",
    ratio: "3 / 1",
    rows: ["a b c"],
  },
  {
    id: "trio-lead-left",
    count: 3,
    label: "Lead on the left",
    ratio: "3 / 2",
    rows: ["a a b", "a a c"],
  },
  {
    id: "trio-lead-top",
    count: 3,
    label: "Lead on top",
    ratio: "4 / 3",
    rows: ["a a", "b c"],
  },
  {
    id: "quad-grid",
    count: 4,
    label: "Two by two",
    ratio: "3 / 2",
    rows: ["a b", "c d"],
  },
  {
    id: "quad-lead-top",
    count: 4,
    label: "Lead above three",
    ratio: "4 / 3",
    rows: ["a a a", "a a a", "b c d"],
  },
  {
    id: "quad-lead-left",
    count: 4,
    label: "Lead beside three",
    ratio: "3 / 2",
    rows: ["a a b", "a a c", "a a d"],
  },
  {
    id: "five-balanced",
    count: 5,
    label: "Two above three",
    ratio: "3 / 2",
    rows: ["a a a b b b", "c c d d e e"],
  },
  {
    id: "five-lead-top",
    count: 5,
    label: "Lead above four",
    ratio: "4 / 3",
    rows: ["a a a a", "a a a a", "b c d e"],
  },
  {
    id: "five-lead-left",
    count: 5,
    label: "Lead beside four",
    ratio: "3 / 2",
    rows: ["a a b c", "a a d e"],
  },
] as const

export type ShowcaseImageLayout = (typeof showcaseImageLayouts)[number]

export function isShowcaseImage(value: string) {
  if (/^\/landing\/[a-z0-9-]+\.webp$/.test(value)) return true
  if (/^\/api\/service-images\/[a-f0-9-]{36}\.webp$/.test(value)) return true
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      /^[a-z0-9]+\.supabase\.(co|com)$/.test(url.hostname) &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^\/storage\/v1\/object\/public\/.+\.(jpe?g|png|webp)$/i.test(
        url.pathname,
      )
    )
  } catch {
    return false
  }
}
