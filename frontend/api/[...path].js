const filteredRequestHeaders = new Set([
  'connection',
  'content-length',
  'host',
  'transfer-encoding',
]);

const filteredResponseHeaders = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'transfer-encoding',
]);

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export default async function proxyApiRequest(request, response) {
  const backendUrl = process.env.VITE_API_URL;
  if (!backendUrl) {
    response.statusCode = 500;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ error: 'VITE_API_URL is not configured' }));
    return;
  }

  try {
    // Build the upstream URL from the configured backend base URL and the
    // incoming request path only. Resolving request.url directly against
    // backendUrl would ignore backendUrl entirely when request.url is an
    // absolute URL, causing requests to be forwarded back to the frontend
    // origin instead of the Render backend (and risking path duplication).
    const normalizedRequest = new URL(request.url, 'http://localhost');
    const targetUrl = new URL(
      normalizedRequest.pathname + normalizedRequest.search,
      backendUrl,
    );
    const headers = new Headers();

    for (const [name, value] of Object.entries(request.headers)) {
      if (filteredRequestHeaders.has(name.toLowerCase()) || value === undefined) {
        continue;
      }
      headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }

    const method = request.method || 'GET';
    const body = ['GET', 'HEAD'].includes(method)
      ? undefined
      : await readRequestBody(request);
    const upstreamResponse = await fetch(targetUrl, { method, headers, body });

    response.statusCode = upstreamResponse.status;
    for (const [name, value] of upstreamResponse.headers) {
      if (!filteredResponseHeaders.has(name.toLowerCase())) {
        response.setHeader(name, value);
      }
    }

    response.end(Buffer.from(await upstreamResponse.arrayBuffer()));
  } catch (error) {
    console.error('API proxy request failed:', error);
    response.statusCode = 502;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ error: 'Unable to reach the backend API' }));
  }
};
