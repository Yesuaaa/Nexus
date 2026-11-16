import assert from "node:assert/strict"
import { test } from "node:test"
import { spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  offlineEnvironment,
  loopbackOrigin,
} from "../scripts/offline-environment.mjs"

test("offline process environment strips credentials, live settings and inherited worker markers", () => {
  const env = offlineEnvironment(
    {},
    {
      PATH: "tool-path",
      DATABASE_URL: "synthetic-secret",
      DIRECT_URL: "synthetic-secret",
      JWT_SECRET: "synthetic-secret",
      SUPABASE_SECRET_KEY: "synthetic-secret",
      NEXT_PUBLIC_API_URL: "https://untrusted.invalid",
      NEXUS_E2E_LIVE: "1",
      NODE_TEST_CONTEXT: "inherited",
      NODE_OPTIONS: "untrusted",
    },
  )
  assert.equal(env.PATH, "tool-path")
  for (const key of [
    "DATABASE_URL",
    "DIRECT_URL",
    "JWT_SECRET",
    "SUPABASE_SECRET_KEY",
    "NEXUS_E2E_LIVE",
    "NODE_TEST_CONTEXT",
  ])
    assert.equal(env[key], undefined)
  assert.equal(env.NEXT_PUBLIC_API_URL, "")
  assert.ok(env.NODE_OPTIONS.includes("offline-env-guard.mjs"))
  assert.throws(
    () => offlineEnvironment({ NODE_TEST_CONTEXT: "manual" }),
    /Only native Node/,
  )
})

test("offline preload denies env-file IO before loaders while ordinary files remain readable", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "nexus-offline-env-"))
  const hidden = path.join(dir, ".env.synthetic")
  const plain = path.join(dir, "plain.txt")
  const template = path.join(dir, ".env.example")
  writeFileSync(hidden, "SYNTHETIC_ONLY=do-not-load")
  writeFileSync(plain, "ordinary fixture")
  writeFileSync(template, "public template")
  try {
    const child = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
      import assert from 'node:assert/strict';
      import {readFileSync, statSync} from 'node:fs';
      import {readFile} from 'node:fs/promises';
      const file = process.argv[1];
      assert.throws(() => readFileSync(file), {code:'ENOENT'});
      assert.throws(() => statSync(file), {code:'ENOENT'});
      await assert.rejects(readFile(file), {code:'ENOENT'});
      assert.throws(() => process.loadEnvFile(file), {code:'ENOENT'});
      assert.equal(readFileSync(process.argv[2], 'utf8'), 'ordinary fixture');
      assert.equal(readFileSync(process.argv[3], 'utf8'), 'public template');
      assert.throws(() => process.loadEnvFile(process.argv[3]), {code:'ENOENT'});
      process.stdout.write('guarded');`,
        hidden,
        plain,
        template,
      ],
      { env: offlineEnvironment(), encoding: "utf8", windowsHide: true },
    )
    assert.equal(child.status, 0, child.stderr)
    assert.equal(child.stdout, "guarded")
  } finally {
    unlinkSync(hidden)
    unlinkSync(plain)
    unlinkSync(template)
    rmdirSync(dir)
  }
})

test("offline origins reject external, implicit, credentialed and path-bearing targets", () => {
  assert.equal(loopbackOrigin("http://127.0.0.1:5273"), "http://127.0.0.1:5273")
  for (const value of [
    "http://localhost:5273",
    "https://example.com",
    "http://127.0.0.1",
    "http://user:secret@127.0.0.1:5273",
    "http://127.0.0.1:5273/path",
  ])
    assert.throws(() => loopbackOrigin(value))
})
