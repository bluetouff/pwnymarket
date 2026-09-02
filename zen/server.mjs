import { lstatSync, readFileSync, unlinkSync, chmodSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ACTIVE_MARKET_ID,
  createVoterKey,
  isSameOriginVoteRequest,
  normalizeProxyIp,
  SECURITY_HEADERS,
  VOTE_CHOICES,
} from './security.mjs';
import { VoteStore } from './store.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const socketPath =
  process.env.PWNYMARKET_SOCKET || '/run/pwnymarket/pwnymarket.sock';
const ledgerPath =
  process.env.PWNYMARKET_LEDGER || '/var/lib/pwnymarket/votes.ndjson';
const publicOrigin =
  process.env.PWNYMARKET_PUBLIC_ORIGIN || 'https://pwnymarket.l0g.fr';
const secret = process.env.VOTE_HASH_SECRET;

if (!secret || secret.length < 32)
  throw new Error('Vote hashing is not configured');

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
  ['/og.png', ['og.png', 'image/png']],
]);
for (const [path, asset] of assets) {
  assets.set(path, {
    body: readFileSync(join(root, 'public', asset[0])),
    type: asset[1],
  });
}

const store = new VoteStore(ledgerPath);

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

function identifyVoter(request) {
  if (request.headers['x-forwarded-proto'] !== 'https') return null;
  const ip = normalizeProxyIp(request.headers['x-forwarded-for']);
  return ip ? createVoterKey(secret, ip, ACTIVE_MARKET_ID) : null;
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
  if (value.marketId !== ACTIVE_MARKET_ID || !VOTE_CHOICES.has(value.choice))
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

    if (url.pathname === '/api/votes' && request.method === 'GET') {
      if (
        url.searchParams.get('market') !== ACTIVE_MARKET_ID ||
        url.searchParams.size !== 1
      ) {
        return sendJson(response, 400, { error: 'unknown_market' });
      }
      const voterKey = identifyVoter(request);
      if (!voterKey)
        return sendJson(response, 503, { error: 'vote_identity_unavailable' });
      return sendJson(response, 200, store.summary(ACTIVE_MARKET_ID, voterKey));
    }

    if (url.pathname === '/api/votes' && request.method === 'POST') {
      if (!isSameOriginVoteRequest(request.headers, publicOrigin)) {
        return sendJson(response, 403, { error: 'cross_origin_request' });
      }
      const voterKey = identifyVoter(request);
      if (!voterKey)
        return sendJson(response, 503, { error: 'vote_identity_unavailable' });
      let vote;
      try {
        vote = await readVoteBody(request);
      } catch (error) {
        return sendJson(response, error instanceof RangeError ? 413 : 400, {
          error:
            error instanceof RangeError ? 'request_too_large' : 'invalid_vote',
        });
      }
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
    if (!asset || url.search)
      return sendJson(response, 404, { error: 'not_found' });
    send(response, 200, request.method === 'HEAD' ? null : asset.body, {
      'Cache-Control':
        url.pathname === '/' || url.pathname === '/index.html'
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
