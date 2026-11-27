export async function imageAsWebp(file: File): Promise<Blob> {
  if (file.type === "image/webp") return file

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement("canvas")
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Image conversion is unavailable")
    context.drawImage(image, 0, 0)
    const result = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.9),
    )
    if (!result || result.type !== "image/webp")
      throw new Error("Image conversion failed")
    return result
  } finally {
    URL.revokeObjectURL(url)
  }
}
