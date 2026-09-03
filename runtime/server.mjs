import { lstatSync, readFileSync, unlinkSync, chmodSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MARKET_IDS,
  createVoterKey,
  isValidVoteNamespace,
  isSameOriginVoteRequest,
  normalizeProxyIp,
  SECURITY_HEADERS,
  VOTE_CHOICES,
} from './security.mjs';
import { VoteStore } from './store.mjs';
import { renderArchives } from './archive.mjs';
import { renderShareLinks } from './share.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const socketPath = process.env.PWNYMARKET_SOCKET;
const ledgerPath = process.env.PWNYMARKET_LEDGER;
const publicOrigin =
  process.env.PWNYMARKET_PUBLIC_ORIGIN || 'https://pwnymarket.fr';
const secret = process.env.VOTE_HASH_SECRET;
const voteNamespace = process.env.VOTE_HASH_NAMESPACE;

if (!secret || secret.length < 32)
  throw new Error('Vote hashing is not configured');
if (!isValidVoteNamespace(voteNamespace))
  throw new Error('Vote namespace is not configured');
if (!isAbsolute(socketPath || '') || !isAbsolute(ledgerPath || ''))
  throw new Error('Application paths are not configured');

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/markets.js', ['markets.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
  ['/marianne.png', ['marianne.png', 'image/png']],
  ['/manrope-medium.ttf', ['manrope-medium.ttf', 'font/ttf']],
  ['/manrope-OFL.txt', ['manrope-OFL.txt', 'text/plain; charset=utf-8']],
  ['/og.png', ['og.png', 'image/png']],
  ['/about', ['about.html', 'text/html; charset=utf-8']],
  ['/privacy', ['privacy.html', 'text/html; charset=utf-8']],
  ['/archives', ['archives.html', 'text/html; charset=utf-8']],
  ['/robots.txt', ['robots.txt', 'text/plain; charset=utf-8']],
]);
// A new asset namespace prevents previously cached v1 JS/CSS breaking the new DOM.
for (const path of ['/app.js', '/markets.js', '/styles.css', '/og.png']) {
  assets.set('/assets/v2' + path, assets.get(path));
}
// Keep the previous share card available to cached pages.
assets.set('/assets/v2/og.png', ['og-v2.png', 'image/png']);
assets.set('/assets/v3/og.png', ['og.png', 'image/png']);
assets.set('/assets/v3/styles.css', ['styles.css', 'text/css; charset=utf-8']);
assets.set('/assets/v4/styles.css', ['styles.css', 'text/css; charset=utf-8']);
assets.set('/assets/v5/styles.css', ['styles.css', 'text/css; charset=utf-8']);
assets.set('/assets/v6/styles.css', ['styles.css', 'text/css; charset=utf-8']);
assets.set('/assets/v7/styles.css', ['styles.css', 'text/css; charset=utf-8']);
for (const [path, asset] of assets) {
  let body = readFileSync(join(root, 'public', asset[0]));
  if (asset[1].startsWith('text/html')) {
    body = Buffer.from(
      body
        .toString('utf8')
        .replace('<!-- SHARE_LINKS -->', renderShareLinks(path)),
    );
  }
  if (path === '/archives') {
    body = Buffer.from(
      body
        .toString('utf8')
        .replace('<!-- ARCHIVE_ENTRIES -->', renderArchives()),
    );
  }
  assets.set(path, {
    body,
    type: asset[1],
  });
}

const store = new VoteStore(ledgerPath);
const notFoundPage = Buffer.from(
  readFileSync(join(root, 'public', '404.html'), 'utf8').replace(
    '<!-- SHARE_LINKS -->',
    renderShareLinks('/404'),
  ),
);

function send(response, status, body, headers = {}) {
  response.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  response.end(body);
}

function sendJson(response, status, body) {
  send(response, status, JSON.stringify(body), {
    'Cache-Control': 'no-store, max-age=0',
    'Content-Type': 'application/json; charset=utf-8',
  });
}

function identifyVoter(request, marketId) {
  if (request.headers['x-forwarded-proto'] !== 'https') return null;
  const ip = normalizeProxyIp(request.headers['x-forwarded-for']);
  return ip ? createVoterKey(secret, ip, marketId, voteNamespace) : null;
}

