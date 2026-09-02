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

import {
  ACTIVE_MARKET_ID,
  MARKET_IDS,
  createVoterKey,
  isSameOriginVoteRequest,
  normalizeProxyIp,
  SECURITY_HEADERS,
} from '../runtime/security.mjs';
import { VoteStore } from '../runtime/store.mjs';
import { renderShareLinks } from '../runtime/share.mjs';

const secret = '0123456789abcdef0123456789abcdef';
const namespace = 'pwnymarket-test-v1';

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
            body: text
              ? response.headers['content-type']?.includes('application/json')
                ? JSON.parse(text)
                : text
              : null,
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
  const voterKey = createVoterKey(secret, ip, ACTIVE_MARKET_ID, namespace);
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
  const voterKey = createVoterKey(secret, ip, ACTIVE_MARKET_ID, namespace);
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

void test('all markets have independent durable votes and different HMAC identities', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pwnymarket-multi-'));
  const ledger = join(directory, 'votes.ndjson');
  const store = new VoteStore(ledger);
  const keys = new Set();
  assert.equal(MARKET_IDS.size, 12);
  for (const id of MARKET_IDS) {
    const key = createVoterKey(secret, '192.0.2.50', id, namespace);
    keys.add(key);
    assert.equal(store.summary(id, key).total, 0);
    assert.equal(store.record(id, key, 'yes'), true);
    assert.equal(store.record(id, key, 'no'), false);
    assert.equal(store.summary(id, key).total, 1);
  }
  assert.equal(keys.size, MARKET_IDS.size);
  assert.throws(() =>
    createVoterKey(secret, '192.0.2.50', '__proto__', namespace),
  );
  assert.throws(() => store.record('unknown', [...keys][0], 'yes'));
  store.close();
  const reopened = new VoteStore(ledger);
  for (const id of MARKET_IDS) {
    assert.equal(
      reopened.summary(id, createVoterKey(secret, '192.0.2.50', id, namespace))
        .choice,
      'yes',
    );
    assert.equal(reopened.summary(id, '').total, 1);
  }
  reopened.close();
});

void test('home links to dedicated privacy, uses local lighter type and has no privacy card', () => {
  const html = readFileSync(
    new URL('../runtime/public/index.html', import.meta.url),
    'utf8',
  );
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /src="\/marianne.png"/);
  assert.doesNotMatch(
    html,
    /Une empreinte|CONFIDENTIALITÉ|<span class="logo">P/,
  );
  const css = readFileSync(
    new URL('../runtime/public/styles.css', import.meta.url),
    'utf8',
  );
  assert.match(
    css,
    /\.intro h1 \{[^}]*font-family: 'Manrope'[^}]*font-weight: 500;/s,
  );
  assert.doesNotMatch(css, /url\(['"]?https?:/);
});

void test('privacy is short visitor copy and every public footer credits the creator', () => {
  const privacy = readFileSync(
    new URL('../runtime/public/privacy.html', import.meta.url),
    'utf8',
  );
  const main = privacy.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1];
  assert.match(main, /Le guichet de la vie privée/);
  assert.match(main, /code propre à\s+chaque marché/);
  assert.match(main, /quatorze derniers jours/);
  assert.doesNotMatch(
    main,
    /HMAC|sudo|GitHub|secret|configur|déploi|\/etc\/|\/var\//i,
  );
  assert.ok(
    main
      .replace(/<[^>]+>/g, ' ')
      .trim()
      .split(/\s+/).length < 260,
  );
  for (const name of ['index', 'about', 'privacy', 'archives', '404']) {
    const html = readFileSync(
      new URL(`../runtime/public/${name}.html`, import.meta.url),
      'utf8',
    );
    assert.match(
      html,
      /<footer\b[^>]*>[\s\S]*<p class="footer-credit">\s*powered by <a href="https:\/\/x\.com\/bluetouff">@bluetouff<\/a>[\s\S]*<\/footer>/,
    );
    assert.doesNotMatch(html.replace(/<[^>]+>/g, ' '), /[,.;]\s+pas\b/i);
    assert.match(html, /<span class="brand-domain">\.fr<\/span/);
    assert.match(html, /href="\/archives"/);
    assert.match(html, /href="https:\/\/l0g\.fr\/">l0g\.fr<\/a>/);
  }
  const css = readFileSync(
    new URL('../runtime/public/styles.css', import.meta.url),
    'utf8',
  );
  assert.match(css, /\.brand-domain \{\s*color: var\(--red\);/);
  const credit = css.match(/\.site-footer \.footer-credit \{([^}]+)\}/)[1];
  for (const rule of [
    'width: 100%',
    'text-align: center',
    'color: var(--blue)',
    'font-size: 16px',
    'font-weight: 700',
  ])
    assert.ok(credit.includes(rule), rule);
});

