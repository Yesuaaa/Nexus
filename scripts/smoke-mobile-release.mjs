import { randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

function required(env, name) {
  const value = env[name]?.trim()
  if (!value)
    throw new Error(`Set ${name} before running the mobile smoke test`)
  return value
}

function apiOrigin(env) {
  const value = required(env, "NEXUS_SMOKE_BASE_URL")
  const url = new URL(value)
  if (
    url.pathname !== "/" &&
    url.pathname !== "/api" &&
    url.pathname !== "/api/"
  )
    throw new Error(
      "NEXUS_SMOKE_BASE_URL must be an origin with an optional /api suffix",
    )
  if (url.protocol !== "https:" && env.NEXUS_SMOKE_ALLOW_HTTP !== "true")
    throw new Error(
      "Smoke targets must use HTTPS unless NEXUS_SMOKE_ALLOW_HTTP=true",
    )
  url.pathname = "/"
  url.search = ""
  url.hash = ""
  return url.toString().replace(/\/$/, "")
}

function parseJson(text, step) {
  try {
    return text ? JSON.parse(text) : null
  } catch {
    throw new Error(`${step} returned invalid JSON`)
  }
}

function createClient({ baseUrl, fetchImpl, log }) {
  async function call(step, path, options = {}) {
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeout ?? 30_000,
    )
    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method: options.method ?? "GET",
        headers: {
          ...(options.token
            ? { authorization: `Bearer ${options.token}` }
            : {}),
          ...(options.body === undefined
            ? {}
            : { "content-type": "application/json" }),
        },
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
        signal: controller.signal,
      })
      const requestId = response.headers.get("x-request-id") ?? "unavailable"
      if (!response.ok)
        throw new Error(
          `${step} failed with HTTP ${response.status} (request ${requestId})`,
        )
      log(`${step}: passed (request ${requestId})`)
      if (options.binary) return { response, requestId }
      return { value: parseJson(await response.text(), step), requestId }
    } finally {
      clearTimeout(timeout)
    }
  }

  async function stream(step, path, token) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20_000)
    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        headers: { authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
      const requestId = response.headers.get("x-request-id") ?? "unavailable"
      if (!response.ok || !response.body)
        throw new Error(
          `${step} failed with HTTP ${response.status} (request ${requestId})`,
        )
      const reader = response.body.getReader()
      let text = ""
      while (!text.includes("event: connected")) {
        const chunk = await reader.read()
        if (chunk.done) break
        text += new TextDecoder().decode(chunk.value, { stream: true })
        if (text.length > 16_384) break
      }
      await reader.cancel()
      if (!text.includes("event: connected"))
        throw new Error(
          `${step} did not emit the connected event (request ${requestId})`,
        )
      log(`${step}: passed (request ${requestId})`)
    } finally {
      clearTimeout(timeout)
      controller.abort()
    }
  }

  return { call, stream }
}

async function login(client, label, email, password) {
  const { value } = await client.call(
    `${label} authentication`,
    "/api/auth/login",
    {
      method: "POST",
      body: { email, password },
    },
  )
  const token = value?.token
  if (typeof token !== "string" || !token)
    throw new Error(`${label} authentication returned no access token`)
  return token
}

async function readChecks(client, token, projectId) {
  await client.call("current account", "/api/auth/me", { token })
  await client.call("client profile", "/api/auth/profile", { token })
  const catalog = await client.call("service catalog", "/api/client/services", {
    token,
  })
  await client.call("booking history", "/api/client/service-requests?page=1", {
    token,
  })
  await client.call("request conversations", "/api/request-conversations", {
    token,
  })
  await client.call("project conversations", "/api/project-conversations", {
    token,
  })
  await client.call(
    "workflow notifications",
    "/api/request-workflows/notifications",
    {
      token,
    },
  )
  await client.call("client projects", "/api/projects", { token })
  await client.call("client calendar", "/api/projects/calendar", { token })
  await client.call("billing logs", "/api/request-workflows/billing", { token })
  if (projectId)
    await client.call(
      "project detail",
      `/api/projects/${encodeURIComponent(projectId)}`,
      {
        token,
      },
    )
  return catalog.value
}

function activeService(catalog, configuredId) {
  const services = Array.isArray(catalog?.services) ? catalog.services : []
  const service = configuredId
    ? services.find((item) => item?.id === configuredId)
    : services.find((item) => item?.isActive !== false)
  if (!service?.id)
    throw new Error("No active smoke service was found in the client catalog")
  return service
}

