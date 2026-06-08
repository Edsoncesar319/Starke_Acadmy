export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type PrepareImageOptions = {
  /** Redimensiona se a maior aresta passar deste valor (px). */
  maxDimension?: number;
  /** Só recompacta se passar deste tamanho em bytes. */
  maxBytesBeforeResize?: number;
};

export async function prepareImageForUpload(
  file: File,
  options: PrepareImageOptions = {},
): Promise<File> {
  const maxDimension = options.maxDimension ?? 1600;
  const maxBytes = options.maxBytesBeforeResize ?? 900 * 1024;
  if (file.size <= maxBytes) {
    const image = await loadImage(file);
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height, 1));
    if (scale >= 1) return file;
  }

  const image = await loadImage(file);
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height, 1));
  const width = Math.max(1, Math.floor(image.width * scale));
  const height = Math.max(1, Math.floor(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return file;
  context.drawImage(image, 0, 0, width, height);

  const outputType = file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, outputType, 0.82);
  });
  if (!blob) return file;

  const extension = outputType === 'image/webp' ? 'webp' : 'jpg';
  const filename = `${file.name.replace(/\.[^/.]+$/, '')}.${extension}`;
  return new File([blob], filename, { type: outputType });
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
