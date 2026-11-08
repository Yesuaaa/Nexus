import assert from "node:assert/strict"
import test from "node:test"
import { previewTableSearch } from "../src/lib/table-search.ts"

const items = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
]
const matches = (item, query) => item.name.toLowerCase().includes(query)
const snapshots = [
  { scope: "active", query: "", page: 1, items },
  { scope: "active", query: "alpha", page: 1, items: items.slice(0, 1) },
]

test("typing, backspacing and clearing search use compatible cached rows", () => {
  assert.deepEqual(previewTableSearch(snapshots, "active", "ALPH", matches), [
    items[0],
  ])
  assert.deepEqual(previewTableSearch(snapshots, "active", "b", matches), [
    items[1],
  ])
  assert.deepEqual(previewTableSearch(snapshots, "active", "", matches), items)
  assert.deepEqual(
    previewTableSearch(snapshots, "active", "unknown", matches),
    [],
  )
})

test("filter, sort, archive and mutation scopes never share preview records", () => {
  assert.equal(
    previewTableSearch(snapshots, "archived", "alpha", matches),
    undefined,
  )
  assert.equal(
    previewTableSearch(
      [{ ...snapshots[0], page: 2 }],
      "active",
      "alpha",
      matches,
    ),
    undefined,
  )
})

test("the most specific compatible query supplies the preview", () => {
  const remote = { id: "remote", name: "Alphabet" }
  assert.deepEqual(
    previewTableSearch(
      [
        ...snapshots,
        { scope: "active", query: "alphab", page: 1, items: [remote] },
      ],
      "active",
      "alphabet",
      matches,
    ),
    [remote],
  )
})
