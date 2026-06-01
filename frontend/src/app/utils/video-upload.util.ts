export const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024;
const ALLOWED_VIDEO_EXTENSIONS = /\.(mp4|webm|mov)$/i;

export function isAllowedVideoFile(file: File): boolean {
  return ALLOWED_VIDEO_EXTENSIONS.test(file.name);
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
