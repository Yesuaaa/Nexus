import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { execFileSync, spawnSync } from "node:child_process"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const web = path.join(root, "apps/web")
const requireWeb = createRequire(path.join(web, "package.json"))
const ts = requireWeb("typescript")
const baselineDirectory = "docs/testing/migrations/phase4/baseline"
const mappingPath = "docs/testing/migrations/phase4/proposed-mapping.json"
const revision = "2075d354d62dd15b6d34b53600416de336eca4d6"
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex")
const read = (file) => readFileSync(path.resolve(root, file))
const json = (file) => JSON.parse(read(file).toString("utf8"))
const git = (...args) => execFileSync("git", args, { cwd: root })
const printer = ts.createPrinter({ removeComments: true })
const canonical = (node, source) =>
  printer.printNode(ts.EmitHint.Unspecified, node, source)

export function reconcile(expected, actual, key) {
  const wanted = new Set(expected.map(key))
  assert.equal(wanted.size, expected.length, "Duplicate expected identities")
  const seen = new Set()
  const duplicates = []
  for (const item of actual) {
    const id = key(item)
    if (seen.has(id)) duplicates.push(id)
    seen.add(id)
  }
  const missing = [...wanted].filter((id) => !seen.has(id))
  const unexpected = [...seen].filter((id) => !wanted.has(id))
  assert.deepEqual(
    { missing, unexpected, duplicates },
    { missing: [], unexpected: [], duplicates: [] },
    "Test identity membership changed",
  )
}

export function flatten(report) {
  assert.deepEqual(report.errors, [], "Playwright reported errors")
  function visit(suites, parents = []) {
    return suites.flatMap((suite) => {
      const chain = [...parents, suite.title]
      return [
        ...(suite.specs ?? []).flatMap((spec) =>
          spec.tests.map((test) => ({
            ...test,
            file: `apps/web/e2e/${spec.file.replaceAll("\\", "/")}`,
            line: spec.line,
            column: spec.column,
            title: spec.title,
            tags: spec.tags ?? [],
            describes: chain.slice(1),
            project: test.projectName,
          })),
        ),
        ...visit(suite.suites ?? [], chain),
      ]
    })
  }
  return visit(report.suites)
}

const identity = (test) =>
  JSON.stringify([test.project, test.file, test.describes, test.title])

function safeTarget(file) {
  assert(
    typeof file === "string" &&
      file.startsWith("apps/web/e2e/") &&
      file.endsWith(".ts") &&
      !file.split("/").includes("..") &&
      !file.includes("\\"),
    `Invalid test source path: ${file}`,
  )
}

export function loadInputs() {
  const manifest = json(`${baselineDirectory}/sha256-manifest.json`)
  const verification = json(
    `${baselineDirectory}/independent-verification.json`,
  )
  assert.equal(
    hash(read(`${baselineDirectory}/sha256-manifest.json`)),
    verification.manifestSha256,
    "U00 manifest changed",
  )
  for (const artifact of manifest.artifacts) {
    assert.equal(hash(read(artifact.preservedPath)), artifact.sha256)
  }
  const baseline = json(`${baselineDirectory}/artifacts/baseline.json`)
  const mapping = json(mappingPath)
  assert.equal(baseline.revision, revision)
  assert.equal(mapping.baselineRevision, revision)
  reconcile(baseline.tests, Object.keys(mapping.tests), (item) =>
    typeof item === "string" ? item : item.baselineId,
  )
  for (const test of baseline.tests) {
    const target = mapping.tests[test.baselineId]
    safeTarget(target)
    assert(target.endsWith(".spec.ts"))
    if (target !== test.file) assert.equal(mapping.status, "APPROVED")
  }
  const expected = baseline.tests.map((test) => ({
    ...test,
    file: mapping.tests[test.baselineId],
    describes: test.parentDescribeBlocks,
    project: test.project,
  }))
  return { baseline, mapping, expected }
}

function parseSource(file, source = read(file).toString("utf8")) {
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
}

function isExpect(node) {
  if (ts.isIdentifier(node)) return node.text === "expect"
  return (
    (ts.isCallExpression(node) || ts.isPropertyAccessExpression(node)) &&
    isExpect(node.expression)
  )
}

