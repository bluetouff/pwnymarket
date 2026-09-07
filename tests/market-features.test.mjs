import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { MARKETS } from '../runtime/public/markets.js';
import { createCatalogue, CATALOGUE } from '../runtime/catalogue.mjs';
import {
  denialIndex,
  getDailyMarket,
  getRandomMarket,
  rankMarkets,
  validSummary,
} from '../runtime/public/market-tools.js';
import { getMarketPage } from '../runtime/public/market-list.js';
import { renderFeed } from '../runtime/feed.mjs';
import { renderMarketPage } from '../runtime/market-page.mjs';
import { VoteStore } from '../runtime/store.mjs';
import { SECURITY_HEADERS } from '../runtime/security.mjs';

const id = MARKETS[0].id;
const closeEvent = {
  marketId: id,
  type: 'closed',
  at: '2026-09-04T12:00:00.000Z',
  reason: 'Clôture de test.',
};
// Fictional fixtures, never included in the public catalogue or its feed.
const resolveEvent = {
  marketId: id,
  type: 'resolved',
  at: '2026-09-05T12:00:00.000Z',
  choice: 'yes',
  summary: 'Événement de test confirmé.',
  source: {
    title: 'Communiqué de test',
    url: 'https://www.impots.gouv.fr/fixture-only',
    publishedAt: '2026-09-04T10:00:00.000Z',
  },
};
const now = Date.parse('2026-09-06T00:00:00.000Z');

function summary(yes, no) {
  const total = yes + no;
  const yesPercent = total ? Math.round((yes / total) * 100) : 50;
  return {
    yes,
    no,
    total,
    yesPercent,
    noPercent: 100 - yesPercent,
    choice: null,
    hasVoted: false,
    status: 'open',
  };
}

test('daily UTC rotation is stable within a day, changes the next day and skips closed markets', () => {
  const markets = [...CATALOGUE.values()];
  const first = getDailyMarket(markets, new Date('2026-09-07T00:00:00Z'));
  assert.equal(
    first.id,
    getDailyMarket([...markets].reverse(), new Date('2026-09-07T23:59:59Z')).id,
  );
  assert.notEqual(
    first.id,
    getDailyMarket(markets, new Date('2026-09-08T00:00:00Z')).id,
  );
  const closed = markets.map((market) => ({ ...market, status: 'closed' }));
  assert.equal(getDailyMarket(closed), null);
  assert.equal(getRandomMarket(closed), null);
  assert.equal(getRandomMarket(markets, () => 0).id, markets[0].id);
  assert.equal(getRandomMarket(markets, () => 0.99999).id, markets.at(-1).id);
  const only = closed.map((market, index) => ({
    ...market,
    status: index === 3 ? 'open' : 'closed',
  }));
  assert.equal(getDailyMarket(only).id, markets[3].id);
  assert.equal(getRandomMarket(only).id, markets[3].id);
});

test('rankings use real counts, gate small samples and preserve stable ties before pagination', () => {
  const markets = MARKETS.slice(0, 6);
  const counts = new Map(
    markets.map((market, index) => [
      market.id,
      [
        summary(0, 0),
        summary(1, 0),
        summary(50, 50),
        summary(10, 0),
        summary(20, 20),
        summary(1, 1),
      ][index],
    ]),
  );
  assert.equal(denialIndex(summary(0, 0)), null);
  assert.equal(denialIndex(summary(5, 5)), 100);
  assert.equal(denialIndex(summary(10, 0)), 0);
  assert.equal(denialIndex(summary(2, 3)), 80);
  assert.equal(denialIndex(summary(1, 2)), 67);
  assert.deepEqual(
    rankMarkets(markets, counts, 'disputed').map((m) => m.id),
    [2, 4, 3, 5, 1, 0].map((n) => markets[n].id),
  );
  assert.equal(rankMarkets(markets, counts, 'consensus')[0].id, markets[3].id);
  assert.equal(rankMarkets(markets, counts, 'votes')[0].id, markets[2].id);
  assert.deepEqual(rankMarkets(markets, counts, 'unknown'), markets);
  const ties = new Map(markets.map((market) => [market.id, summary(3, 3)]));
  assert.deepEqual(rankMarkets(markets, ties, 'disputed'), markets);
  const filtered = getMarketPage(
    markets.map((market, index) => ({
      ...market,
      status: index % 2 ? 'closed' : 'open',
    })),
    { status: 'closed' },
  );
  assert.equal(filtered.total, 3);
  assert.ok(filtered.items.every((market) => market.status === 'closed'));
  assert.ok(validSummary(summary(0, 0)));
  assert.equal(validSummary({ ...summary(2, 3), status: '__proto__' }), false);
  assert.equal(validSummary({ ...summary(2, 3), total: 999 }), false);
});

