import { readFile, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const nextRequire = createRequire(require.resolve("next/package.json"))
const sharp = nextRequire("sharp")

// These SVGs embed raster artwork. Preserve the SVG geometry and every pixel;
// only replace the embedded PNG encoding with lossless WebP.
for (const relativePath of [
  "../public/auth/exp-logo.svg",
  "../public/favicon.svg",
]) {
  const file = new URL(relativePath, import.meta.url)
  const source = await readFile(file, "utf8")
  const embedded = source.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/)
  if (!embedded) continue
  const png = Buffer.from(embedded[1], "base64")
  const webp = await sharp(png)
    .webp({ lossless: true, exact: true, effort: 6 })
    .toBuffer()
  if (webp.length >= png.length) continue
  const original = await sharp(png).ensureAlpha().raw().toBuffer()
  const optimized = await sharp(webp).ensureAlpha().raw().toBuffer()
  if (!original.equals(optimized))
    throw new Error(`Pixel mismatch: ${relativePath}`)
  const result = source.replace(
    embedded[0],
    `data:image/webp;base64,${webp.toString("base64")}`,
  )
  await writeFile(file, result)
  console.log(
    `${relativePath}: ${Buffer.byteLength(source)} → ${Buffer.byteLength(result)} bytes; identical decoded pixels`,
  )
}
