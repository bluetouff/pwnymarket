import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { MARKETS } from '../runtime/public/markets.js';
import {
  getMarketPage,
  MARKET_PAGE_SIZE,
} from '../runtime/public/market-list.js';

const originalIds = [
  'impots-next-official-notice',
  'printer-runs-doom',
  'vim-before-retirement',
  'ransomware-needs-siret',
  'bug-bounty-tote-bag',
  'kubernetes-canteen',
  'soc-coffee-critical',
  'sudo-cerfa',
  'zero-trust-colleagues',
  'temporary-password-birthday',
  'airgap-coffee-usb',
  'pentest-one-useful-page',
  'siem-mark-all-read',
  'backup-on-same-nas',
  'hoodie-tv-expert',
  'cookies-49-clicks',
  'reboot-resilience-consulting',
  'flipper-parking-threat',
  'minitel-post-quantum',
  'rssi-friday-holidays',
  'ctf-find-cyber-invoice',
  'maintenance-before-incident',
  'friday-1759',
  'password-reset-reaction',
  'cerfa-data-leak',
  'franceconnect-loop',
  'captcha-minister',
  'pdf-final-final',
  'sovereign-excel',
  'ants-scanner',
  'ai-commission',
  'no-sensitive-data',
];

test('eight sourced shell markets keep every existing vote identifier', () => {
  assert.equal(MARKETS.length, 40);
  assert.equal(new Set(MARKETS.map((market) => market.id)).size, 40);
  assert.equal(MARKETS[0].id, originalIds[0]);
  for (const id of originalIds)
    assert.ok(
      MARKETS.some((market) => market.id === id),
      id,
    );
  assert.equal(
    MARKETS.filter((market) => !originalIds.includes(market.id)).length,
    8,
  );
  const html = readFileSync(
    new URL('../runtime/public/index.html', import.meta.url),
    'utf8',
  );
  assert.match(html, /40 marchés · 0 expert/);
  assert.match(html, /parcourir les 40 marchés/);
  const categories = new Set(
    [...html.matchAll(/data-filter="([^"]+)"/g)].map((match) => match[1]),
  );
  for (const market of MARKETS) {
    assert.match(market.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(categories.has(market.category), market.id);
    for (const key of [
      'title',
      'service',
      'oracle',
      'detail',
      'symbol',
      'volume',
    ]) {
      assert.equal(typeof market[key], 'string', market.id + ' ' + key);
      assert.ok(
        market[key].length > 0 && market[key].length <= 200,
        market.id + ' ' + key,
      );
      assert.doesNotMatch(market[key], /[<>]|—|[,.;]\s+pas\b/i);
    }
  }
});

test('ten markets per page cover the complete catalogue without gaps or duplicates', () => {
  assert.equal(MARKET_PAGE_SIZE, 10);
  const before = JSON.stringify(MARKETS);
  const pages = [1, 2, 3, 4].map((page) => getMarketPage(MARKETS, { page }));
  assert.deepEqual(
    pages.map((view) => view.items.length),
    [10, 10, 10, 10],
  );
  assert.deepEqual(
    pages.map((view) => [view.from, view.to]),
    [
      [1, 10],
      [11, 20],
      [21, 30],
      [31, 40],
    ],
  );
  assert.deepEqual(
    pages.flatMap((view) => view.items),
    MARKETS,
  );
  for (const [index, view] of pages.entries()) {
    assert.equal(view.total, 40);
    assert.equal(view.totalPages, 4);
    assert.equal(view.page, index + 1);
  }
  assert.equal(JSON.stringify(MARKETS), before);
});

test('shell markets expose dated stack evidence and are searchable by CVE', () => {
  const added = MARKETS.filter((market) => !originalIds.includes(market.id));
  for (const market of added) {
    assert.equal(market.publishedAt, '2026-11-18T15:18:00.000Z');
    assert.match(market.context, /CVE-2026-/);
    assert.match(market.criteria, /La présence d’une technologie/);
    assert.ok(market.sources.length >= 2);
    for (const source of market.sources) {
      assert.ok(source.title.length > 0);
      const url = new URL(source.url);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.username + url.password + url.port, '');
    }
  }
  for (const [query, expected] of [
    ['CVE-2026-114938', 2],
    ['CVE-2026-111497', 3],
    ['CVE-2026-109618', 3],
    ['CVE-2026-109619', 3],
  ])
    assert.equal(getMarketPage(MARKETS, { query }).total, expected);
  assert.equal(
    getMarketPage(MARKETS, { query: 'PostgreSQL' }).items[0].id,
    'insee-queen-java4shell-recensement',
  );
});

