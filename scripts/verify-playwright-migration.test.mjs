import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import {
  capture,
  check,
  compare,
  createEvidenceDirectory,
  executionResults,
  proofApiOrigin,
  proofBuildDirectory,
  proofTestDirectory,
  reconcile,
  safeEnvironment,
  testList,
  validateProof,
} from "./verify-playwright-migration.mjs"

const source = 'test("preserved", () => { expect(1).toBe(1) })'
const assertion = "expect(1).toBe(1)"
const file = "apps/web/e2e/example.spec.ts"
const sha = (text) => createHash("sha256").update(text).digest("hex")
function fixture(status = "passed") {
  const expected = {
    baselineId: "PW-001",
    file,
    describes: [],
    title: "preserved",
    project: "chromium",
    expectedStatus: "passed",
    testSource: source,
  }
  const baseline = {
    tests: [expected],
    files: [
      {
        file,
        helpers: [],
        hooks: [],
        assertions: [
          { id: "site-1", source: assertion, sha256: sha(assertion) },
        ],
      },
    ],
  }
  const mapping = {
    status: "PROPOSED",
    tests: { "PW-001": file },
    files: { [file]: file },
    assertions: {},
    contexts: {},
  }
  const report = {
    errors: [],
    suites: [
      {
        title: "example.spec.ts",
        specs: [
          {
            file: "example.spec.ts",
            line: 1,
            column: 1,
            title: "preserved",
            tests: [
              {
                projectName: "chromium",
                expectedStatus: "passed",
                status: status === "failed" ? "unexpected" : "expected",
                results: [{ status, retry: 0 }],
              },
            ],
          },
        ],
      },
    ],
  }
  return { inputs: { expected: [expected], baseline, mapping }, report }
}

test("membership accepts exact cases and rejects missing, duplicate and unexpected cases", () => {
  reconcile(["PW-001", "PW-002"], ["PW-002", "PW-001"], (id) => id)
  for (const actual of [
    ["PW-001"],
    ["PW-001", "PW-001", "PW-002"],
    ["PW-001", "PW-002", "PW-003"],
  ])
    assert.throws(() => reconcile(["PW-001", "PW-002"], actual, (id) => id))
})

test("assertions are checked by expression, not only count", () => {
  const { inputs, report } = fixture()
  assert.equal(check(report, undefined, inputs, () => source).assertionSites, 1)
  assert.throws(() =>
    check(report, undefined, inputs, () =>
      source.replace("toBe(1)", "toBe(2)"),
    ),
  )
  assert.throws(() =>
    check(report, undefined, inputs, () => source + "\nexpect(2).toBe(2)"),
  )
})

test("report verification rejects missing, duplicated and unexpected discovered identities", () => {
  for (const change of [
    (report) => {
      report.suites[0].specs = []
    },
    (report) => {
      report.suites[0].specs.push(structuredClone(report.suites[0].specs[0]))
    },
    (report) => {
      report.suites[0].specs[0].title = "unexpected expansion"
    },
  ]) {
    const { inputs, report } = fixture()
    change(report)
    assert.throws(
      () => check(report, undefined, inputs, () => source),
      /identity membership/,
    )
  }
})

test("changing fixture values is rejected without changing assertion expressions", () => {
  const { inputs, report } = fixture()
  inputs.baseline.files[0].source = source + "\nconst expected = 1"
  assert.throws(
    () =>
      check(report, undefined, inputs, () => source + "\nconst expected = 2"),
    /Fixture\/variable changed/,
  )
})

test("new describe-level or test-level tags are rejected", () => {
  const { inputs, report } = fixture()
  report.suites[0].specs[0].tags = ["@new-tag"]
  assert.throws(
    () => check(report, undefined, inputs, () => source),
    /New tags/,
  )
})

test("hook removal is rejected even when test and assertion counts match", () => {
  const { inputs, report } = fixture()
  inputs.baseline.files[0].hooks.push({
    source: "test.beforeEach(() => setup())",
  })
  assert.throws(
    () => check(report, undefined, inputs, () => source),
    /Helper\/hook changed/,
  )
})

test("reviewed file relocation preserves identity and original assertion", () => {
  const { inputs, report } = fixture()
  const target = "apps/web/e2e/module/example.spec.ts"
  inputs.mapping.status = "APPROVED"
  inputs.mapping.files[file] = target
  inputs.expected[0].file = target
  report.suites[0].specs[0].file = "module/example.spec.ts"
  assert.equal(check(report, undefined, inputs, () => source).cases, 1)
  inputs.mapping.status = "PROPOSED"
  assert.throws(() => check(report, undefined, inputs, () => source))
})

test("test-list uses full title membership, including parameterized expansions", () => {
  const { inputs } = fixture()
  const list = testList([
    inputs.expected[0],
    { ...inputs.expected[0], baselineId: "PW-002", title: "another expansion" },
  ])
  assert.equal(list.split("\n").filter(Boolean).length, 2)
  assert(list.includes("\u203a preserved"))
  assert(list.includes("\u203a another expansion"))
  assert.throws(() =>
    testList([{ ...inputs.expected[0], title: "invalid\nselection" }]),
  )
})

test("discovery cannot serve as execution evidence", () => {
  const { report } = fixture()
  report.suites[0].specs[0].tests[0].results = []
  assert.throws(() => executionResults(report), /not discovery/)
})

test("execution reports passed, failed, skipped and unexpected results", () => {
  assert.deepEqual(executionResults(fixture("passed").report).totals, {
    passed: 1,
    failed: 0,
    skipped: 0,
    unexpected: 0,
  })
  assert.deepEqual(executionResults(fixture("failed").report).totals, {
    passed: 0,
    failed: 1,
    skipped: 0,
    unexpected: 1,
  })
  assert.deepEqual(executionResults(fixture("skipped").report).totals, {
    passed: 0,
    failed: 0,
    skipped: 1,
    unexpected: 0,
  })
})