void test('social cards use the new branded image URL and actual dimensions', () => {
  const html = readFileSync(
    new URL('../runtime/public/index.html', import.meta.url),
    'utf8',
  );
  const png = readFileSync(
    new URL('../runtime/public/og.png', import.meta.url),
  );
  const old = readFileSync(
    new URL('../runtime/public/og-v2.png', import.meta.url),
  );
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.notDeepEqual(png, old);
  for (const [label, value] of [
    ['width', png.readUInt32BE(16)],
    ['height', png.readUInt32BE(20)],
  ]) {
    assert.ok(html.includes(`property="og:image:${label}" content="${value}"`));
  }
  for (const attr of ['property="og:image"', 'name="twitter:image"']) {
    assert.ok(
      html.includes(
        `${attr}\n      content="https://pwnymarket.fr/assets/v3/og.png"`,
      ),
    );
  }
  assert.match(html, /name="twitter:creator" content="@bluetouff"/);
});

void test('ledger refuses an append beyond capacity without changing the file', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pwnymarket-capacity-'));
  const ledger = join(directory, 'votes.ndjson');
  const firstKey = createVoterKey(
    secret,
    '192.0.2.1',
    ACTIVE_MARKET_ID,
    namespace,
  );
  const secondKey = createVoterKey(
    secret,
    '192.0.2.2',
    ACTIVE_MARKET_ID,
    namespace,
  );
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
  const voterKey = createVoterKey(
    secret,
    '192.0.2.3',
    ACTIVE_MARKET_ID,
    namespace,
  );
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
    new URL('../runtime/public/index.html', import.meta.url),
    'utf8',
  );
  assert.equal(/<script(?![^>]*\ssrc=)/i.test(html), false);
  assert.equal(/\sstyle=/i.test(html), false);
});

