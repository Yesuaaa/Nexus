import assert from "node:assert/strict"
import { test } from "node:test"
import sharp from "sharp"
import {
  ImageNormalizationError,
  normalizeImageDataUrlToWebp,
} from "../../../src/shared/image-normalization.js"

const options = {
  maxInputBytes: 2 * 1024 * 1024,
  maxOutputBytes: 2 * 1024 * 1024,
  maxInputPixels: 25_000_000,
  maxWidth: 2560,
  maxHeight: 2560,
}

function dataUrl(subtype: "jpeg" | "png" | "webp", data: Buffer) {
  return `data:image/${subtype};base64,${data.toString("base64")}`
}

async function source(format: "jpeg" | "png" | "webp") {
  const image = sharp({
    create: {
      width: 8,
      height: 4,
      channels: 4,
      background: { r: 26, g: 72, b: 140, alpha: 0.5 },
    },
  })
  return format === "jpeg"
    ? image.jpeg().toBuffer()
    : format === "png"
      ? image.png().toBuffer()
      : image.webp().toBuffer()
}

test("normalizes JPEG, PNG, and WebP inputs to canonical WebP", async () => {
  for (const format of ["jpeg", "png", "webp"] as const) {
    const result = await normalizeImageDataUrlToWebp(
      dataUrl(format, await source(format)),
      options,
    )
    const metadata = await sharp(result.data).metadata()
    assert.equal(metadata.format, "webp", format)
    assert.equal(result.width, 8, format)
    assert.equal(result.height, 4, format)
    if (format !== "jpeg") assert.equal(metadata.hasAlpha, true, format)
  }
})

test("resizes large images without enlarging or changing their aspect ratio", async () => {
  const large = await sharp({
    create: {
      width: 3000,
      height: 1000,
      channels: 3,
      background: { r: 26, g: 72, b: 140 },
    },
  })
    .png()
    .toBuffer()
  const result = await normalizeImageDataUrlToWebp(
    dataUrl("png", large),
    options,
  )
  assert.equal(result.width, 2560)
  assert.equal(result.height, 853)
})

test("rejects MIME mismatch, corrupt content, unsafe dimensions, and oversized output", async () => {
  const png = await source("png")
  await assert.rejects(
    normalizeImageDataUrlToWebp(dataUrl("jpeg", png), options),
    (error: unknown) =>
      error instanceof ImageNormalizationError &&
      /does not match/.test(error.message),
  )
  await assert.rejects(
    normalizeImageDataUrlToWebp(
      dataUrl("png", Buffer.from("not-an-image")),
      options,
    ),
    ImageNormalizationError,
  )
  await assert.rejects(
    normalizeImageDataUrlToWebp(dataUrl("png", png), {
      ...options,
      maxInputPixels: 1,
    }),
    ImageNormalizationError,
  )
  await assert.rejects(
    normalizeImageDataUrlToWebp(dataUrl("png", png), {
      ...options,
      maxOutputBytes: 1,
    }),
    (error: unknown) =>
      error instanceof ImageNormalizationError &&
      /converted WebP/.test(error.message),
  )
})

test("rejects invalid base64 and input bytes above the configured limit", async () => {
  await assert.rejects(
    normalizeImageDataUrlToWebp("data:image/png;base64,%%%", options),
    ImageNormalizationError,
  )
  await assert.rejects(
    normalizeImageDataUrlToWebp(dataUrl("png", Buffer.alloc(9)), {
      ...options,
      maxInputBytes: 8,
    }),
    ImageNormalizationError,
  )
})