test("comparison rejects failures, new skips and a failing reference", () => {
  const passed = fixture().report
  compare(passed, structuredClone(passed))
  assert.throws(() => compare(passed, fixture("failed").report))
  assert.throws(() => compare(passed, fixture("skipped").report))
  assert.throws(() => compare(fixture("failed").report, passed))
})

test("execution comparison follows original PW identity across file relocation", () => {
  const before = fixture()
  const after = fixture()
  after.report.suites[0].specs[0].file = "module/example.spec.ts"
  const afterIdentity = {
    ...after.inputs.expected[0],
    file: "apps/web/e2e/module/example.spec.ts",
  }
  compare(before.report, after.report, before.inputs.expected, [afterIdentity])
})

test("a selected unit can use a full-suite reference without rerunning its before tests", () => {
  const before = fixture()
  const after = fixture()
  const extra = structuredClone(before.report.suites[0].specs[0])
  extra.title = "another original case"
  before.report.suites[0].specs.push(extra)
  const identities = [
    before.inputs.expected[0],
    { ...before.inputs.expected[0], baselineId: "PW-002", title: extra.title },
  ]
  const result = compare(
    before.report,
    after.report,
    identities,
    after.inputs.expected,
    ["PW-001"],
  )
  assert.equal(result.before.passed, 1)
  assert.equal(result.after.passed, 1)
  assert.throws(() =>
    compare(before.report, after.report, identities, after.inputs.expected, [
      "PW-003",
    ]),
  )
})

test("evidence directories are distinct, with exclusive writes", () => {
  const discovery = createEvidenceDirectory("discovery")
  const execution = createEvidenceDirectory("execution")
  assert.notEqual(discovery, execution)
  const output = path.join(execution, "execution.json")
  writeFileSync(output, "original", { flag: "wx" })
  assert.throws(() => writeFileSync(output, "replacement", { flag: "wx" }))
  assert.equal(readFileSync(output, "utf8"), "original")
})

test("live mode stays off and inherited reporter output paths are removed", () => {
  const before = { ...process.env }
  try {
    process.env.NEXUS_E2E_LIVE = "1"
    process.env.PLAYWRIGHT_JSON_OUTPUT_FILE = "execution.json"
    process.env.PLAYWRIGHT_JSON_OUTPUT_DIR = "unsafe"
    process.env.PLAYWRIGHT_JSON_OUTPUT_NAME = "execution.json"
    const env = safeEnvironment()
    assert.equal(env.NEXUS_E2E_LIVE, "0")
    for (const key of [
      "PLAYWRIGHT_JSON_OUTPUT_FILE",
      "PLAYWRIGHT_JSON_OUTPUT_DIR",
      "PLAYWRIGHT_JSON_OUTPUT_NAME",
    ])
      assert.equal(env[key], undefined)
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in before)) delete process.env[key]
    Object.assign(process.env, before)
  }
})

test("unverified build proof is rejected before any execution", () => {
  assert.throws(() => validateProof({ verification: "UNVERIFIED" }))
  let launched = false
  assert.throws(() =>
    capture("execution", ["PW-001"], { verification: "UNVERIFIED" }, () => {
      launched = true
    }),
  )
  assert.equal(launched, false)
})

test("proof identifies an isolated build and rejects directory escape", () => {
  const directory =
    "test-results/phase4-reference/isolated/source/apps/web/.next"
  assert.equal(
    proofBuildDirectory({ buildDirectory: directory }),
    path.resolve(directory),
  )
  assert.equal(proofBuildDirectory({}), path.resolve("apps/web/.next"))
  assert.equal(
    proofTestDirectory({ buildDirectory: directory }),
    path.resolve("apps/web"),
  )
  assert.equal(
    proofTestDirectory({
      testDirectory: "test-results/phase4-reference/isolated/source/apps/web",
    }),
    path.resolve("test-results/phase4-reference/isolated/source/apps/web"),
  )
  assert.throws(() =>
    proofTestDirectory({ testDirectory: "../outside/apps/web" }),
  )
  assert.throws(() =>
    proofBuildDirectory({ buildDirectory: "../outside/.next" }),
  )
  assert.throws(() =>
    proofBuildDirectory({ buildDirectory: path.resolve("apps/web/.next") }),
  )
})

test("proof supports a reserved local API port without permitting remote origins", () => {
  assert.equal(
    proofApiOrigin({ apiOrigin: "http://127.0.0.1:60908" }),
    "http://127.0.0.1:60908",
  )
  assert.equal(proofApiOrigin({}), "http://localhost:3001")
  for (const apiOrigin of [
    "https://api.example.com",
    "http://example.com:3001",
    "http://localhost:3001/api",
    "http://user:password@localhost:3001",
    "http://localhost:3001?target=remote",
  ])
    assert.throws(() => proofApiOrigin({ apiOrigin }))
})

test("failed launch evidence is retained", () => {
  const parent = "test-results/phase4-verification"
  const before = new Set(readdirSync(parent))
  assert.throws(
    () =>
      capture("discovery", ["PW-001"], undefined, () => ({
        status: 1,
        stdout: "failed attempt",
        stderr: "synthetic launch failure",
      })),
    /attempt evidence preserved/,
  )
  const created = readdirSync(parent).filter((name) => !before.has(name))
  assert.equal(created.length, 1)
  const directory = path.join(parent, created[0])
  assert.equal(
    readFileSync(path.join(directory, "discovery.json"), "utf8"),
    "failed attempt",
  )
  assert.equal(
    JSON.parse(readFileSync(path.join(directory, "record.json"))).exitCode,
    1,
  )
})