void test('Unix-socket API accepts one vote and rejects a duplicate', async (context) => {
  const directory = mkdtempSync(join(tmpdir(), 'pwnymarket-server-'));
  const socketPath = join(directory, 'server.sock');
  const ledger = join(directory, 'votes.ndjson');
  const server = spawn(process.execPath, ['runtime/server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      PWNYMARKET_LEDGER: ledger,
      PWNYMARKET_PUBLIC_ORIGIN: 'https://pwnymarket.fr',
      PWNYMARKET_SOCKET: socketPath,
      VOTE_HASH_SECRET: secret,
      VOTE_HASH_NAMESPACE: namespace,
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

  for (const path of [
    '/about',
    '/privacy',
    '/archives',
    '/assets/v2/app.js',
    '/assets/v2/markets.js',
    '/assets/v2/styles.css',
    '/assets/v2/og.png',
    '/assets/v3/og.png',
    '/assets/v3/styles.css',
    '/assets/v4/styles.css',
    '/assets/v5/styles.css',
    '/assets/v6/styles.css',
    '/markets.js',
    '/manrope-medium.ttf',
    '/marianne.png',
  ]) {
    const asset = await unixRequest(socketPath, { path });
    assert.equal(asset.status, 200, path);
    assert.equal(
      asset.headers['content-security-policy'],
      SECURITY_HEADERS['Content-Security-Policy'],
    );
  }
  const archive = await unixRequest(socketPath, { path: '/archives' });
  assert.match(archive.body, /70 000 dossiers/);
  assert.match(archive.body, /774 000 personnes/);
  assert.doesNotMatch(archive.body, /ARCHIVE_ENTRIES|<script\b/);
  for (const path of ['/', '/index.html', '/about', '/privacy', '/archives']) {
    const page = await unixRequest(socketPath, { path });
    assert.equal(page.status, 200);
    assert.ok(page.body.includes(renderShareLinks(path)), path);
    assert.doesNotMatch(page.body, /SHARE_LINKS/);
    assert.match(page.body, /href="\/assets\/v6\/styles.css"/);
    assert.equal(page.headers['x-dns-prefetch-control'], 'off');
    assert.equal(page.headers['referrer-policy'], 'no-referrer');
    assert.equal(page.headers['set-cookie'], undefined);
  }
  for (const path of [
    '/404',
    '/page-inconnue',
    '/%3Cscript%3Ealert(1)%3C/script%3E',
    '/.env',
    '/missing?visitor=private-value',
    '/?visitor=private-value',
  ]) {
    const missing = await unixRequest(socketPath, { path });
    assert.equal(missing.status, 404);
    assert.match(missing.headers['content-type'], /^text\/html/);
    assert.equal(
      missing.headers['content-security-policy'],
      SECURITY_HEADERS['Content-Security-Policy'],
    );
    assert.equal(missing.headers['x-robots-tag'], 'noindex');
    assert.match(missing.body, /Cette page a pris la fuite/);
    assert.match(missing.body, /href="\/">Retour aux marchés/);
    assert.doesNotMatch(
      missing.body,
      /alert\(1\)|<script\b|style=|private-value|SHARE_LINKS/,
    );
    assert.ok(missing.body.includes(renderShareLinks('/404')));
  }
  const missingApi = await unixRequest(socketPath, { path: '/api/unknown' });
  assert.equal(missingApi.status, 404);
  assert.deepEqual(missingApi.body, { error: 'not_found' });
  const missingHead = await unixRequest(socketPath, {
    path: '/404',
    method: 'HEAD',
  });
  assert.equal(missingHead.status, 404);
  assert.equal(missingHead.body, null);
  const all = await unixRequest(socketPath, {
    headers: proxyHeaders,
    path: '/api/markets',
  });
  assert.equal(all.status, 200);
  assert.deepEqual(
    Object.keys(all.body.markets).sort(),
    [...MARKET_IDS].sort(),
  );
  assert.equal(all.headers['cache-control'], 'no-store, max-age=0');
  assert.equal(all.headers['set-cookie'], undefined);
  assert.equal(JSON.stringify(all.body).includes('voterKey'), false);
  assert.equal(
    (await unixRequest(socketPath, { path: '/api/markets' })).status,
    503,
  );
  assert.equal(
    (
      await unixRequest(socketPath, {
        headers: proxyHeaders,
        path: '/api/votes?market=unknown',
      })
    ).status,
    400,
  );

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
  const otherId = [...MARKET_IDS].find((id) => id !== ACTIVE_MARKET_ID);
  const otherBody = JSON.stringify({ marketId: otherId, choice: 'no' });
  const other = await unixRequest(socketPath, {
    body: otherBody,
    headers: {
      ...writeHeaders,
      'content-length': Buffer.byteLength(otherBody),
    },
    method: 'POST',
    path: '/api/votes',
  });
  assert.equal(other.status, 201);
  assert.equal(other.body.total, 1);
  assert.equal(other.body.no, 1);
  const allAfter = await unixRequest(socketPath, {
    headers: proxyHeaders,
    path: '/api/markets',
  });
  assert.equal(allAfter.body.markets[ACTIVE_MARKET_ID].choice, 'yes');
  assert.equal(allAfter.body.markets[otherId].choice, 'no');
  for (const id of MARKET_IDS) {
    if (![ACTIVE_MARKET_ID, otherId].includes(id))
      assert.equal(allAfter.body.markets[id].total, 0);
  }
  assert.equal(readFileSync(ledger, 'utf8').includes('198.51.100.8'), false);
});
