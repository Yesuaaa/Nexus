const collectionPath = "postman/Nexus_Platform.postman_collection.json"
const environmentPath = "postman/Nexus_Local.postman_environment.json"
const healthUrl = "http://127.0.0.1:3001/api/health"

async function checkApiRunning() {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(healthUrl, { signal: controller.signal })
    clearTimeout(timeout)
    return res.ok
  } catch {
    return false
  }
}

async function main() {
  const isRunning = await checkApiRunning()
  if (!isRunning) {
    console.error(
      "\n❌ Nexus API server is not responding at http://127.0.0.1:3001.",
    )
    console.error(
      "   Before running API tests, please start the API in another terminal:",
    )
    console.error("   👉 pnpm --filter @nexus/api dev\n")
    process.exit(1)
  }

  let newmanModule = null
  try {
    newmanModule = await import("newman")
  } catch {
    // newman is not installed
  }

  if (newmanModule && newmanModule.default) {
    const newman = newmanModule.default
    console.log(`\n🚀 Running Postman API Collection (${collectionPath})...`)
    newman.run(
      {
        collection: collectionPath,
        environment: environmentPath,
        reporters: ["cli"],
        color: "on",
      },
      (err, summary) => {
        if (err) {
          console.error("Newman execution error:", err)
          process.exit(1)
        }
        if (summary.run.failures && summary.run.failures.length > 0) {
          console.error(
            `\n❌ Tests completed with ${summary.run.failures.length} failure(s).`,
          )
          process.exit(1)
        }
        console.log("\n✅ All Postman tests passed successfully!")
        process.exit(0)
      },
    )
  } else {
    console.log(
      "\nℹ️  Newman is omitted from root devDependencies to prevent third-party security vulnerabilities in CI.",
    )
    console.log(
      "   Running the native zero-dependency API verification suite instead...\n",
    )
    const { spawn } = await import("node:child_process")
    const child = spawn(
      process.execPath,
      ["scripts/verify-all-apis.mjs", ...process.argv.slice(2)],
      { stdio: "inherit" },
    )
    child.on("exit", (code) => {
      process.exit(code ?? 0)
    })
  }
}

main().catch((err) => {
  console.error("Failed to run tests:", err)
  process.exit(1)
})
