import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client.js"

let client: PrismaClient | undefined

export function getPrisma() {
  if (!process.env.DATABASE_URL) return undefined
  client ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })
  return client
}
