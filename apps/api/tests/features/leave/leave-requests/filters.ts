import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import type { LeaveContext } from "./context.js"

/** List search, status, type and date filters. */
export async function listFilters({
  api,
  employee,
  account,
  action,
  head,
  admin,
  submit,
}: LeaveContext) {
  const filtered = await api(
    employee,
    "/leave/requests?scope=mine&from=2026-12-01&to=2026-12-02",
  )
  assert.equal(((await filtered.json()) as { total: number }).total, 0)

  // PG-011-F001-A004-T002 and A005-T002: search is normalized, scoped to
  // supported text fields, bounded, and combined with the API filters.
  const searchActor = await account("pg011-searcher", "STAFF")
  const searchable = await api(searchActor, "/leave/requests", {
    body: {
      requestKey: randomUUID(),
      type: "SICK",
      reason: "Search Needle phrase",
      startDate: "2026-12-08",
      endDate: "2026-12-08",
    },
  })
  assert.equal(searchable.status, 201, await searchable.clone().text())
  const searchableId = (
    (await searchable.json()) as { request: { id: string } }
  ).request.id
  assert.equal((await action(head, searchableId, "verify", 1)).status, 200)
  assert.equal((await action(admin, searchableId, "approve", 2)).status, 200)
  for (const value of ["needle", "pg011-searcher", "LEAVE-pg011-searcher"]) {
    const result = await api(
      searchActor,
      `/leave/requests?scope=mine&search=${encodeURIComponent(value)}`,
    )
    assert.equal(result.status, 200, await result.clone().text())
    assert.equal(((await result.json()) as { total: number }).total, 1, value)
  }
  const maximumSearch = await api(
    searchActor,
    `/leave/requests?scope=mine&search=${"x".repeat(100)}`,
  )
  assert.equal(maximumSearch.status, 200)
  assert.equal(
    (
      await api(
        searchActor,
        `/leave/requests?scope=mine&search=${"x".repeat(101)}`,
      )
    ).status,
    400,
  )
  const combinedFilters = await api(
    searchActor,
    "/leave/requests?scope=mine&type=SICK&status=APPROVED",
  )
  assert.equal(combinedFilters.status, 200)
  assert.deepEqual(
    (
      (await combinedFilters.json()) as {
        requests: { id: string }[]
        total: number
      }
    ).requests.map(({ id }) => id),
    [searchableId],
  )
  assert.equal(
    (await api(searchActor, "/leave/requests?scope=mine&type=VACATION")).status,
    400,
  )
  assert.equal(
    (await api(searchActor, "/leave/requests?scope=mine&status=UNKNOWN"))
      .status,
    400,
  )

  // PG-011-F001-A006-T001: API date filters include request endpoints,
  // require paired ordered values, and accept overlap at either boundary.
  const dateActor = await account("pg011-date-filter", "STAFF")
  const dateIds: string[] = []
  for (const [startDate, endDate] of [
    ["2026-12-10", "2026-12-10"],
    ["2026-12-11", "2026-12-12"],
    ["2026-12-14", "2026-12-14"],
  ]) {
    dateIds.push((await submit(startDate, endDate, dateActor)).request.id)
  }
  const dateWindow = await api(
    dateActor,
    "/leave/requests?scope=mine&from=2026-12-10&to=2026-12-12",
  )
  assert.equal(dateWindow.status, 200)
  const dateWindowBody = (await dateWindow.json()) as {
    requests: { id: string }[]
  }
  assert.deepEqual(
    dateWindowBody.requests.map(({ id }) => id).sort(),
    dateIds.slice(0, 2).sort(),
  )
  const inclusiveEnd = await api(
    dateActor,
    "/leave/requests?scope=mine&from=2026-12-12&to=2026-12-12",
  )
  assert.deepEqual(
    (
      (await inclusiveEnd.json()) as { requests: { id: string }[] }
    ).requests.map(({ id }) => id),
    [dateIds[1]],
  )
  // The 366-day limit applies to one leave request, not to searching.
  const longWindow = await api(
    dateActor,
    "/leave/requests?scope=mine&from=2025-01-01&to=2027-12-31",
  )
  assert.equal(longWindow.status, 200)
  assert.deepEqual(
    ((await longWindow.json()) as { requests: { id: string }[] }).requests
      .map(({ id }) => id)
      .sort(),
    [...dateIds].sort(),
  )
  for (const query of [
    "/leave/requests?scope=mine&from=2026-12-10",
    "/leave/requests?scope=mine&to=2026-12-12",
    "/leave/requests?scope=mine&from=2026-12-13&to=2026-12-10",
  ]) {
    assert.equal((await api(dateActor, query)).status, 400, query)
  }
}
