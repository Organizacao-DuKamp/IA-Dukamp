import { FarmPhotoSchema } from "./operations";

/** Re-encode to discard metadata and keep a small thumbnail within panel limits. */
export async function farmPhotoThumbnail(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024)
    throw Error("Escolha uma foto JPG, PNG ou WebP de até 10 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 40_000_000)
      throw Error("Reduza a resolução da foto e tente novamente.");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 192;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Não foi possível preparar a foto neste dispositivo.");
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 192, 192);
    ctx.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      192,
      192,
    );
    for (const quality of [0.8, 0.6, 0.4, 0.2]) {
      const photo = canvas.toDataURL("image/jpeg", quality);
      if (FarmPhotoSchema.safeParse(photo).success) return photo;
    }
    throw Error("Não consegui reduzir a foto. Escolha uma imagem mais simples.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
