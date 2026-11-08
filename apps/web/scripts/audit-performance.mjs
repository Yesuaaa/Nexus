import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { setTimeout } from "node:timers/promises"
import { performanceFixtures } from "./performance-fixtures.mjs"

// Install the audit tool separately from application dependencies:
// npm install --prefix .tmp/lighthouse --no-save --package-lock=false lighthouse
const workspace = path.resolve(import.meta.dirname, "../../..")
const toolsRoot = path.resolve(workspace, ".tmp/lighthouse/node_modules")
const toolRequire = createRequire(
  path.join(toolsRoot, "lighthouse/package.json"),
)
const { default: lighthouse, desktopConfig } = await import(
  pathToFileURL(toolRequire.resolve("lighthouse")).href
)
const { default: puppeteer } = await import(
  pathToFileURL(toolRequire.resolve("puppeteer-core")).href
)
const appRequire = createRequire(path.join(workspace, "apps/web/package.json"))
const { chromium } = appRequire("@playwright/test")
const options = Object.fromEntries(
  process.argv.slice(2).map((value) => {
    const argument = value.replace(/^--/, "")
    const separator = argument.indexOf("=")
    return separator < 0
      ? [argument, "true"]
      : [argument.slice(0, separator), argument.slice(separator + 1)]
  }),
)
const baseURL = options.url || "http://127.0.0.1:5373"
const routes = (options.routes || "/login,/register").split(",")
const runs = Number(options.runs || 3)
const profile = options.profile || "mobile"
if (!Number.isInteger(runs) || runs < 1)
  throw new Error("--runs must be a positive integer")
if (!["mobile", "desktop"].includes(profile))
  throw new Error("--profile must be mobile or desktop")
if (options.fixture && !["admin", "head", "user"].includes(options.fixture))
  throw new Error("--fixture must be admin, head or user")
const output = path.resolve(
  workspace,
  ".tmp/performance",
  options.label || "audit",
)
await mkdir(output, { recursive: true })
const browser = await puppeteer.launch({
  executablePath: options.chrome || chromium.executablePath(),
  headless: true,
  args: ["--no-sandbox"],
})
const summary = []
try {
  for (const route of routes) {
    for (let run = 1; run <= runs; run++) {
      const context = await browser.createBrowserContext()
      const page = await context.newPage()
      const unexpected = []
      if (options.fixture) {
        const fixtures = performanceFixtures(options.fixture)
        await page.evaluateOnNewDocument(() => {
          sessionStorage.setItem("nexus.auth.token", "synthetic-audit-token")
        })
        await page.setRequestInterception(true)
        page.on("request", async (request) => {
          const pathname = new URL(request.url()).pathname
          if (!pathname.startsWith("/api/")) return request.continue()
          await setTimeout(80)
          if (!(pathname in fixtures)) unexpected.push(pathname)
          await request.respond({
            status: pathname in fixtures ? 200 : 404,
            contentType: "application/json",
            body: JSON.stringify(
              fixtures[pathname] || { error: "Unknown audit fixture" },
            ),
          })
        })
      }
      const result = await lighthouse(
        new URL(route, baseURL).href,
        {
          onlyCategories: ["performance"],
          output: ["json", "html"],
          logLevel: "error",
        },
        profile === "desktop" ? desktopConfig : undefined,
        page,
      )
      if (!result || result.lhr.runtimeError) {
        throw new Error(JSON.stringify(result?.lhr.runtimeError || "No report"))
      }
      const { lhr } = result
      const resources = lhr.audits["network-requests"].details.items
      const transferred = (type) =>
        resources
          .filter((resource) => resource.resourceType === type)
          .reduce((sum, resource) => sum + resource.transferSize, 0)
      const metric = (id) => lhr.audits[id]?.numericValue ?? null
      const row = {
        route,
        finalUrl: lhr.finalDisplayedUrl,
        profile,
        fixture: options.fixture || null,
        run,
        lighthouse: lhr.lighthouseVersion,
        settings: lhr.configSettings,
        browser: lhr.environment.hostUserAgent,
        score: Math.round(lhr.categories.performance.score * 100),
        fcp: metric("first-contentful-paint"),
        lcp: metric("largest-contentful-paint"),
        tbt: metric("total-blocking-time"),
        cls: metric("cumulative-layout-shift"),
        bytes: metric("total-byte-weight"),
        jsBytes: transferred("Script"),
        documentBytes: transferred("Document"),
        imageBytes: transferred("Image"),
        cssBytes: transferred("Stylesheet"),
        fontBytes: transferred("Font"),
        unusedJS: lhr.audits["unused-javascript"]?.details?.overallSavingsBytes,
        bfcache: lhr.audits["bf-cache"]?.details,
        unexpected,
      }
      const filename = `${route.replaceAll("/", "_")}-${profile}-${run}`
      await writeFile(path.join(output, `${filename}.json`), result.report[0])
      await writeFile(path.join(output, `${filename}.html`), result.report[1])
      summary.push(row)
      await writeFile(
        path.join(output, "summary.json"),
        JSON.stringify(summary, null, 2),
      )
      console.log(
        JSON.stringify({
          ...row,
          settings: undefined,
          bfcache: row.bfcache?.items?.map((item) => item.protocolReason),
        }),
      )
      await context.close()
      const requestedPath = new URL(route, baseURL).pathname.replace(/\/$/, "")
      const displayedPath = new URL(lhr.finalDisplayedUrl).pathname.replace(
        /\/$/,
        "",
      )
      if (!options["allow-redirects"] && requestedPath !== displayedPath) {
        throw new Error(
          `Audit redirected from ${route} to ${lhr.finalDisplayedUrl}; configure an authorized fixture or explicitly allow redirects`,
        )
      }
      if (unexpected.length)
        throw new Error(
          `Missing audit fixtures: ${[...new Set(unexpected)].join(", ")}`,
        )
    }
  }
  const nextPackage = JSON.parse(
    await readFile(appRequire.resolve("next/package.json"), "utf8"),
  )
  console.log(`Reports: ${output}; Next ${nextPackage.version}`)
} finally {
  await browser.close()
}