export async function runMobileReleaseSmoke({
  env = process.env,
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  const mode = env.NEXUS_SMOKE_MODE?.trim() || "production"
  if (mode !== "production" && mode !== "staging")
    throw new Error("NEXUS_SMOKE_MODE must be production or staging")
  const baseUrl = apiOrigin(env)
  const client = createClient({ baseUrl, fetchImpl, log })
  const clientEmail = required(env, "NEXUS_SMOKE_CLIENT_EMAIL")
  const clientPassword = required(env, "NEXUS_SMOKE_CLIENT_PASSWORD")
  const projectId = env.NEXUS_SMOKE_PROJECT_ID?.trim()

  await client.call("API health", "/api/health")
  const clientToken = await login(client, "client", clientEmail, clientPassword)
  const catalog = await readChecks(client, clientToken, projectId)
  if (mode === "production") {
    log("Production read-only mobile release smoke passed.")
    return
  }

  const headToken = await login(
    client,
    "department head",
    required(env, "NEXUS_SMOKE_HEAD_EMAIL"),
    required(env, "NEXUS_SMOKE_HEAD_PASSWORD"),
  )
  if (!projectId)
    throw new Error(
      "Set NEXUS_SMOKE_PROJECT_ID to a client-owned staging project",
    )

  const service = activeService(catalog, env.NEXUS_SMOKE_SERVICE_ID?.trim())
  const detail = await client.call(
    "service detail",
    `/api/client/services/${encodeURIComponent(service.id)}`,
    { token: clientToken },
  )
  const fullService = detail.value?.service ?? service
  const packages = Array.isArray(fullService.packages)
    ? fullService.packages
    : []
  const servicePackage = packages.find((item) => item?.isActive !== false)
  const runId = randomUUID()
  let bookingId
  let accepted = false
  let cancelled = false

  try {
    const booking = await client.call(
      "booking submission",
      "/api/client/service-requests",
      {
        method: "POST",
        token: clientToken,
        body: {
          serviceId: service.id,
          ...(servicePackage?.id ? { packageId: servicePackage.id } : {}),
          submissionKey: randomUUID(),
          goals: "Validate the deployed mobile booking contract.",
          requirements: "Release smoke record; no client production data.",
          expectedTimeline: "Smoke verification only",
          additionalDetails: `[mobile-release-smoke:${runId}]`,
        },
      },
    )
    bookingId = booking.value?.serviceRequest?.id
    if (typeof bookingId !== "string" || !bookingId)
      throw new Error("Booking submission returned no request ID")

    await client.call(
      "department acceptance",
      `/api/request-inbox/${encodeURIComponent(bookingId)}/accept`,
      { method: "POST", token: headToken },
    )
    accepted = true
    await client.stream(
      "conversation event stream",
      `/api/request-conversations/${encodeURIComponent(bookingId)}/events`,
      clientToken,
    )
    await client.call(
      "conversation message",
      `/api/request-conversations/${encodeURIComponent(bookingId)}/messages`,
      {
        method: "POST",
        token: clientToken,
        body: {
          body: `[mobile-release-smoke:${runId}] conversation delivery check`,
          bookingId,
          clientMessageId: randomUUID(),
        },
      },
    )
    const upload = await client.call(
      "workflow file upload",
      `/api/request-workflows/${encodeURIComponent(bookingId)}/files`,
      {
        method: "POST",
        token: clientToken,
        body: {
          uploadId: randomUUID(),
          name: "nexus-mobile-smoke.txt",
          mimeType: "text/plain",
          content: Buffer.from(
            `Nexus mobile release smoke ${runId}`,
            "utf8",
          ).toString("base64"),
        },
      },
    )
    const fileId = upload.value?.file?.id
    if (typeof fileId !== "string" || !fileId)
      throw new Error("Workflow upload returned no file ID")
    const download = await client.call(
      "workflow file download",
      `/api/request-workflows/${encodeURIComponent(bookingId)}/files/${encodeURIComponent(fileId)}`,
      { token: clientToken, binary: true },
    )
    await download.response.arrayBuffer()
    await client.call(
      "post-action notifications",
      "/api/request-workflows/notifications",
      {
        token: clientToken,
      },
    )
    await client.call("post-action billing", "/api/request-workflows/billing", {
      token: clientToken,
    })
    await client.call(
      "staging project read",
      `/api/projects/${encodeURIComponent(projectId)}`,
      {
        token: clientToken,
      },
    )
    const workflow = await client.call(
      "workflow refresh",
      `/api/request-workflows/${encodeURIComponent(bookingId)}`,
      { token: clientToken },
    )
    if (!Number.isSafeInteger(workflow.value?.version))
      throw new Error("Workflow refresh returned no current version")
    await client.call(
      "workflow cancellation",
      `/api/request-workflows/${encodeURIComponent(bookingId)}/actions`,
      {
        method: "POST",
        token: clientToken,
        body: {
          type: "CANCEL",
          note: `Release smoke cleanup ${runId}`,
          actionId: randomUUID(),
          expectedVersion: workflow.value.version,
        },
      },
    )
    cancelled = true
    log("Staging mobile release smoke passed and its booking was cancelled.")
  } finally {
    if (bookingId && !cancelled) {
      try {
        if (!accepted)
          await client.call(
            "failed-smoke booking cleanup",
            `/api/client/service-requests/${encodeURIComponent(bookingId)}/cancel`,
            { method: "POST", token: clientToken },
          )
        else {
          const workflow = await client.call(
            "failed-smoke workflow refresh",
            `/api/request-workflows/${encodeURIComponent(bookingId)}`,
            { token: clientToken },
          )
          if (Number.isSafeInteger(workflow.value?.version))
            await client.call(
              "failed-smoke workflow cleanup",
              `/api/request-workflows/${encodeURIComponent(bookingId)}/actions`,
              {
                method: "POST",
                token: clientToken,
                body: {
                  type: "CANCEL",
                  note: `Failed release smoke cleanup ${runId}`,
                  actionId: randomUUID(),
                  expectedVersion: workflow.value.version,
                },
              },
            )
        }
      } catch {
        log(
          `Cleanup failed for tagged smoke booking ${bookingId}; cancel it manually.`,
        )
      }
    }
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ""
if (invokedPath === fileURLToPath(import.meta.url)) {
  runMobileReleaseSmoke().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Mobile release smoke failed",
    )
    process.exitCode = 1
  })
}