async function readVoteBody(request) {
  const mediaType = request.headers['content-type']
    ?.split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (mediaType !== 'application/json') {
    throw new TypeError('Invalid content type');
  }
  const declaredLength = Number(request.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > 512)
    throw new RangeError('Request too large');
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 512) throw new RangeError('Request too large');
    chunks.push(chunk);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Invalid vote');
  if (Object.keys(value).sort().join(',') !== 'choice,marketId')
    throw new TypeError('Invalid vote');
  if (!MARKET_IDS.has(value.marketId) || !VOTE_CHOICES.has(value.choice))
    throw new TypeError('Invalid vote');
  return value;
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');

    if (url.pathname === '/healthz') {
      if (request.method !== 'GET')
        return sendJson(response, 405, { error: 'method_not_allowed' });
      return sendJson(response, store.failed ? 503 : 200, {
        status: store.failed ? 'storage_unavailable' : 'ok',
      });
    }

    if (url.pathname === '/api/markets' && request.method === 'GET') {
      if (url.search)
        return sendJson(response, 400, { error: 'invalid_query' });
      if (store.failed)
        return sendJson(response, 503, { error: 'storage_unavailable' });
      const markets = {};
      for (const id of MARKET_IDS) {
        const voterKey = identifyVoter(request, id);
        if (!voterKey)
          return sendJson(response, 503, {
            error: 'vote_identity_unavailable',
          });
        markets[id] = store.summary(id, voterKey);
      }
      return sendJson(response, 200, { markets });
    }

    if (url.pathname === '/api/votes' && request.method === 'GET') {
      const marketId = url.searchParams.get('market');
      if (!MARKET_IDS.has(marketId) || url.searchParams.size !== 1) {
        return sendJson(response, 400, { error: 'unknown_market' });
      }
      if (store.failed)
        return sendJson(response, 503, { error: 'storage_unavailable' });
      const voterKey = identifyVoter(request, marketId);
      if (!voterKey)
        return sendJson(response, 503, { error: 'vote_identity_unavailable' });
      return sendJson(response, 200, store.summary(marketId, voterKey));
    }

    if (url.pathname === '/api/votes' && request.method === 'POST') {
      if (!isSameOriginVoteRequest(request.headers, publicOrigin)) {
        return sendJson(response, 403, { error: 'cross_origin_request' });
      }
      let vote;
      try {
        vote = await readVoteBody(request);
      } catch (error) {
        return sendJson(response, error instanceof RangeError ? 413 : 400, {
          error:
            error instanceof RangeError ? 'request_too_large' : 'invalid_vote',
        });
      }
      const voterKey = identifyVoter(request, vote.marketId);
      if (!voterKey)
        return sendJson(response, 503, { error: 'vote_identity_unavailable' });
      const accepted = store.record(vote.marketId, voterKey, vote.choice);
      return sendJson(response, accepted ? 201 : 409, {
        ...store.summary(vote.marketId, voterKey),
        accepted,
      });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return sendJson(response, 405, { error: 'method_not_allowed' });
    }
    const asset = assets.get(url.pathname);
    if (!asset || url.search) {
      if (url.pathname.startsWith('/api/'))
        return sendJson(response, 404, { error: 'not_found' });
      return send(
        response,
        404,
        request.method === 'HEAD' ? null : notFoundPage,
        {
          'Cache-Control': 'no-store, max-age=0',
          'Content-Type': 'text/html; charset=utf-8',
          'X-Robots-Tag': 'noindex',
        },
      );
    }
    send(response, 200, request.method === 'HEAD' ? null : asset.body, {
      'Cache-Control': asset.type.startsWith('text/html')
        ? 'no-cache'
        : 'public, max-age=3600',
      'Content-Type': asset.type,
    });
  } catch {
    sendJson(response, 500, { error: 'internal_error' });
  }
});

server.headersTimeout = 5_000;
server.keepAliveTimeout = 5_000;
server.maxHeadersCount = 32;
server.requestTimeout = 5_000;

if (lstatSync(dirname(socketPath)).isDirectory()) {
  try {
    const existing = lstatSync(socketPath);
    if (!existing.isSocket())
      throw new Error('Refusing to replace a non-socket path');
    unlinkSync(socketPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

server.listen(socketPath, () => chmodSync(socketPath, 0o660));

function shutdown() {
  server.close(() => {
    store.close();
    try {
      unlinkSync(socketPath);
    } catch {}
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
