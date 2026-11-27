import "dotenv/config"
import pg from "pg"
import { mkdir, unlink } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import path from "node:path"

const source = process.env.SERVICE_COVER_SOURCE
if (!source)
  throw new Error("Set SERVICE_COVER_SOURCE to the generated image directory")
const target = new URL(process.env.DATABASE_URL)
if (
  !["127.0.0.1", "localhost"].includes(target.hostname) ||
  target.port !== "5433" ||
  target.pathname !== "/nexus_dev"
)
  throw new Error("Expected local nexus_dev on port 5433")
const images = {
  "Business Development": "864196fd-71b3-4cc1-beb6-bc78bce884d8",
  "Community Management": "c42bdb21-fb94-456f-b018-5ad55c6b46f6",
  "Corporate Events Management": "f19e7595-92b8-4beb-8654-4f94b69dca5c",
  "Customer Service": "3ee4ff1c-31c4-47d6-a65d-2b5ebbc3890a",
  "Digital Printing": "aa53ab7c-7fe8-4492-be4d-43772dceee71",
  "Ecommerce Management": "e84b38b6-e5eb-42d4-be3a-be49149fac70",
  "Email Marketing": "d0c04c8d-281f-4411-a314-08567f88644b",
  "Graphic Design": "64d6a851-024e-4f8c-ad85-77a0377db8d4",
  "Paid Ads Management": "a885a485-1f07-497f-a0db-90337bf86436",
  "Product Photography": "57c1c1d4-c5ca-4137-a91f-8ca757fccffa",
  "Search Engine Optimization (SEO)": "ed30399b-c459-4887-8c27-252231e03c25",
  "Showcase Graphic Design": "8191493d-fbdd-4e39-808e-9b1f5aac4f1f",
  "Showcase Product Photography": "81aac370-909b-4f04-b88d-d8035040d38a",
  "Showcase Retail Brand Design": "80b550a6-663c-47e3-8ad5-c959c1ce148e",
  "Showcase Retail Campaign Imagery": "dbbe3b76-d8a1-4e84-aa77-8d814e529de8",
  "Social Media Management": "50f4ec22-84fc-4c68-a6f7-694cf8ae8795",
  "Video Management / Marketing": "463eb7d4-caed-430e-9c90-db2cf0ac74bf",
  "Video Production": "a646c7fc-67be-4337-a980-f4d06d6437c9",
  "Website Design & Development": "a48cba9c-a606-4a00-8f6c-fd6dbf905f2e",
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
const directory = path.resolve("uploads/service-images")
await client.connect()
try {
  const db = await client.query("SELECT current_database() AS name")
  if (db.rows[0].name !== "nexus_dev") throw new Error("Unexpected database")
  await mkdir(directory, { recursive: true })
  let updated = 0
  for (const [name, id] of Object.entries(images)) {
    const row = await client.query(
      'SELECT "imagePath" FROM "Service" WHERE name=$1',
      [name],
    )
    if (row.rowCount !== 1) throw new Error(`Service missing: ${name}`)
    if (row.rows[0].imagePath) continue
    const filename = `${randomUUID()}.webp`
    const filenamePath = path.join(directory, filename)
    execFileSync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-n",
      "-i",
      path.join(source, `exec-${id}.png`),
      "-vf",
      "scale=1200:-2",
      "-c:v",
      "libwebp",
      "-quality",
      "78",
      filenamePath,
    ])
    try {
      const result = await client.query(
        'UPDATE "Service" SET "imagePath"=$1, "imageAltText"=$2 WHERE name=$3 AND "imagePath" IS NULL',
        [`local-services/${filename}`, `${name} service`, name],
      )
      if (result.rowCount) updated++
      else await unlink(filenamePath)
    } catch (error) {
      await unlink(filenamePath)
      throw error
    }
  }
  console.log(`Updated ${updated} services; preserved existing covers.`)
  const missing = await client.query(
    'SELECT name FROM "Service" WHERE "imagePath" IS NULL ORDER BY name',
  )
  console.log(`Services missing image paths: ${missing.rowCount}`)
} finally {
  await client.end()
}
