export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8000/api',
  /** Ative com BLOB_READ_WRITE_TOKEN local para testar upload direto. */
  useBlobClientUpload: false,
  blobPutUrl: '/api/vercel-blob-put',
  blobClientUploadUrl: '/api/vercel-blob-upload',
  blobVideoAccess: 'private' as const,
};
