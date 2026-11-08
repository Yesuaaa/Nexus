import newman from "newman"

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

function parseCliArgs(args) {
  let folder = undefined
  const envVars = []

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--folder" && args[i + 1]) {
      folder = args[i + 1]
      i++
    } else if (args[i] === "--env-var" && args[i + 1]) {
      const [key, ...vals] = args[i + 1].split("=")
      envVars.push({ key, value: vals.join("=") })
      i++
    }
  }

  return { folder, envVars }
}

async function main() {
  const isRunning = await checkApiRunning()
  if (!isRunning) {
    console.error(
      "\n❌ Nexus API server is not responding at http://127.0.0.1:3001.",
    )
    console.error(
      "   Before running Postman tests, please start the API in another terminal:",
    )
    console.error("   👉 pnpm --filter @nexus/api dev\n")
    process.exit(1)
  }

  const { folder, envVars } = parseCliArgs(process.argv.slice(2))

  console.log(`\n🚀 Running Postman API Collection (${collectionPath})...`)
  if (folder) {
    console.log(`   Target Folder: ${folder}`)
  }
  console.log()

  newman.run(
    {
      collection: collectionPath,
      environment: environmentPath,
      folder,
      envVar: envVars.length > 0 ? envVars : undefined,
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
}

main().catch((err) => {
  console.error("Failed to run Postman tests:", err)
  process.exit(1)
})
