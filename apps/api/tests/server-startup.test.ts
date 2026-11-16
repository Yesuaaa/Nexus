import assert from "node:assert/strict"
import { test } from "node:test"
import { validateProductionDatabaseConfig } from "../src/server.js"

test("production startup requires a valid PostgreSQL DATABASE_URL", () => {
  assert.throws(
    () => validateProductionDatabaseConfig({ NODE_ENV: "production" }),
    /DATABASE_URL or DIRECT_URL must be configured/,
  )
  assert.throws(
    () =>
      validateProductionDatabaseConfig({
        NODE_ENV: "production",
        DATABASE_URL: "mysql://user:secret@db.example.test/app",
      }),
    /DATABASE_URL must be a valid PostgreSQL connection URL/,
  )

  assert.doesNotThrow(() =>
    validateProductionDatabaseConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:secret@db.example.test/app",
    }),
  )
  assert.doesNotThrow(() =>
    validateProductionDatabaseConfig({
      NODE_ENV: "production",
      DIRECT_URL: "postgres://user:secret@db.example.test/app",
    }),
  )
})

test("non-production startup can omit DATABASE_URL for isolated fixtures", () => {
  assert.doesNotThrow(() =>
    validateProductionDatabaseConfig({ NODE_ENV: "test" }),
  )
})
