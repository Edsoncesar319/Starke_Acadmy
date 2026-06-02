export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8000/api',
  /** Upload direto ao Blob (obrigatório na Vercel para vídeos > 4 MB). */
  useBlobClientUpload: false,
  blobClientUploadUrl: '/api/blob-client-upload',
};
