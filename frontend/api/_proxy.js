const backendBaseUrl = 'https://mapsense-api.vercel.app'

function buildUpstreamHeaders(request) {
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('content-length')
  return headers
}

async function forward(request, upstreamPath) {
  const requestUrl = new URL(request.url)
  const upstreamUrl = new URL(upstreamPath, backendBaseUrl)
  upstreamUrl.search = requestUrl.search

  const init = {
    method: request.method,
    headers: buildUpstreamHeaders(request),
    redirect: 'manual',
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer()
  }

  const response = await fetch(upstreamUrl, init)
  const responseHeaders = new Headers(response.headers)
  responseHeaders.delete('content-encoding')
  responseHeaders.delete('content-length')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

export { forward }