test('editorial lifecycle requires an ordered closure and dated official evidence', () => {
  assert.ok(
    [...CATALOGUE.values()].every((market) => market.status === 'open'),
  );
  const catalogue = createCatalogue(MARKETS, [closeEvent, resolveEvent], now);
  assert.equal(catalogue.get(id).status, 'resolved');
  assert.equal(catalogue.get(id).resolution.choice, 'yes');
  assert.equal(catalogue.size, 32);
  for (const events of [
    [resolveEvent],
    [closeEvent, closeEvent],
    [closeEvent, resolveEvent, closeEvent],
    [{ ...closeEvent, marketId: '__proto__' }],
    [{ ...closeEvent, at: '2026-02-30T12:00:00.000Z' }],
    [{ ...closeEvent, at: '2027-01-01T12:00:00.000Z' }],
    [closeEvent, { ...resolveEvent, choice: 'maybe' }],
    [
      closeEvent,
      {
        ...resolveEvent,
        source: {
          ...resolveEvent.source,
          publishedAt: '2026-08-01T12:00:00.000Z',
        },
      },
    ],
  ])
    assert.throws(() => createCatalogue(MARKETS, events, now));
  for (const url of [
    'javascript:alert(1)',
    'https://impots.gouv.fr.evil.example/test',
    'https://evil.example/test',
    'https://user@impots.gouv.fr/test',
    'http://impots.gouv.fr/test',
    'https://127.0.0.1/test',
  ]) {
    assert.throws(() =>
      createCatalogue(
        MARKETS,
        [
          closeEvent,
          { ...resolveEvent, source: { ...resolveEvent.source, url } },
        ],
        now,
      ),
    );
  }
});

test('closing freezes accepted votes across restart and leaves the ledger unchanged', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pwny-close-'));
  const path = join(directory, 'votes.ndjson');
  const first = new VoteStore(path);
  first.record(id, 'a'.repeat(64), 'yes');
  first.close();
  const before = readFileSync(path);
  for (const events of [[closeEvent], [closeEvent, resolveEvent]]) {
    const store = new VoteStore(path, {
      catalogue: createCatalogue(MARKETS, events, now),
    });
    assert.throws(() => store.record(id, 'b'.repeat(64), 'no'), {
      code: 'market_closed',
    });
    assert.equal(store.summary(id, 'a'.repeat(64)).total, 1);
    assert.equal(store.summary(id, 'a'.repeat(64)).choice, 'yes');
    assert.deepEqual(readFileSync(path), before);
    store.close();
  }
});

test('market metadata and shares target each record and safely escape editorial content', () => {
  for (const market of CATALOGUE.values()) {
    const html = renderMarketPage(market);
    assert.ok(
      html.includes('<title>' + market.title + ' · PwnyMarket.fr</title>'),
    );
    assert.ok(
      html.includes('content="https://pwnymarket.fr/m/' + market.id + '"'),
    );
    assert.ok(
      html.includes(encodeURIComponent('https://pwnymarket.fr/m/' + market.id)),
    );
    assert.doesNotMatch(
      html,
      /PAGE_TITLE|MARKET_CONTENT|SHARE_LINKS|property="og:image"/,
    );
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
  }
  const bad = renderMarketPage({
    ...CATALOGUE.get(id),
    title: '"><script>alert(1)</script>',
    detail: '<img src=x onerror=alert(2)>',
    criteria: '</p><script>bad()</script>',
  });
  assert.doesNotMatch(bad, /<script>alert|<img src=x|<script>bad/);
  assert.match(bad, /&lt;script&gt;/);
});

test('RSS has stable publication and lifecycle entries with safely encoded content', () => {
  const catalogue = createCatalogue(MARKETS, [closeEvent, resolveEvent], now);
  const feed = renderFeed(catalogue, [closeEvent, resolveEvent]);
  assert.equal((feed.match(/<item>/g) || []).length, 34);
  assert.equal(
    new Set(
      [...feed.matchAll(/<guid isPermaLink="false">([^<]+)<\/guid>/g)].map(
        (m) => m[1],
      ),
    ).size,
    34,
  );
  assert.match(feed, /https:\/\/pwnymarket.fr\/m\/impots-next-official-notice/);
  assert.match(feed, /fixture-only/);
  assert.doesNotMatch(feed, /voterKey|choice:|undefined|<script/);
  const bad = new Map([
    [
      id,
      {
        ...CATALOGUE.get(id),
        title: '<script>& "',
        detail: '</description><script>',
      },
    ],
  ]);
  assert.match(renderFeed(bad, []), /&lt;script&gt;&amp; &quot;/);
  assert.equal(renderFeed(catalogue, []), renderFeed(catalogue, []));
});

