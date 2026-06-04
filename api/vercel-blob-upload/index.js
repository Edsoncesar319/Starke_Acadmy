import { handleUpload } from '@vercel/blob/client';
import {
  lessonVideoAccess,
  resolveBlobAccess,
  resolveBlobReadWriteToken,
  resolveBlobStoreId,
} from '../_lib/blob-env.js';

const VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'application/octet-stream',
  'binary/octet-stream',
];

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const CACHE_MAX_AGE = 31536000;
const TOKEN_TTL_MS = 30 * 60 * 1000;

function sanitizePathname(pathname) {
  const raw = String(pathname || 'lesson-video.mp4').replace(/^\/+/, '');
  const cleaned = raw
    .replace(/[#?&%]/g, '_')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._/-]/g, '_');

  if (!/\.(mp4|webm|mov)$/i.test(cleaned)) {
    const ext = (raw.match(/\.(mp4|webm|mov)$/i) || ['.mp4'])[0].toLowerCase();
    return `lesson-video${ext}`;
  }
  return cleaned;
}

function lessonVideoPathname(pathname) {
  const safe = sanitizePathname(pathname);
  return safe.startsWith('lesson-videos/') ? safe : `lesson-videos/${safe}`;
}

function requestBaseUrl(request) {
  const host = request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  return `${proto}://${host}`;
}

async function assertContentManager(authorization, baseUrl) {
  const verify = await fetch(`${baseUrl}/api/admin/blob/upload-authorize`, {
    headers: { authorization },
  });
  if (verify.ok) return;
  if (verify.status === 401) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  throw new Error('Sem permissão para enviar vídeo.');
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const storeId = resolveBlobStoreId();
  const readWriteToken = resolveBlobReadWriteToken();
  if (!storeId && !readWriteToken) {
    return Response.json(
      {
        error: 'Configure Uploads_STORE_ID e Uploads_READ_WRITE_TOKEN (Storage → Blob na Vercel).',
      },
      { status: 503 },
    );
  }
  if (!readWriteToken) {
    return Response.json(
      {
        error:
          'handleUpload exige read-write token. Defina Uploads_READ_WRITE_TOKEN ou BLOB_READ_WRITE_TOKEN.',
      },
      { status: 503 },
    );
  }

  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const baseUrl = requestBaseUrl(request);

  try {
    const body = await request.json();
    const jsonResponse = await handleUpload({
      token: readWriteToken,
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        await assertContentManager(authorization, baseUrl);

        const blobPath = lessonVideoPathname(pathname);
        if (blobPath !== pathname.replace(/^\/+/, '')) {
          console.warn('blob pathname:', pathname, '→', blobPath);
        }

        return {
          access: lessonVideoAccess(clientPayload) || resolveBlobAccess(),
          allowedContentTypes: VIDEO_TYPES,
          maximumSizeInBytes: MAX_VIDEO_BYTES,
          addRandomSuffix: true,
          cacheControlMaxAge: CACHE_MAX_AGE,
          validUntil: Date.now() + TOKEN_TTL_MS,
        };
      },
    });

    return Response.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha no upload';
    console.error('vercel-blob-upload error:', message);
    return Response.json({ error: message }, { status: 400 });
  }
}
