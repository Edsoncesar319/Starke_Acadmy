export const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024;
/** Limite de upload via servidor na Vercel (Functions). */
export const SERVER_VIDEO_UPLOAD_BYTES = 4 * 1024 * 1024;
const ALLOWED_VIDEO_EXTENSIONS = /\.(mp4|webm|mov)$/i;

export function isAllowedVideoFile(file: File): boolean {
  return ALLOWED_VIDEO_EXTENSIONS.test(file.name);
}

/** Nome seguro para pathname no Blob (extensão obrigatória; sem # ou espaços). */
export function sanitizeBlobUploadName(fileName: string): string {
  const raw = (fileName || 'lesson-video.mp4').trim();
  const cleaned = raw
    .replace(/[#?&%]/g, '_')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '_');

  if (/\.(mp4|webm|mov)$/i.test(cleaned)) {
    return cleaned;
  }
  const ext = (raw.match(/\.(mp4|webm|mov)$/i) || ['.mp4'])[0].toLowerCase();
  return `lesson-video${ext}`;
}

export function videoValidationError(file: File): string | null {
  if (!isAllowedVideoFile(file)) {
    return 'Formato inválido. Use arquivo MP4, WEBM ou MOV.';
  }
  if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
    return 'Vídeo muito grande. Máximo 100 MB.';
  }
  if (file.size === 0) {
    return 'O arquivo de vídeo está vazio.';
  }
  return null;
}
