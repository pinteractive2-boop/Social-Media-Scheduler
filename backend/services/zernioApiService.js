const defaultBaseUrl = 'https://zernio.com/api';

class ZernioApiError extends Error {
  constructor(statusCode, code = 'ZERNIO_REQUEST_FAILED') {
    super('Zernio request failed');
    this.name = 'ZernioApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function getApiUrl(path, query = {}) {
  const baseUrl = process.env.ZERNIO_BASE_URL || defaultBaseUrl;
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new ZernioApiError(503, 'ZERNIO_NOT_CONFIGURED');
  }

  if (
    !baseUrl ||
    (process.env.NODE_ENV === 'production' && base.protocol !== 'https:')
  ) {
    throw new ZernioApiError(503, 'ZERNIO_NOT_CONFIGURED');
  }

  const basePath = base.pathname.replace(/\/+$/, '');
  if (!basePath.endsWith('/v1')) base.pathname = `${basePath}/v1`;
  base.pathname = `${base.pathname.replace(/\/+$/, '')}${path}`;
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      base.searchParams.set(key, String(value));
    }
  }

  return base;
}

function getSafeStatusCode(upstreamStatus) {
  if (upstreamStatus === 400 || upstreamStatus === 409 || upstreamStatus === 422) {
    return 400;
  }
  if (upstreamStatus === 429) return 503;
  return 502;
}

async function request(method, path, { query, body, idempotencyKey } = {}) {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) throw new ZernioApiError(503, 'ZERNIO_NOT_CONFIGURED');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  try {
    const response = await fetch(getApiUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      let code = 'ZERNIO_REQUEST_FAILED';
      try {
        const errorBody = await response.json();
        if (typeof errorBody.code === 'string' &&
            /^[a-z0-9_]{1,64}$/i.test(errorBody.code)) {
          code = errorBody.code;
        }
      } catch {
        code = 'ZERNIO_REQUEST_FAILED';
      }

      throw new ZernioApiError(getSafeStatusCode(response.status), code);
    }

    try {
      return await response.json();
    } catch {
      throw new ZernioApiError(502, 'ZERNIO_INVALID_RESPONSE');
    }
  } catch (error) {
    if (error instanceof ZernioApiError) throw error;
    throw new ZernioApiError(502, 'ZERNIO_UNAVAILABLE');
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { request, ZernioApiError };
