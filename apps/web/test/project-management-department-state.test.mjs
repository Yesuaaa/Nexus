import assert from "node:assert/strict"
import test from "node:test"
import {
  defaultDepartmentDirectoryState,
  parseDepartmentDirectoryState,
  serializeDepartmentDirectoryState,
} from "../src/features/admin-project-management/model/department-directory-state.ts"

test("department directory state restores search, sort direction, and page from its URL", () => {
  const state = parseDepartmentDirectoryState(
    new URLSearchParams("search=%20Engineering%20&sort=projects&page=3"),
  )

  assert.deepEqual(state, {
    search: "Engineering",
    sort: "projects",
    direction: "desc",
    page: 3,
  })
  assert.equal(
    serializeDepartmentDirectoryState(state),
    "search=Engineering&sort=projects&page=3",
  )
})

test("department directory ignores the retired grid layout parameter", () => {
  const state = parseDepartmentDirectoryState(
    new URLSearchParams("search=Design&sort=projects&page=2&layout=grid"),
  )

  assert.deepEqual(state, {
    search: "Design",
    sort: "projects",
    direction: "desc",
    page: 2,
  })
  assert.equal(
    serializeDepartmentDirectoryState(state),
    "search=Design&sort=projects&page=2",
  )
})

test("department directory state rejects unsupported values and repeated keys", () => {
  assert.deepEqual(
    parseDepartmentDirectoryState(
      new URLSearchParams("search=one&search=two&sort=unsupported&page=0"),
    ),
    defaultDepartmentDirectoryState,
  )
})
