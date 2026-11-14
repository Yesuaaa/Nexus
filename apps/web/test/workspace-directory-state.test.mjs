import assert from "node:assert/strict"
import test from "node:test"
import {
  defaultWorkspaceDirectoryState,
  parseWorkspaceDirectoryState,
  serializeWorkspaceDirectoryState,
  workspaceDirectoryHref,
} from "../src/features/project-workspace/model/workspace-directory-state.ts"

test("workspace directory URL state parses and serializes one canonical filter set", () => {
  const state = parseWorkspaceDirectoryState(
    new URLSearchParams(
      "search=%20Acme%20&status=IN_PROGRESS&sort=client&view=archive&page=2&departmentId=design-1&ignored=drop",
    ),
  )

  assert.deepEqual(state, {
    page: 2,
    departmentId: "design-1",
    search: "Acme",
    status: "IN_PROGRESS",
    sort: "client",
    view: "archive",
  })
  assert.equal(
    serializeWorkspaceDirectoryState(state),
    "search=Acme&departmentId=design-1&status=IN_PROGRESS&sort=client&view=archive&page=2",
  )
})

test("company directory links keep the department filter on its own route", () => {
  const state = {
    ...defaultWorkspaceDirectoryState,
    departmentId: "design-1",
    page: 2,
  }

  assert.equal(
    workspaceDirectoryHref(state, "/project-management"),
    "/project-management?departmentId=design-1&page=2",
  )
})

test("unsupported and repeated directory parameters reset safely", () => {
  const state = parseWorkspaceDirectoryState(
    new URLSearchParams(
      "search=one&search=two&status=UNKNOWN&sort=bad&view=all&page=0&ignored=yes",
    ),
  )

  assert.deepEqual(state, defaultWorkspaceDirectoryState)
  assert.equal(serializeWorkspaceDirectoryState(state), "")
})

test("directory detail and Management links preserve canonical state", () => {
  const state = {
    ...defaultWorkspaceDirectoryState,
    page: 3,
    search: "Campaign",
    status: "ON_HOLD",
  }

  assert.equal(
    workspaceDirectoryHref(state),
    "/project-workspace?search=Campaign&status=ON_HOLD&page=3",
  )
})

test("Staff workspace sort and filters survive typed detail navigation", () => {
  const state = parseWorkspaceDirectoryState(
    new URLSearchParams(
      "search=Brand%20campaign&status=ON_HOLD&sort=most-active&view=active",
    ),
  )

  assert.deepEqual(state, {
    page: 1,
    departmentId: "",
    search: "Brand campaign",
    status: "ON_HOLD",
    sort: "most-active",
    view: "active",
  })
  assert.equal(
    workspaceDirectoryHref(state),
    "/project-workspace?search=Brand+campaign&status=ON_HOLD&sort=most-active",
  )
})