export function inspectSource(source) {
  const declarations = []
  const assertions = []
  const contexts = new Set()
  const variables = []
  function visit(node) {
    if (ts.isVariableDeclaration(node)) variables.push(node)
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isCallExpression(node) ||
      ts.isVariableDeclaration(node)
    )
      contexts.add(canonical(node, source))
    if (ts.isCallExpression(node)) {
      if (
        /^test(?:\.(?:only|skip|fixme))?$/.test(
          node.expression.getText(source),
        ) &&
        node.arguments.some(
          (argument) =>
            ts.isArrowFunction(argument) || ts.isFunctionExpression(argument),
        )
      )
        declarations.push(node)
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        /^to[A-Z]/.test(node.expression.name.text) &&
        isExpect(node.expression.expression)
      )
        assertions.push(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return { declarations, assertions, contexts, variables }
}

function fragment(text) {
  const declaration = /^(export\s+)?(async\s+)?function\b/.test(text)
  const file = parseSource("fragment.ts", declaration ? text : `(${text})`)
  const node = declaration
    ? file.statements[0]
    : file.statements[0].expression.expression
  return canonical(node, file)
}

export function check(
  report,
  ids,
  inputs = loadInputs(),
  readSource = (file) => read(file).toString("utf8"),
) {
  const { baseline, mapping, expected } = inputs
  const selected = ids
    ? expected.filter((test) => ids.includes(test.baselineId))
    : expected
  if (ids)
    reconcile(
      ids,
      selected.map((test) => test.baselineId),
      (id) => id,
    )
  const actual = flatten(report)
  reconcile(selected, actual, identity)
  const sources = new Map()
  const inspections = new Map()
  const source = (file) => {
    if (!sources.has(file))
      sources.set(file, parseSource(file, readSource(file)))
    return sources.get(file)
  }
  const inspection = (file) => {
    if (!inspections.has(file))
      inspections.set(file, inspectSource(source(file)))
    return inspections.get(file)
  }
  // Exact declaration AST preserves callback behavior, loop expressions and tags.
  for (const test of selected) {
    const discovered = actual.find((item) => identity(item) === identity(test))
    assert.equal(discovered.expectedStatus, test.expectedStatus)
    assert.deepEqual(
      discovered.tags,
      [],
      `New tags are not allowed: ${test.baselineId}`,
    )
    const file = source(test.file)
    const node = inspection(test.file).declarations.find((item) => {
      const location = file.getLineAndCharacterOfPosition(item.getStart(file))
      return (
        location.line + 1 === discovered.line &&
        location.character + 1 === discovered.column
      )
    })
    assert(node, `Missing declaration: ${test.baselineId}`)
    const original = parseSource("original.ts", test.testSource)
    assert.equal(
      canonical(node, file),
      canonical(original.statements[0].expression, original),
      `Declaration changed: ${test.baselineId}`,
    )
  }
  // Consume each original assertion once, by expression and occurrence, allowing
  // reviewed file moves or explicit per-site overrides when a source is split.
  const consumed = new Set()
  let assertionCount = 0
  const assertionIds = new Set(
    baseline.files.flatMap((file) => file.assertions.map((item) => item.id)),
  )
  for (const id of Object.keys(mapping.assertions))
    assert(assertionIds.has(id), `Unknown assertion: ${id}`)
  for (const original of baseline.files) {
    for (const kind of ["helpers", "hooks"]) {
      for (const [index, context] of original[kind].entries()) {
        const key = `${original.file}:${kind}:${index}`
        const target = mapping.contexts[key] ?? mapping.files[original.file]
        safeTarget(target)
        if (target !== original.file) assert.equal(mapping.status, "APPROVED")
        assert(
          inspection(target).contexts.has(fragment(context.source)),
          `Helper/hook changed: ${key}`,
        )
      }
    }
    if (original.source) {
      const originalSource = parseSource(original.file, original.source)
      for (const [index, variable] of inspectSource(
        originalSource,
      ).variables.entries()) {
        const target =
          mapping.contexts[`${original.file}:variables:${index}`] ??
          mapping.files[original.file]
        safeTarget(target)
        if (target !== original.file) assert.equal(mapping.status, "APPROVED")
        assert(
          inspection(target).contexts.has(canonical(variable, originalSource)),
          `Fixture/variable changed: ${original.file}:${index}`,
        )
      }
    }
    for (const assertion of original.assertions) {
      assert.equal(hash(assertion.source), assertion.sha256)
      const target =
        mapping.assertions[assertion.id] ?? mapping.files[original.file]
      assert(target, `Unassigned assertion: ${assertion.id}`)
      safeTarget(target)
      if (target !== original.file) assert.equal(mapping.status, "APPROVED")
      const file = source(target)
      const expression = parseSource("assertion.ts", assertion.source)
      const text = canonical(expression.statements[0].expression, expression)
      const candidate = inspection(target).assertions.find(
        (node) =>
          !consumed.has(`${target}:${node.pos}`) &&
          canonical(node, file) === text,
      )
      assert(candidate, `Missing/changed assertion: ${assertion.id}`)
      consumed.add(`${target}:${candidate.pos}`)
      assertionCount++
    }
  }
  const currentAssertionCount = [...inspections.values()].reduce(
    (sum, file) => sum + file.assertions.length,
    0,
  )
  assert.equal(
    currentAssertionCount,
    assertionCount,
    "Unexpected or duplicated assertions",
  )
  return {
    cases: actual.length,
    assertionSites: assertionCount,
    ids: selected.map((test) => test.baselineId),
  }
}

export function testList(expected) {
  return (
    expected
      .map((test) => {
        const tokens = [
          `[${test.project}]`,
          test.file.slice("apps/web/e2e/".length),
          ...test.describes,
          test.title,
        ]
        assert(
          tokens.every((token) => !/[\r\n\u203a]/.test(token)),
          "Unrepresentable test-list identity",
        )
        return tokens.join(" \u203a ")
      })
      .join("\n") + "\n"
  )
}

function write(file, value) {
  writeFileSync(
    file,
    typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n",
    { flag: "wx" },
  )
}

function sourceDigest(atRevision) {
  const inputs = [
    "apps/web/src",
    "apps/web/public",
    "apps/web/package.json",
    "apps/web/next.config.ts",
    "apps/web/postcss.config.mjs",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "patches",
  ]
  assert.equal(
    git(
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
      "--",
      ...inputs,
    ).toString(),
    "",
    "Build inputs must be clean",
  )
  const files = git("ls-tree", "-r", "--name-only", atRevision, "--", ...inputs)
    .toString("utf8")
    .trim()
    .split("\n")
  const entries = files.map((file) => [
    file,
    hash(git("show", `${atRevision}:${file}`)),
  ])
  for (const [file, expected] of entries)
    assert.equal(hash(read(file)), expected, `Build input changed: ${file}`)
  return hash(JSON.stringify(entries))
}

function repositoryDirectory(directory) {
  assert(
    !path.isAbsolute(directory),
    "Build directory must be repository-relative",
  )
  const resolved = path.resolve(root, directory)
  const relative = path.relative(root, resolved)
  assert(
    relative && !relative.startsWith("..") && !path.isAbsolute(relative),
    "Build directory must stay inside the repository",
  )
  return resolved
}

export function proofBuildDirectory(proof) {
  return repositoryDirectory(proof.buildDirectory ?? "apps/web/.next")
}

export function proofTestDirectory(proof) {
  return repositoryDirectory(proof?.testDirectory ?? "apps/web")
}

export function proofApiOrigin(proof) {
  const origin = new URL(proof.apiOrigin ?? "http://localhost:3001")
  assert(
    origin.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) &&
      !origin.username &&
      !origin.password &&
      origin.pathname === "/" &&
      !origin.search &&
      !origin.hash,
    "API rewrite must use a local HTTP origin",
  )
  return origin.origin
}

