export const environment = {
  production: true,
  apiUrl: '/api',
  /** Navegador → Vercel Blob (sem passar pelo backend Python). */
  useBlobClientUpload: true,
  blobClientUploadUrl: '/api/blob-client-upload',
  /** URL direta na CDN do Blob (reprodução mais rápida). */
  blobVideoAccess: 'public' as const,
};
