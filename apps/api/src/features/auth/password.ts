import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto"

const keyLength = 64
const cost = 16384
const blockSize = 8
const parallelization = 1

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      keyLength,
      { N: cost, r: blockSize, p: parallelization },
      (error, key) => {
        if (error) reject(error)
        else resolve(key)
      },
    )
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await derive(password, salt)
  return `scrypt$${cost}$${blockSize}$${parallelization}$${salt.toString("hex")}$${hash.toString("hex")}`
}

export async function verifyPassword(
  password: string,
  stored: string | null,
): Promise<boolean> {
  if (!stored) return false
  const parts = stored.split("$")
  if (
    parts.length !== 6 ||
    parts[0] !== "scrypt" ||
    parts[1] !== String(cost) ||
    parts[2] !== String(blockSize) ||
    parts[3] !== String(parallelization) ||
    !/^[0-9a-f]{32}$/.test(parts[4]) ||
    !/^[0-9a-f]{128}$/.test(parts[5])
  ) {
    return false
  }
  const expected = Buffer.from(parts[5], "hex")
  const actual = await derive(password, Buffer.from(parts[4], "hex"))
  return timingSafeEqual(actual, expected)
}

export function validPassword(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 12 &&
    Buffer.byteLength(value) <= 1024
  )
}
