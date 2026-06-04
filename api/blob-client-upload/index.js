import { handleUpload } from '@vercel/blob/client';
import { jwtVerify } from 'jose';

const VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/octet-stream',
  'binary/octet-stream',
];

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const CACHE_MAX_AGE = 31536000;

function lessonVideoAccess() {
  const pref = (process.env.BLOB_ACCESS || 'auto').trim().toLowerCase();
  return pref === 'private' ? 'private' : 'public';
}

function jwtSecretKey() {
  const secret = process.env.AUTH_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error('AUTH_SECRET_KEY não configurado');
  }
  return new TextEncoder().encode(secret);
}

async function assertContentManager(authorization) {
  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    throw new Error('Não autenticado');
  }
  const token = authorization.slice(7).trim();
  if (!token) {
    throw new Error('Não autenticado');
  }

  try {
    const { payload } = await jwtVerify(token, jwtSecretKey(), { algorithms: ['HS256'] });
    if (!payload.cm) {
      throw new Error('Não autorizado para enviar vídeo');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('autorizado')) {
      throw error;
    }
    throw new Error('Não autorizado para enviar vídeo');
  }
}

function lessonVideoPathname(pathname) {
  const safePath = String(pathname || 'lesson-video.mp4').replace(/^\/+/, '');
  return safePath.startsWith('lesson-videos/') ? safePath : `lesson-videos/${safePath}`;
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        await assertContentManager(authorization);

        return {
          access: lessonVideoAccess(),
          allowedContentTypes: VIDEO_TYPES,
          maximumSizeInBytes: MAX_VIDEO_BYTES,
          addRandomSuffix: true,
          pathname: lessonVideoPathname(pathname),
          cacheControlMaxAge: CACHE_MAX_AGE,
        };
      },
      onUploadCompleted: async () => {
        // Webhook pós-upload; o cliente já recebe a URL direta do Blob.
      },
    });

    return Response.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha no upload';
    console.error('blob-client-upload error:', message);
    return Response.json({ error: message }, { status: 400 });
  }
}
