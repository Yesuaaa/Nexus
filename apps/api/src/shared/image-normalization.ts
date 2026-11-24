import sharp from "sharp"

const supportedImagePattern =
  /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/

type SupportedImageSubtype = "jpeg" | "png" | "webp"

export type NormalizeImageOptions = {
  maxInputBytes: number
  maxOutputBytes: number
  maxInputPixels: number
  maxWidth: number
  maxHeight: number
}

export type NormalizedWebp = {
  data: Buffer
  width: number
  height: number
}

export class ImageNormalizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ImageNormalizationError"
  }
}

export function parseSupportedImageDataUrl(
  dataUrl: string,
  maxInputBytes: number,
) {
  const match = dataUrl.match(supportedImagePattern)
  if (!match) {
    throw new ImageNormalizationError(
      "Choose a JPEG, PNG, or WebP image up to 2 MB",
    )
  }
  const encoded = match[2]!
  const data = Buffer.from(encoded, "base64")
  if (
    !data.length ||
    data.length > maxInputBytes ||
    data.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")
  ) {
    throw new ImageNormalizationError(
      "Choose a JPEG, PNG, or WebP image up to 2 MB",
    )
  }
  return {
    data,
    subtype: match[1] as SupportedImageSubtype,
  }
}

export async function normalizeImageDataUrlToWebp(
  dataUrl: string,
  options: NormalizeImageOptions,
): Promise<NormalizedWebp> {
  const input = parseSupportedImageDataUrl(dataUrl, options.maxInputBytes)
  try {
    const source = sharp(input.data, {
      failOn: "warning",
      limitInputPixels: options.maxInputPixels,
    })
    const metadata = await source.metadata()
    if (metadata.format !== input.subtype) {
      throw new ImageNormalizationError(
        "The image content does not match its file type",
      )
    }
    if ((metadata.pages ?? 1) !== 1) {
      throw new ImageNormalizationError("Animated images are not supported")
    }
    const result = await source
      .rotate()
      .resize({
        width: options.maxWidth,
        height: options.maxHeight,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: 82,
        alphaQuality: 100,
        effort: 4,
        smartSubsample: true,
      })
      .toBuffer({ resolveWithObject: true })
    if (result.data.length > options.maxOutputBytes) {
      throw new ImageNormalizationError(
        "The converted WebP image exceeds the 2 MB limit",
      )
    }
    return {
      data: result.data,
      width: result.info.width,
      height: result.info.height,
    }
  } catch (error) {
    if (error instanceof ImageNormalizationError) throw error
    throw new ImageNormalizationError(
      "The image is corrupt or exceeds the 25 megapixel limit",
    )
  }
}
