import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { flatten } from "./verify-playwright-migration.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const [proofArgument, ...ids] = process.argv.slice(2)
assert(
  proofArgument && ids.length && ids.every((id) => /^PW-\d{3}$/.test(id)),
  "Usage: node scripts/check-playwright-migration.mjs <reviewed-proof.json> PW-### ...",
)
assert.equal(new Set(ids).size, ids.length, "Duplicate selected IDs")
const proof = JSON.parse(
  readFileSync(path.resolve(root, proofArgument), "utf8"),
)
const parent = path.join(root, "test-results/phase4-migration")
mkdirSync(parent, { recursive: true })
const directory = mkdtempSync(path.join(parent, "check-"))
const relative = (file) => path.relative(root, file).replaceAll("\\", "/")
const save = (file, value) =>
  writeFileSync(
    path.join(directory, file),
    typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n",
    { flag: "wx" },
  )
const result = {
  decision: "INCOMPLETE",
  proof: proofArgument,
  ids,
  evidenceDirectory: relative(directory),
  steps: [],
}
const verifier = path.join(root, "scripts/verify-playwright-migration.mjs")
const nativePnpm = path.join(
  process.env.APPDATA ?? "",
  "npm/node_modules/pnpm/pnpm.exe",
)
const pnpm =
  process.platform === "win32"
    ? existsSync(nativePnpm)
      ? nativePnpm
      : "pnpm.cmd"
    : "pnpm"
const env = {
  ...process.env,
  NEXUS_E2E_LIVE: "0",
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_API_URL: "",
  API_PROXY_TARGET: proof.apiOrigin ?? "http://localhost:3001",
  DATABASE_URL:
    "postgresql://verification:verification@127.0.0.1:1/verification",
  DIRECT_URL: "postgresql://verification:verification@127.0.0.1:1/verification",
}

function step(name, executable, args) {
  const started = Date.now()
  const command = spawnSync(executable, args, {
    cwd: root,
    env,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    shell: executable === "pnpm.cmd",
  })
  save(`${name}.stdout.log`, command.stdout ?? "")
  save(`${name}.stderr.log`, command.stderr ?? "")
  result.steps.push({
    name,
    command: [executable, ...args],
    exitCode: command.status,
    durationMs: Date.now() - started,
    error: command.error?.message ?? null,
  })
  console.log(`${name}: ${command.status === 0 ? "PASS" : "FAIL"}`)
  assert.equal(
    command.status,
    0,
    `${name} failed; evidence: ${relative(directory)}`,
  )
  return command.stdout
}

try {
  console.log(`Evidence: ${relative(directory)}`)
  const discovery = step("global-discovery", process.execPath, [
    verifier,
    "discover",
  ])
  const summary = JSON.parse(discovery.trim().split(/\r?\n/).at(-1))
  assert.equal(summary.cases, 292)
  assert.equal(summary.assertionSites, 1630)
  result.globalDiscovery = discovery
    .split(/\r?\n/)
    .find((line) =>
      line.startsWith("test-results/phase4-verification/discovery-"),
    )
  const discovered = flatten(
    JSON.parse(
      readFileSync(
        path.join(root, result.globalDiscovery, "discovery.json"),
        "utf8",
      ),
    ),
  )
  assert.equal(
    discovered.filter((test) => test.expectedStatus === "skipped").length,
    5,
  )
  assert(
    discovered
      .filter((test) => test.file.endsWith("/regression-live.spec.ts"))
      .every((test) => test.expectedStatus === "skipped"),
  )
  result.liveExpectedSkips = 5
  // The verifier hashes all U00 artifacts, including CSV and baseline JSON, and
  // checks every current declaration, assertion and helper against that baseline.
  // Reconcile its immutable original per-case assertion bindings as well.
  const baseline = JSON.parse(
    readFileSync(
      path.join(
        root,
        "docs/testing/migrations/phase4/baseline/artifacts/baseline.json",
      ),
      "utf8",
    ),
  )
  const sites = new Set(
    baseline.files.flatMap((file) => file.assertions.map((site) => site.id)),
  )
  const bindings = baseline.tests.flatMap((test) =>
    ["direct", "helpersAndHooks"].flatMap((scope) =>
      test.assertionPreservation[scope].map((site) => {
        assert(sites.has(site))
        return JSON.stringify([test.baselineId, scope, site])
      }),
    ),
  )
  assert.equal(bindings.length, 4211)
  assert.equal(new Set(bindings).size, 4211)
  result.preservationMappings = bindings.length
  const execution = step("selected-execution", process.execPath, [
    verifier,
    "run",
    proofArgument,
    ...ids,
  ])
  const executionDirectories = execution
    .split(/\r?\n/)
    .filter((line) =>
      line.startsWith("test-results/phase4-verification/execution-"),
    )
  assert.equal(executionDirectories.length, 1)
  result.executionDirectory = executionDirectories[0]
  result.executionResults = JSON.parse(
    readFileSync(
      path.join(root, result.executionDirectory, "verification.json"),
      "utf8",
    ),
  ).execution
  const reference =
    proof.acceptedReferenceExecution ??
    "test-results/phase4-verification/execution-xt00qz"
  const comparison = step("reference-comparison", process.execPath, [
    verifier,
    "compare",
    reference,
    result.executionDirectory,
    ...ids,
  ])
  result.comparison = JSON.parse(comparison.trim().split(/\r?\n/).at(-1))
  for (const gate of ["format", "lint", "typecheck"]) step(gate, pnpm, [gate])
  result.decision = "COMPLETED"
} catch (error) {
  result.decision = "FAILED"
  result.error = error instanceof Error ? error.message : String(error)
  console.error(result.error)
  process.exitCode = 1
} finally {
  save("result.json", result)
  console.log(`Result: ${relative(path.join(directory, "result.json"))}`)
}
