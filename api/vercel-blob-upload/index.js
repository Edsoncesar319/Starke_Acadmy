import { handleUpload } from '@vercel/blob/client';

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

function blobReadWriteToken() {
  return (
    process.env.BLOB_READ_WRITE_TOKEN?.trim() ||
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN?.trim() ||
    ''
  );
}

function lessonVideoAccess(clientPayload) {
  if (clientPayload) {
    try {
      const parsed = JSON.parse(clientPayload);
      if (parsed.access === 'private' || parsed.access === 'public') {
        return parsed.access;
      }
    } catch {
      // ignore
    }
  }
  const pref = (process.env.BLOB_ACCESS || 'auto').trim().toLowerCase();
  return pref === 'public' ? 'public' : 'private';
}

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

/** Pathname do token deve ser idêntico ao primeiro argumento de upload() no browser. */
function normalizeUploadPathname(pathname) {
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
    throw new Error('Sessão expirada. Faça login novamente como administrador.');
  }
  throw new Error('Não autorizado para enviar vídeo.');
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const readWriteToken = blobReadWriteToken();
  if (!readWriteToken) {
    return Response.json(
      { error: 'BLOB_READ_WRITE_TOKEN ausente no deploy. Conecte o Blob na Vercel e redeploy.' },
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
        const access = lessonVideoAccess(clientPayload);
        const blobPathname = normalizeUploadPathname(pathname);

        return {
          access,
          allowedContentTypes: VIDEO_TYPES,
          maximumSizeInBytes: MAX_VIDEO_BYTES,
          addRandomSuffix: true,
          pathname: blobPathname,
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
