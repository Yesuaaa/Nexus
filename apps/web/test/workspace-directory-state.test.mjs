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
      "search=%20Acme%20&status=IN_PROGRESS&sort=client&view=archive&page=2&ignored=drop",
    ),
  )

  assert.deepEqual(state, {
    page: 2,
    search: "Acme",
    status: "IN_PROGRESS",
    sort: "client",
    view: "archive",
  })
  assert.equal(
    serializeWorkspaceDirectoryState(state),
    "search=Acme&status=IN_PROGRESS&sort=client&view=archive&page=2",
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
