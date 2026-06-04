/**
 * Vercel Blob — mesmo padrão da documentação:
 *
 *   import { put } from '@vercel/blob';
 *   const { url } = await put('articles/blob.txt', 'Hello World!', {
 *     access: 'public',
 *     storeId: process.env.Uploads_STORE_ID,
 *   });
 */

function trim(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function firstEnv(names) {
  for (const name of names) {
    const value = trim(process.env[name]);
    if (value) {
      return value;
    }
  }
  return '';
}

function namedStorePrefix() {
  if (trim(process.env.BLOB_STORE_NAME)) {
    return trim(process.env.BLOB_STORE_NAME);
  }
  if (trim(process.env.Uploads_STORE_ID) || trim(process.env.UPLOADS_STORE_ID)) {
    return 'Uploads';
  }
  return '';
}

/** process.env.Uploads_STORE_ID (ou BLOB_STORE_ID) */
export function resolveBlobStoreId() {
  const uploads = firstEnv(['Uploads_STORE_ID', 'UPLOADS_STORE_ID']);
  if (uploads) {
    return uploads;
  }

  const prefix = namedStorePrefix();
  const named = prefix
    ? [`${prefix}_STORE_ID`, `${prefix.toUpperCase()}_STORE_ID`]
    : [];

  return firstEnv(['BLOB_STORE_ID', 'VERCEL_BLOB_STORE_ID', ...named]);
}

export function resolveBlobReadWriteToken() {
  const uploadsStore = firstEnv(['Uploads_STORE_ID', 'UPLOADS_STORE_ID']);
  const uploadsToken = firstEnv(['Uploads_READ_WRITE_TOKEN', 'UPLOADS_READ_WRITE_TOKEN']);
  if (uploadsStore && uploadsToken) {
    return uploadsToken;
  }
  if (uploadsToken) {
    return uploadsToken;
  }

  const prefix = namedStorePrefix();
  const named = prefix
    ? [`${prefix}_READ_WRITE_TOKEN`, `${prefix.toUpperCase()}_READ_WRITE_TOKEN`]
    : [];

  const direct = firstEnv(['BLOB_READ_WRITE_TOKEN', 'VERCEL_BLOB_READ_WRITE_TOKEN', ...named]);
  if (direct) {
    return direct;
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (key.endsWith('_READ_WRITE_TOKEN') && trim(value)) {
      return trim(value);
    }
  }
  return '';
}

export function resolveBlobCredentials() {
  return {
    storeId: resolveBlobStoreId(),
    token: resolveBlobReadWriteToken(),
  };
}

/** access do store — public é o padrão quando Uploads_STORE_ID está configurado. */
export function resolveBlobAccess(override) {
  if (override === 'public' || override === 'private') {
    return override;
  }
  if (trim(process.env.BLOB_ACCESS).toLowerCase() === 'private') {
    return 'private';
  }
  if (trim(process.env.BLOB_ACCESS).toLowerCase() === 'public') {
    return 'public';
  }
  return resolveBlobStoreId() ? 'public' : 'private';
}

/**
 * Opções para put() — espelha o snippet oficial + token explícito (dev/CI).
 */
export function buildPutOptions(extra = {}) {
  const storeId = resolveBlobStoreId();
  const token = resolveBlobReadWriteToken();
  const access =
    extra.access === 'public' || extra.access === 'private'
      ? extra.access
      : resolveBlobAccess();

  const { access: _drop, ...rest } = extra;
  const options = { access, ...rest };

  if (storeId) {
    options.storeId = storeId;
  }
  if (token) {
    options.token = token;
  }

  return options;
}

export function lessonVideoAccess(clientPayload) {
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
  return resolveBlobAccess();
}

/** @deprecated use buildPutOptions */
export function putOptions(extra = {}) {
  return buildPutOptions(extra);
}
