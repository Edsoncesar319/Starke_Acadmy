import { randomUUID } from 'node:crypto';
import { put } from '@vercel/blob';
import { buildPutOptions, resolveBlobAccess, resolveBlobStoreId } from '../_lib/blob-env.js';

const VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'application/octet-stream',
]);

const MAX_BYTES = 100 * 1024 * 1024;

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
  throw new Error(verify.status === 401 ? 'Sessão expirada.' : 'Sem permissão.');
}

function extensionFromName(name) {
  const match = String(name || '').match(/\.(mp4|webm|mov)$/i);
  return match ? match[0].toLowerCase() : '.mp4';
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const storeId = resolveBlobStoreId();
  if (!storeId) {
    return Response.json(
      {
        error: 'Uploads_STORE_ID (ou BLOB_STORE_ID) não configurado. Conecte o Blob "Uploads" na Vercel.',
      },
      { status: 503 },
    );
  }

  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 });
  }

  try {
    await assertContentManager(authorization, requestBaseUrl(request));

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return Response.json({ error: 'Arquivo "file" obrigatório.' }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return Response.json({ error: 'Vídeo muito grande (máx. 100 MB). Use upload > 4 MB.' }, { status: 400 });
    }

    const pathname = `lesson-videos/${randomUUID()}${extensionFromName(file.name)}`;
    const access = resolveBlobAccess();
    const contentType =
      file.type && VIDEO_TYPES.has(file.type) ? file.type : 'video/mp4';

    // Padrão oficial Vercel Blob (igual à documentação)
    const uploaded = await put(
      pathname,
      file,
      buildPutOptions({
        access,
        contentType,
        addRandomSuffix: false,
        multipart: file.size > 8 * 1024 * 1024,
      }),
    );

    const clean = uploaded.pathname.replace(/^\//, '');
    return Response.json({
      video_url: `/api/media/${clean}`,
      pathname: uploaded.pathname,
      url: uploaded.url,
      downloadUrl: uploaded.downloadUrl,
      access,
      storeId: `${storeId.slice(0, 12)}…`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha no upload';
    console.error('vercel-blob-put error:', message);
    return Response.json({ error: message }, { status: 400 });
  }
}