export function validateProof(proof) {
  assert.equal(proof.verification, "VERIFIED")
  assert(
    proof.reviewedBy?.trim(),
    "Build provenance must be reviewed externally",
  )
  assert.equal(proof.productionServices, false)
  assert.equal(proof.liveBackend, false)
  assert.equal(
    proof.sourceRevision,
    revision,
    "Reference build must use original source revision",
  )
  assert.equal(proof.sourceSha256, sourceDigest(proof.sourceRevision))
  const buildDirectory = proofBuildDirectory(proof)
  assert.equal(
    proof.buildId,
    read(path.join(buildDirectory, "BUILD_ID")).toString().trim(),
  )
  assert.equal(
    proof.buildId,
    read(path.join(buildDirectory, "standalone/apps/web/.next/BUILD_ID"))
      .toString()
      .trim(),
  )
  const url = new URL(proof.baseURL)
  assert(
    ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
      url.protocol === "http:",
  )
  const rewrites = json(
    path.join(buildDirectory, "routes-manifest.json"),
  ).rewrites
  const routes = Array.isArray(rewrites)
    ? rewrites
    : Object.values(rewrites).flat()
  assert(
    routes.some(
      (route) =>
        route.source === "/api/:path*" &&
        route.destination === `${proofApiOrigin(proof)}/api/:path*`,
    ),
    "Build API rewrite must target local fixtures environment",
  )
}

