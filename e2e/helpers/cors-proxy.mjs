#!/usr/bin/env node
/**
 * Minimal CORS-forwarding proxy used only by the E2E suite.
 *
 * WHY: the BillFlow API has a strict CORS policy (`CORS_ORIGIN=http://localhost:3000`),
 * and the E2E frontend has to run on a different port because :3000 is occupied by an
 * unrelated application on this machine. Without this proxy the browser would block
 * every cross-origin API call (all mutations and the fetch+blob PDF/zip downloads).
 *
 * The proxy is transparent: it forwards the method, path, query, body and response
 * bytes to the real backend and only *adds* CORS response headers. All backend
 * behaviour (validation, 409s, PDF bytes, zip bytes) is produced by the real API.
 *
 * Usage:
 *   node cors-proxy.mjs --listen 4401 --target http://localhost:4400 --allow-origin http://localhost:3300
 */
import http from 'node:http'

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  if (index !== -1 && process.argv[index + 1]) {
    return process.argv[index + 1]
  }
  return fallback
}

const listenPort = Number(arg('listen', process.env.E2E_PROXY_PORT ?? 4401))
const target = arg('target', process.env.E2E_BACKEND_URL ?? 'http://localhost:4400')
const allowOrigin = arg('allow-origin', process.env.E2E_PROXY_ORIGIN ?? 'http://localhost:3300')

const targetUrl = new URL(target)

const server = http.createServer((req, res) => {
  const requestOrigin = req.headers.origin

  // CORS preflight — the app sends `content-type: application/json`, which is not a
  // "simple" request, so every POST/PATCH is preceded by an OPTIONS.
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': requestOrigin ?? allowOrigin,
      'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
      'access-control-allow-headers': req.headers['access-control-request-headers'] ?? 'content-type',
      'access-control-max-age': '600',
      vary: 'Origin',
    })
    res.end()
    return
  }

  const headers = { ...req.headers }
  // The upstream API only allows its own origin; drop the browser's Origin so the
  // upstream does not answer with a CORS error of its own.
  delete headers.origin
  delete headers['accept-encoding']
  headers.host = targetUrl.host
  headers['accept-encoding'] = 'identity'

  const upstream = http.request(
    {
      hostname: targetUrl.hostname,
      port: targetUrl.port || 80,
      path: req.url,
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      const outHeaders = { ...upstreamRes.headers }
      outHeaders['access-control-allow-origin'] = requestOrigin ?? allowOrigin
      outHeaders['access-control-expose-headers'] = 'Content-Disposition, Content-Length, Content-Type'
      outHeaders.vary = 'Origin'
      res.writeHead(upstreamRes.statusCode ?? 502, outHeaders)
      upstreamRes.pipe(res)
    },
  )

  upstream.on('error', (error) => {
    res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ success: false, error: { code: 'INTERNAL', message: String(error) } }))
  })

  req.pipe(upstream)
})

server.listen(listenPort, '127.0.0.1', () => {
  console.log(`[cors-proxy] ${allowOrigin} -> ${target} on http://127.0.0.1:${listenPort}`)
})
