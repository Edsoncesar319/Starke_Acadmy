export const environment = {
  production: true,
  apiUrl: '/api',
  /** Navegador → Vercel Blob (sem passar pelo backend Python). */
  useBlobClientUpload: true,
  blobClientUploadUrl: '/api/blob-client-upload',
  /** Private = padrão dos Blob stores na Vercel; use 'public' só com BLOB_ACCESS=public. */
  blobVideoAccess: 'private' as const,
};
