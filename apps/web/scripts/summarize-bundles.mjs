import { mkdir, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { spawnSync } from "node:child_process"

const appRoot = path.resolve(import.meta.dirname, "..")
const require = createRequire(import.meta.url)
const snapshot = process.argv[2] || "production-audit"
const result = spawnSync(
  process.execPath,
  [
    require.resolve("next/dist/bin/next"),
    "analyze",
    "export",
    `--snapshot=${snapshot}`,
  ],
  { cwd: appRoot, encoding: "utf8", maxBuffer: 100 * 1024 * 1024 },
)
if (result.status !== 0) throw new Error(result.stderr || result.error?.message)
const records = result.stdout
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line))
const routes = records
  .filter((record) => record.type === "route")
  .map((record) => record.route)
const summary = routes.map((route) => {
  const groups = records.filter(
    (record) => record.type === "group" && record.route === route,
  )
  const outputs = new Set(
    groups
      .filter((group) => group.kind !== "async")
      .flatMap((group) => group.outputs)
      .filter((file) => file.startsWith("[client-fs]")),
  )
  const parts = records.filter(
    (record) =>
      record.type === "part" &&
      record.route === route &&
      outputs.has(record.filename),
  )
  const packages = new Map()
  for (const part of parts.filter((part) => part.filename.endsWith(".js"))) {
    const name =
      part.source_path.match(/node_modules\/\.pnpm\/([^/]+)/)?.[1] ||
      "application"
    packages.set(name, (packages.get(name) || 0) + part.size)
  }
  return {
    route,
    // Conservative route attribution: render-dependent groups can include
    // conditional client references. These are not measured network sizes.
    renderDependentJSModuleBytes: parts
      .filter((part) => part.filename.endsWith(".js"))
      .reduce((sum, part) => sum + part.size, 0),
    renderDependentCSSModuleBytes: parts
      .filter((part) => part.filename.endsWith(".css"))
      .reduce((sum, part) => sum + part.size, 0),
    renderDependentAnimationModules: parts
      .filter((part) =>
        /\/(gsap|sileo|framer-motion|motion-dom)\//.test(part.source_path),
      )
      .map((part) => part.source_path),
    deferredClientImports: groups
      .filter(
        (group) =>
          group.kind === "async" &&
          group.trigger_module_ident.includes("[app-client]"),
      )
      .map((group) => group.trigger_module_ident),
    largestRenderDependentPackages: [...packages.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, bytes]) => ({ name, bytes })),
  }
})
const output = path.resolve(appRoot, "../../.tmp/performance")
await mkdir(output, { recursive: true })
await writeFile(
  path.join(output, "bundle-summary.json"),
  JSON.stringify(
    {
      metadata: {
        ...records[0],
        totalModules: records.filter((record) => record.type === "module")
          .length,
      },
      routes: summary,
    },
    null,
    2,
  ),
)
console.table(
  summary.map(
    ({ route, renderDependentJSModuleBytes, deferredClientImports }) => ({
      route,
      renderDependentJSModuleBytes,
      deferredImports: deferredClientImports.length,
    }),
  ),
)
console.log(`Bundle attribution: ${output}/bundle-summary.json`)
