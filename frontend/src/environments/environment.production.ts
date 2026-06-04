export const environment = {
  production: true,
  apiUrl: '/api',
  /** Navegador → Vercel Blob (sem passar pelo backend Python). */
  useBlobClientUpload: true,
  /** Vídeos ≤ ~4 MB (FastAPI + Blob; funções /api/vercel-blob-put não roteiam com backend unificado). */
  blobPutUrl: '/api/admin/lessons/upload-video',
  /** Client upload para vídeos grandes (FastAPI; usa Uploads_READ_WRITE_TOKEN). */
  blobClientUploadUrl: '/api/blob-client-upload',
  /** public se o store Blob for Public; private é o padrão. */
  blobVideoAccess: 'public' as const,
};
