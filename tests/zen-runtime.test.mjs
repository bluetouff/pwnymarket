import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdtempSync,
  openSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { isSupportedProductionRuntime } from '../deploy/zen/check-runtime.mjs';
import { assertPublicSecurityHeaders } from '../deploy/zen/check-public-headers.mjs';
import {
  ACTIVE_MARKET_ID,
  createVoterKey,
  isSameOriginVoteRequest,
  normalizeProxyIp,
  SECURITY_HEADERS,
} from '../zen/security.mjs';
import { VoteStore } from '../zen/store.mjs';

const secret = '0123456789abcdef0123456789abcdef';

void test('production rejects EOL, unpatched, prerelease and unreviewed Node lines', () => {
  for (const version of [
    '20.19.2',
    '22.23.1',
    '24.18.0',
    '24.20.0-rc.1',
    '25.0.0',
    '26.8.1',
    'invalid',
  ]) {
    assert.equal(isSupportedProductionRuntime(version), false, version);
  }
  for (const version of [
    '22.23.2',
    '22.24.0',
    '24.18.1',
    '24.19.0',
    '24.20.0',
    '24.20.1',
  ]) {
    assert.equal(isSupportedProductionRuntime(version), true, version);
  }
});

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
  const origin = 'https://pwnymarket.fr';
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

void test('ledger refuses an append beyond capacity without changing the file', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pwnymarket-capacity-'));
  const ledger = join(directory, 'votes.ndjson');
  const firstKey = createVoterKey(secret, '192.0.2.1', ACTIVE_MARKET_ID);
  const secondKey = createVoterKey(secret, '192.0.2.2', ACTIVE_MARKET_ID);
  const initial = new VoteStore(ledger);
  initial.record(ACTIVE_MARKET_ID, firstKey, 'yes');
  initial.close();
  const before = readFileSync(ledger);
  const full = new VoteStore(ledger, { maxBytes: before.length });
  assert.equal(full.record(ACTIVE_MARKET_ID, firstKey, 'no'), false);
  assert.throws(
    () => full.record(ACTIVE_MARKET_ID, secondKey, 'no'),
    /capacity/,
  );
  assert.deepEqual(readFileSync(ledger), before);
  assert.equal(full.summary(ACTIVE_MARKET_ID, secondKey).total, 1);
  full.close();
  assert.throws(
    () => new VoteStore(ledger, { maxBytes: before.length - 1 }),
    /too large/,
  );
});

void test('an I/O failure latches writes closed and never changes counters', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pwnymarket-io-failure-'));
  const ledger = join(directory, 'votes.ndjson');
  const store = new VoteStore(ledger);
  const voterKey = createVoterKey(secret, '192.0.2.3', ACTIVE_MARKET_ID);
  closeSync(store.fileDescriptor);
  store.fileDescriptor = openSync(ledger, 'r');
  assert.throws(
    () => store.record(ACTIVE_MARKET_ID, voterKey, 'yes'),
    /unavailable/,
  );
  assert.equal(store.failed, true);
  assert.throws(
    () => store.record(ACTIVE_MARKET_ID, voterKey, 'no'),
    /unavailable/,
  );
  assert.equal(store.summary(ACTIVE_MARKET_ID, voterKey).total, 0);
  assert.equal(readFileSync(ledger, 'utf8'), '');
  store.close();
});

void test('deployment denies shared-root filesystem access before copying code', () => {
  const guard = readFileSync(
    new URL('../deploy/zen/pwnymarket-private-files.conf', import.meta.url),
    'utf8',
  );
  assert.match(guard, /<Directory "\/var\/www\/html\/pwnymarket">/);
  assert.match(guard, /Require all denied/);
  assert.match(guard, /AllowOverride None/);
  const installer = readFileSync(
    new URL('../deploy/zen/install-runtime.sh', import.meta.url),
    'utf8',
  );
  assert.ok(
    installer.indexOf('a2enconf pwnymarket-private-files') <
      installer.indexOf('cp -a '),
  );
  assert.ok(
    installer.indexOf('systemctl reload apache2') < installer.indexOf('cp -a '),
  );
  const apache = readFileSync(
    new URL('../deploy/zen/pwnymarket.apache.conf', import.meta.url),
    'utf8',
  );
  assert.equal((apache.match(/CustomLog /g) || []).length, 2);
  assert.equal(/%(?:a|h|r|q|U)(?![A-Za-z])/.test(apache), false);
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

void test('Apache removes upstream security headers before assigning one public value', () => {
  const apache = readFileSync(
    new URL('../deploy/zen/pwnymarket.apache.conf', import.meta.url),
    'utf8',
  );
  const lines = apache.split('\n').map((line) => line.trim());
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    const unset = `Header onsuccess unset ${name}`;
    const set = `Header always set ${name} "${value}"`;
    assert.equal(lines.filter((line) => line === unset).length, 1, name);
    assert.equal(lines.filter((line) => line === set).length, 1, name);
    assert.ok(lines.indexOf(unset) < lines.indexOf(set), name);
  }
});

void test('public header verifier rejects duplicates and missing policies', () => {
  assert.doesNotThrow(() =>
    assertPublicSecurityHeaders(new Headers(SECURITY_HEADERS)),
  );
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    const duplicate = new Headers(SECURITY_HEADERS);
    duplicate.append(name, value);
    assert.throws(() => assertPublicSecurityHeaders(duplicate), {
      name: 'AssertionError',
    });
    const missing = new Headers(SECURITY_HEADERS);
    missing.delete(name);
    assert.throws(() => assertPublicSecurityHeaders(missing), {
      name: 'AssertionError',
    });
  }
});

void test('production origin is aligned across runtime, Apache, TLS and metadata', () => {
  for (const path of [
    '../zen/server.mjs',
    '../deploy/zen/pwnymarket.service',
    '../deploy/zen/pwnymarket.apache.conf',
    '../deploy/zen/activate-public.sh',
    '../zen/public/index.html',
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.ok(source.includes('https://pwnymarket.fr'), path);
    assert.equal(source.includes('pwnymarket.l0g.fr'), false, path);
  }
  const html = readFileSync(
    new URL('../zen/public/index.html', import.meta.url),
    'utf8',
  );
  assert.match(html, /rel="canonical" href="https:\/\/pwnymarket\.fr\/"/);
  assert.match(
    html,
    /property="og:image" content="https:\/\/pwnymarket\.fr\/og\.png"/,
  );
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
      PWNYMARKET_PUBLIC_ORIGIN: 'https://pwnymarket.fr',
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
    origin: 'https://pwnymarket.fr',
    'sec-fetch-site': 'same-origin',
  };
  const staleOrigin = await unixRequest(socketPath, {
    body: voteBody,
    headers: { ...writeHeaders, origin: 'https://pwnymarket.l0g.fr' },
    method: 'POST',
    path: '/api/votes',
  });
  assert.equal(staleOrigin.status, 403);
  assert.equal(readFileSync(ledger, 'utf8'), '');

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