test('category and text filtering happen before pagination', () => {
  const sample = Array.from({ length: 25 }, (_, index) => ({
    ...MARKETS[0],
    id: 'sample-' + index,
    category: index < 13 ? 'Culture geek' : 'Bureaucratie',
    title: 'Mission Café ' + index,
  }));
  const view = getMarketPage(sample, {
    category: 'Culture geek',
    query: 'CAFE',
    page: 2,
  });
  assert.equal(view.total, 13);
  assert.equal(view.totalPages, 2);
  assert.deepEqual(
    view.items.map((market) => market.id),
    ['sample-10', 'sample-11', 'sample-12'],
  );
  assert.equal(
    getMarketPage(sample, { category: 'Culture geek', query: 'introuvable' })
      .total,
    0,
  );
});

test('search accepts accents, case and oracle or detail text independently of vote counters', () => {
  for (const query of ['  MINITEL  ', 'quantique', 'QUANTIQUE']) {
    assert.deepEqual(
      getMarketPage(MARKETS, { query }).items.map((market) => market.id),
      ['minitel-post-quantum'],
    );
  }
  assert.deepEqual(
    getMarketPage(MARKETS, { query: 'root, absent' }).items.map(
      (market) => market.id,
    ),
    ['sudo-cerfa'],
  );
  assert.deepEqual(
    getMarketPage(MARKETS, { query: 'L’ingenierie sociale' }).items.map(
      (market) => market.id,
    ),
    ['airgap-coffee-usb'],
  );
  assert.equal(
    getMarketPage(MARKETS, { category: 'Bureaucratie', query: 'Minitel' })
      .total,
    0,
  );
});

test('invalid and out-of-range pages are bounded, including after a narrower filter', () => {
  for (const page of [
    0,
    -1,
    1.2,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '2',
    null,
  ]) {
    assert.equal(getMarketPage(MARKETS, { page }).page, 1);
  }
  for (const page of [5, 100, Number.MAX_SAFE_INTEGER]) {
    assert.equal(getMarketPage(MARKETS, { page }).page, 4);
  }
  const filtered = getMarketPage(MARKETS, {
    category: 'Culture geek',
    page: 4,
  });
  assert.equal(filtered.page, 1);
  assert.ok(
    filtered.items.every((market) => market.category === 'Culture geek'),
  );
});

test('empty results and untrusted search text never create fictional matches', () => {
  for (const query of [
    '<img src=x onerror=alert(1)>',
    '__proto__',
    '.*',
    '[',
    "' OR 1=1",
  ]) {
    const view = getMarketPage(MARKETS, { query, page: 4 });
    assert.deepEqual(view, {
      items: [],
      page: 1,
      totalPages: 1,
      total: 0,
      from: 0,
      to: 0,
    });
  }
  assert.deepEqual(getMarketPage([], { page: 99 }), {
    items: [],
    page: 1,
    totalPages: 1,
    total: 0,
    from: 0,
    to: 0,
  });
  assert.equal(getMarketPage(MARKETS, { category: 'unknown' }).total, 0);
});

test('pagination has labelled controls, current-page feedback and safe DOM updates', () => {
  const app = readFileSync(
    new URL('../runtime/public/app.js', import.meta.url),
    'utf8',
  );
  assert.match(app, /setAttribute\('aria-label', 'Pages des marchés'\)/);
  assert.match(app, /setAttribute\('aria-controls', 'market-grid'\)/);
  assert.match(app, /setAttribute\('aria-current', 'page'\)/);
  assert.match(app, /setAttribute\('aria-live', 'polite'\)/);
  assert.match(app, /listHeading\.focus\(\)/);
  assert.match(app, /pagination\.hidden = view\.totalPages < 2/);
  assert.match(app, /card\.hidden = !visible\.has\(card\.dataset\.market\)/);
  assert.doesNotMatch(
    app,
    /innerHTML|outerHTML|insertAdjacentHTML|grid\.replaceChildren|grid\.remove/,
  );
  const css = readFileSync(
    new URL('../runtime/public/styles.css', import.meta.url),
    'utf8',
  );
  assert.match(
    css,
    /\.page-button \{[^}]*min-width: 44px;[^}]*min-height: 44px;/s,
  );
  assert.match(css, /\[hidden\] \{\s*display: none !important;/);
});
