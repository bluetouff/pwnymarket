import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  ACTIVE_MARKET_ID,
  createVoterKey,
  isSameOriginVoteRequest,
  normalizeProxyIp,
  SECURITY_HEADERS,
} from '../zen/security.mjs';
import { VoteStore } from '../zen/store.mjs';

const secret = '0123456789abcdef0123456789abcdef';

function unixRequest(
  socketPath,
  { body, headers = {}, method = 'GET', path = '/' },
) {
  return new Promise((resolve, reject) => {
    const clientRequest = request(
      { headers, method, path, socketPath },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({
            body: text ? JSON.parse(text) : null,
            headers: response.headers,
            status: response.statusCode,
          });
        });
      },
    );
    clientRequest.on('error', reject);
    clientRequest.setTimeout(2_000, () =>
      clientRequest.destroy(new Error(`Request timed out: ${method} ${path}`)),
    );
    if (body) clientRequest.write(body);
    clientRequest.end();
  });
}

async function waitForSocket(socketPath) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (existsSync(socketPath)) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Server socket was not created');
}

void test('normalizes one trusted proxy IP and rejects forwarded chains', () => {
  assert.equal(normalizeProxyIp('203.0.113.7'), '203.0.113.7');
  assert.equal(normalizeProxyIp('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(normalizeProxyIp('203.0.113.7, 198.51.100.4'), null);
  assert.equal(normalizeProxyIp('not-an-ip'), null);
});

void test('separates the voter pseudonym from the raw address', () => {
  const ip = '2001:db8::2';
  const voterKey = createVoterKey(secret, ip, ACTIVE_MARKET_ID);
  assert.match(voterKey, /^[a-f0-9]{64}$/);
  assert.equal(voterKey.includes(ip), false);
});

void test('requires HTTPS and an exact same origin for writes', () => {
  const origin = 'https://pwnymarket.l0g.fr';
  assert.equal(
    isSameOriginVoteRequest({ origin, 'x-forwarded-proto': 'https' }, origin),
    true,
  );
  assert.equal(
    isSameOriginVoteRequest({ origin, 'x-forwarded-proto': 'http' }, origin),
    false,
  );
  assert.equal(
    isSameOriginVoteRequest(
      { origin: 'https://evil.example', 'x-forwarded-proto': 'https' },
      origin,
    ),
    false,
  );
});

void test('ledger is durable, unique and contains no raw IP', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pwnymarket-store-'));
  const ledger = join(directory, 'votes.ndjson');
  const ip = '192.0.2.44';
  const voterKey = createVoterKey(secret, ip, ACTIVE_MARKET_ID);
  const store = new VoteStore(ledger);
  assert.equal(store.record(ACTIVE_MARKET_ID, voterKey, 'yes'), true);
  assert.equal(store.record(ACTIVE_MARKET_ID, voterKey, 'no'), false);
  assert.deepEqual(store.summary(ACTIVE_MARKET_ID, voterKey), {
    choice: 'yes',
    hasVoted: true,
    no: 0,
    noPercent: 0,
    total: 1,
    yes: 1,
    yesPercent: 100,
  });
  store.close();
  assert.equal(readFileSync(ledger, 'utf8').includes(ip), false);
  const reopened = new VoteStore(ledger);
  assert.equal(reopened.summary(ACTIVE_MARKET_ID, voterKey).choice, 'yes');
  reopened.close();
});

void test('ledger fails closed on a truncated record', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pwnymarket-truncated-'));
  const ledger = join(directory, 'votes.ndjson');
  writeFileSync(ledger, '{"partial":true}');
  assert.throws(() => new VoteStore(ledger), /truncated/);
});

void test('strict CSP contains no inline-script escape hatch', () => {
  assert.equal(
    SECURITY_HEADERS['Content-Security-Policy'].includes("'unsafe-inline'"),
    false,
  );
  assert.equal(
    SECURITY_HEADERS['Content-Security-Policy'].includes("'unsafe-eval'"),
    false,
  );
  const html = readFileSync(
    new URL('../zen/public/index.html', import.meta.url),
    'utf8',
  );
  assert.equal(/<script(?![^>]*\ssrc=)/i.test(html), false);
  assert.equal(/\sstyle=/i.test(html), false);
});

void test('Unix-socket API accepts one vote and rejects a duplicate', async (context) => {
  const directory = mkdtempSync(join(tmpdir(), 'pwnymarket-server-'));
  const socketPath = join(directory, 'server.sock');
  const ledger = join(directory, 'votes.ndjson');
  const server = spawn(process.execPath, ['zen/server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      PWNYMARKET_LEDGER: ledger,
      PWNYMARKET_PUBLIC_ORIGIN: 'https://pwnymarket.l0g.fr',
      PWNYMARKET_SOCKET: socketPath,
      VOTE_HASH_SECRET: secret,
    },
    stdio: 'ignore',
  });
  context.after(() => server.kill('SIGTERM'));
  await waitForSocket(socketPath);

  const proxyHeaders = {
    'x-forwarded-for': '198.51.100.8',
    'x-forwarded-proto': 'https',
  };
  const initial = await unixRequest(socketPath, {
    headers: proxyHeaders,
    path: `/api/votes?market=${ACTIVE_MARKET_ID}`,
  });
  assert.equal(initial.status, 200);
  assert.equal(initial.body.total, 0);

  const voteBody = JSON.stringify({
    choice: 'yes',
    marketId: ACTIVE_MARKET_ID,
  });
  const writeHeaders = {
    ...proxyHeaders,
    'content-length': Buffer.byteLength(voteBody),
    'content-type': 'application/json',
    origin: 'https://pwnymarket.l0g.fr',
    'sec-fetch-site': 'same-origin',
  };
  const badMediaType = await unixRequest(socketPath, {
    body: voteBody,
    headers: { ...writeHeaders, 'content-type': 'application/json-malicious' },
    method: 'POST',
    path: '/api/votes',
  });
  assert.equal(badMediaType.status, 400);

  const oversizedBody = 'x'.repeat(513);
  const oversized = await unixRequest(socketPath, {
    body: oversizedBody,
    headers: {
      ...writeHeaders,
      'content-length': Buffer.byteLength(oversizedBody),
    },
    method: 'POST',
    path: '/api/votes',
  });
  assert.equal(oversized.status, 413);

  const accepted = await unixRequest(socketPath, {
    body: voteBody,
    headers: writeHeaders,
    method: 'POST',
    path: '/api/votes',
  });
  assert.equal(accepted.status, 201);
  assert.equal(accepted.body.accepted, true);

  const duplicateBody = JSON.stringify({
    choice: 'no',
    marketId: ACTIVE_MARKET_ID,
  });
  const duplicate = await unixRequest(socketPath, {
    body: duplicateBody,
    headers: {
      ...writeHeaders,
      'content-length': Buffer.byteLength(duplicateBody),
    },
    method: 'POST',
    path: '/api/votes',
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.choice, 'yes');
  assert.equal(readFileSync(ledger, 'utf8').includes('198.51.100.8'), false);
});