function executionTotals(rows) {
  const totals = { passed: 0, failed: 0, skipped: 0, unexpected: 0 }
  for (const test of rows) {
    assert.equal(
      test.results.length,
      1,
      "Expected one execution attempt, not discovery/retries",
    )
    const status = test.results[0].status
    if (status === "passed") totals.passed++
    else if (status === "skipped") totals.skipped++
    else totals.failed++
    if (test.status === "unexpected" || test.status === "flaky")
      totals.unexpected++
  }
  return totals
}

export function executionResults(report) {
  const rows = flatten(report)
  return { rows, totals: executionTotals(rows) }
}

export function compare(before, after, beforeIdentities, afterIdentities, ids) {
  const reference = executionResults(before)
  const migrated = executionResults(after)
  function attach(rows, identities) {
    if (!identities)
      return rows.map((test) => ({ ...test, baselineId: identity(test) }))
    reconcile(identities, rows, identity)
    return rows.map((test) => ({
      ...test,
      baselineId: identities.find((item) => identity(item) === identity(test))
        .baselineId,
    }))
  }
  reference.rows = attach(reference.rows, beforeIdentities)
  migrated.rows = attach(migrated.rows, afterIdentities)
  if (ids) {
    for (const result of [reference, migrated]) {
      result.rows = result.rows.filter((test) => ids.includes(test.baselineId))
      reconcile(
        ids,
        result.rows.map((test) => test.baselineId),
        (id) => id,
      )
      result.totals = executionTotals(result.rows)
    }
  }
  reconcile(reference.rows, migrated.rows, (test) => test.baselineId)
  assert.equal(
    reference.totals.failed + reference.totals.unexpected,
    0,
    "Before execution is not a passing reference",
  )
  for (const test of reference.rows) {
    const other = migrated.rows.find(
      (item) => item.baselineId === test.baselineId,
    )
    assert.equal(
      other.results[0].status,
      test.results[0].status,
      `Execution changed: ${identity(test)}`,
    )
  }
  assert.equal(
    migrated.totals.failed + migrated.totals.unexpected,
    0,
    "After execution failed",
  )
  return { before: reference.totals, after: migrated.totals }
}

export function createEvidenceDirectory(mode) {
  assert(["discovery", "execution"].includes(mode))
  const outputRoot = path.join(root, "test-results/phase4-verification")
  mkdirSync(outputRoot, { recursive: true })
  return mkdtempSync(path.join(outputRoot, `${mode}-`))
}

export function safeEnvironment(proof) {
  const env = {
    ...process.env,
    NEXUS_E2E_LIVE: "0",
    NEXUS_E2E_BASE_URL: proof?.baseURL ?? "http://127.0.0.1:5273",
  }
  for (const key of [
    "PLAYWRIGHT_JSON_OUTPUT_FILE",
    "PLAYWRIGHT_JSON_OUTPUT_DIR",
    "PLAYWRIGHT_JSON_OUTPUT_NAME",
  ])
    delete env[key]
  return env
}

