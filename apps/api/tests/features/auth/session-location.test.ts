import assert from "node:assert/strict"
import { test } from "node:test"
import {
  approximateSessionLocation,
  publicSessionIp,
  trustedProxyAddresses,
} from "../../../src/features/auth/session-location.js"

test("location uses only public addresses and explicitly trusted proxy networks", async (t) => {
  const original = process.env.SESSION_GEOLOCATION
  t.after(() => {
    if (original === undefined) delete process.env.SESSION_GEOLOCATION
    else process.env.SESSION_GEOLOCATION = original
  })
  for (const ip of [
    undefined,
    "bad",
    "127.0.0.1",
    "::1",
    "::",
    "::ffff:c000:0201",
    "2001:0db8::1",
    "10.1.2.3",
    "192.168.1.1",
    "172.16.0.1",
    "169.254.1.1",
    "100.64.0.1",
    "224.0.0.1",
    "198.51.100.1",
    "203.0.113.2",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "2002:0808:0808::1",
  ])
    assert.equal(publicSessionIp(ip), null, String(ip))
  assert.equal(publicSessionIp("8.8.8.8"), "8.8.8.8")
  assert.equal(publicSessionIp("::ffff:8.8.8.8"), "8.8.8.8")
  assert.equal(publicSessionIp("2001:4860:4860::8888"), "2001:4860:4860::8888")
  assert.equal(trustedProxyAddresses(undefined), false)
  assert.deepEqual(trustedProxyAddresses("127.0.0.1, 10.0.0.0/8"), [
    "127.0.0.1",
    "10.0.0.0/8",
  ])
  for (const config of [
    "true",
    "1",
    "192.168.0.1/33",
    "invalid",
    "::1/-1",
    "127.0.0.1,",
  ])
    assert.throws(() => trustedProxyAddresses(config))
  let calls = 0
  const mocked: typeof fetch = async (url, options) => {
    calls++
    assert.equal(url, "https://ipapi.co/8.8.8.8/json/")
    assert.equal(options?.redirect, "error")
    assert.ok(options?.signal)
    return Response.json({ city: "Quezon City", country_name: "Philippines" })
  }
  delete process.env.SESSION_GEOLOCATION
  assert.equal(await approximateSessionLocation("8.8.8.8", mocked), null)
  process.env.SESSION_GEOLOCATION = "ipapi"
  assert.equal(await approximateSessionLocation("127.0.0.1", mocked), null)
  assert.equal(calls, 0)
  assert.equal(
    await approximateSessionLocation("::ffff:8.8.8.8", mocked),
    "Quezon City, Philippines",
  )
  assert.equal(calls, 1)
  assert.equal(
    await approximateSessionLocation("8.8.8.8", async () => {
      throw new Error("unavailable")
    }),
    null,
  )
  assert.equal(
    await approximateSessionLocation(
      "8.8.8.8",
      async () => new Response("", { status: 429 }),
    ),
    null,
  )
  for (const payload of [
    null,
    [],
    { error: true },
    { city: "Example" },
    { country_name: "x".repeat(101) },
  ])
    assert.equal(
      await approximateSessionLocation("8.8.8.8", async () =>
        Response.json(payload),
      ),
      null,
    )
  assert.equal(
    await approximateSessionLocation("8.8.8.8", async () =>
      Response.json({ country_name: "Philippines" }),
    ),
    "Philippines",
  )
})
