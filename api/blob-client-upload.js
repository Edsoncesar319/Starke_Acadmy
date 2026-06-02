import { handleUpload } from '@vercel/blob/client';

const VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/octet-stream',
  'binary/octet-stream',
];

export default async function handler(request) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const host = request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const baseUrl = `${proto}://${host}`;

  try {
    const body = await request.json();
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const verify = await fetch(`${baseUrl}/api/admin/blob/upload-authorize`, {
          headers: { authorization },
        });
        if (!verify.ok) {
          throw new Error('Não autorizado para enviar vídeo');
        }

        const safePath = String(pathname || 'lesson-video.mp4').replace(/^\/+/, '');
        const blobPath = safePath.startsWith('lesson-videos/')
          ? safePath
          : `lesson-videos/${safePath}`;

        return {
          allowedContentTypes: VIDEO_TYPES,
          maximumSizeInBytes: 100 * 1024 * 1024,
          addRandomSuffix: true,
          pathname: blobPath,
        };
      },
      onUploadCompleted: async () => {},
    });

    return Response.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha no upload';
    return Response.json({ error: message }, { status: 400 });
  }
}