function get(socketPath, path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        socketPath,
        path,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body,
          }),
        );
      },
    );
    req.on('error', reject);
    req.setTimeout(2500, () => req.destroy(new Error('timeout')));
    req.end(options.body);
  });
}

test('HTTP serves all dossiers and RSS, rejects unknown/private routes and blocks stale-page votes after closure', async (context) => {
  const directory = mkdtempSync(join(tmpdir(), 'pwny-market-http-'));
  cpSync(new URL('../runtime/', import.meta.url), join(directory, 'runtime'), {
    recursive: true,
  });
  writeFileSync(join(directory, 'package.json'), '{"type":"module"}');
  writeFileSync(
    join(directory, 'runtime/market-events.json'),
    JSON.stringify([closeEvent, resolveEvent]),
  );
  const socketPath = join(directory, 'server.sock');
  const ledger = join(directory, 'votes.ndjson');
  const server = spawn(
    process.execPath,
    [join(directory, 'runtime/server.mjs')],
    {
      env: {
        ...process.env,
        PWNYMARKET_SOCKET: socketPath,
        PWNYMARKET_LEDGER: ledger,
        PWNYMARKET_PUBLIC_ORIGIN: 'https://pwnymarket.fr',
        VOTE_HASH_SECRET: 'a'.repeat(64),
        VOTE_HASH_NAMESPACE: 'pwny-test',
      },
      stdio: 'ignore',
    },
  );
  context.after(() => server.kill('SIGTERM'));
  for (let attempt = 0; !existsSync(socketPath) && attempt < 80; attempt++)
    await new Promise((resolve) => setTimeout(resolve, 25));
  assert.ok(existsSync(socketPath));
  for (const market of MARKETS) {
    const page = await get(socketPath, '/m/' + market.id, {
      headers: { host: 'untrusted.example' },
    });
    assert.equal(page.status, 200);
    assert.ok(page.body.includes('https://pwnymarket.fr/m/' + market.id));
    assert.doesNotMatch(page.body, /untrusted\.example/);
    assert.equal(
      page.headers['content-security-policy'],
      SECURITY_HEADERS['Content-Security-Policy'],
    );
    assert.equal(page.headers['set-cookie'], undefined);
  }
  const resolved = await get(socketPath, '/m/' + id);
  assert.match(resolved.body, /LE RÉEL A TRANCHÉ : OUI/);
  assert.match(resolved.body, /fixture-only/);
  const home = await get(socketPath, '/');
  assert.match(home.body, /LE MARCHÉ DU JOUR/);
  assert.doesNotMatch(home.body, /DAILY_MARKET/);
  assert.equal((await get(socketPath, '/feed.xml')).status, 200);
  assert.equal(
    (await get(socketPath, '/feed.xml', { method: 'HEAD' })).body,
    '',
  );
  for (const path of [
    '/m/unknown',
    '/m/__proto__',
    '/m/' + id + '?token=hidden',
    '/market-events.json',
    '/market.html',
    '/runtime/catalogue.mjs',
    '/api/admin',
  ])
    assert.equal((await get(socketPath, path)).status, 404, path);
  const body = JSON.stringify({ marketId: id, choice: 'yes' });
  const headers = {
    'x-forwarded-proto': 'https',
    'x-forwarded-for': '192.0.2.11',
    'content-type': 'application/json',
    origin: 'https://pwnymarket.fr',
  };
  const rejected = await get(socketPath, '/api/votes', {
    method: 'POST',
    body,
    headers,
  });
  assert.equal(rejected.status, 409);
  const value = JSON.parse(rejected.body);
  assert.equal(value.error, 'market_closed');
  assert.equal(value.status, 'resolved');
  assert.ok(validSummary(value));
  assert.equal(readFileSync(ledger, 'utf8'), '');
  assert.equal(
    (
      await get(socketPath, '/api/votes', {
        method: 'POST',
        body,
        headers: { ...headers, origin: 'https://evil.example' },
      })
    ).status,
    403,
  );
});