export function capture(mode, ids, proof, runner = spawnSync) {
  const inputs = loadInputs()
  const selected = ids.length
    ? inputs.expected.filter((test) => ids.includes(test.baselineId))
    : inputs.expected
  reconcile(
    ids.length ? ids : inputs.expected.map((test) => test.baselineId),
    selected.map((test) => test.baselineId),
    (id) => id,
  )
  if (mode === "execution") {
    validateProof(proof)
    capture("discovery", ids, proof, runner)
  }
  const sourceRevision = git("rev-parse", "HEAD").toString().trim()
  const testDirectory = proofTestDirectory(proof)
  const testRequire = createRequire(path.join(testDirectory, "package.json"))
  const directory = createEvidenceDirectory(mode)
  const list = path.join(directory, "selection.txt")
  write(list, testList(selected))
  const args = [
    path.join(
      path.dirname(testRequire.resolve("@playwright/test/package.json")),
      "cli.js",
    ),
    "test",
    "--test-list",
    list,
    "--reporter=json",
    "--retries=0",
    "--workers=2",
    "--output",
    path.join(directory, "run-artifacts"),
  ]
  if (mode === "discovery") args.push("--list")
  const env = safeEnvironment(proof)
  const result = runner(process.execPath, args, {
    cwd: testDirectory,
    env,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  })
  write(path.join(directory, `${mode}.json`), result.stdout ?? "")
  write(path.join(directory, "stderr.txt"), result.stderr ?? "")
  write(path.join(directory, "record.json"), {
    kind: mode,
    sourceRevision,
    testDirectory: path.relative(root, testDirectory).replaceAll("\\", "/"),
    testSourceRevision: git("-C", testDirectory, "rev-parse", "HEAD")
      .toString()
      .trim(),
    baselineIds: selected.map((test) => test.baselineId),
    testIdentities: selected.map(
      ({ baselineId, file, describes, title, project }) => ({
        baselineId,
        file,
        describes,
        title,
        project,
      }),
    ),
    reportSha256: hash(result.stdout ?? ""),
    proof: proof ?? null,
    command: [process.execPath, ...args],
    exitCode: result.status,
    error: result.error?.message ?? null,
    environmentOverrides: {
      NEXUS_E2E_LIVE: "0",
      NEXUS_E2E_BASE_URL: env.NEXUS_E2E_BASE_URL,
    },
  })
  console.log(path.relative(root, directory).replaceAll("\\", "/"))
  if (mode === "execution") {
    try {
      const totals = executionResults(JSON.parse(result.stdout)).totals
      write(path.join(directory, "execution-summary.json"), totals)
      console.log(JSON.stringify(totals))
    } catch {
      console.error(
        "Execution summary unavailable; inspect preserved raw report and stderr",
      )
    }
  }
  assert.equal(
    result.status,
    0,
    "Playwright failed; attempt evidence preserved",
  )
  const report = json(path.join(directory, `${mode}.json`))
  const summary = check(
    report,
    selected.map((test) => test.baselineId),
    inputs,
  )
  if (mode === "execution") summary.execution = executionResults(report).totals
  write(path.join(directory, "verification.json"), summary)
  console.log(
    JSON.stringify({
      cases: summary.cases,
      assertionSites: summary.assertionSites,
      execution: summary.execution,
    }),
  )
}

function main([command, ...args]) {
  if (command === "discover") return capture("discovery", args)
  if (command === "check") {
    const result = check(
      json(args[0]),
      args.length > 1 ? args.slice(1) : undefined,
    )
    return console.log(
      JSON.stringify({
        cases: result.cases,
        assertionSites: result.assertionSites,
      }),
    )
  }
  if (command === "run")
    return capture("execution", args.slice(1), json(args[0]))
  if (command === "source-digest") return console.log(sourceDigest(revision))
  if (command === "compare") {
    const [beforeDirectory, afterDirectory] = args
    const selectedIds = args.length > 2 ? args.slice(2) : undefined
    assert.notEqual(path.resolve(beforeDirectory), path.resolve(afterDirectory))
    const before = json(path.join(beforeDirectory, "record.json"))
    const after = json(path.join(afterDirectory, "record.json"))
    for (const record of [before, after]) {
      assert.equal(
        record.kind,
        "execution",
        "Discovery/historical reports cannot be references",
      )
      assert.equal(record.exitCode, 0)
      assert.equal(record.proof?.verification, "VERIFIED")
      assert.equal(record.proof?.sourceRevision, revision)
    }
    for (const [directory, record] of [
      [beforeDirectory, before],
      [afterDirectory, after],
    ]) {
      assert.equal(
        hash(read(path.join(directory, "execution.json"))),
        record.reportSha256,
      )
      const verified = json(path.join(directory, "verification.json"))
      reconcile(record.baselineIds, verified.ids, (id) => id)
    }
    if (selectedIds) {
      reconcile(selectedIds, after.baselineIds, (id) => id)
      reconcile(
        selectedIds,
        before.baselineIds.filter((id) => selectedIds.includes(id)),
        (id) => id,
      )
    } else reconcile(before.baselineIds, after.baselineIds, (id) => id)
    assert.equal(before.proof.sourceSha256, after.proof.sourceSha256)
    console.log(
      JSON.stringify({
        before: executionResults(
          json(path.join(beforeDirectory, "execution.json")),
        ).totals,
        after: executionResults(
          json(path.join(afterDirectory, "execution.json")),
        ).totals,
      }),
    )
    console.log(
      JSON.stringify(
        compare(
          json(path.join(beforeDirectory, "execution.json")),
          json(path.join(afterDirectory, "execution.json")),
          before.testIdentities,
          after.testIdentities,
          selectedIds,
        ),
      ),
    )
    return
  }
  throw new Error(
    "Usage: node scripts/verify-playwright-migration.mjs discover [PW-### ...] | check <discovery.json> | source-digest | run <reviewed-proof.json> [PW-### ...] | compare <before-directory> <after-directory>",
  )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
