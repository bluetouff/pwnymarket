import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { renderShareLinks } from '../runtime/share.mjs';
import { SECURITY_HEADERS } from '../runtime/security.mjs';

const pages = [
  ['/', 'index'],
  ['/about', 'about'],
  ['/privacy', 'privacy'],
  ['/archives', 'archives'],
  ['/404', '404'],
];

function linksFrom(html) {
  return [...html.matchAll(/<a\b([^>]*)href="([^"]+)"([^>]*)>(.*?)<\/a>/g)].map(
    (match) => ({
      attributes: match[1] + match[3],
      label: match[4].replace(/<span\b[^>]*>.*?<\/span>/g, ''),
      url: new URL(match[2].replaceAll('&amp;', '&')),
    }),
  );
}

test('all public pages have five script-free shares for their fixed URL and title', () => {
  for (const [route, file] of pages) {
    const source = readFileSync(
      new URL(`../runtime/public/${file}.html`, import.meta.url),
      'utf8',
    );
    const title = source.match(/<title>([^<]+)<\/title>/)[1];
    assert.equal(source.split('<!-- SHARE_LINKS -->').length, 2);
    assert.match(source, /<\/header>\s*<!-- SHARE_LINKS -->/);
    const html = renderShareLinks(route);
    const links = linksFrom(html);
    assert.deepEqual(
      links.map((link) => link.label),
      ['X', 'Bluesky', 'LinkedIn', 'Facebook', 'Envoyer par email'],
    );
    const canonical = 'https://pwnymarket.fr' + route;
    const [x, bluesky, linkedin, facebook, email] = links;
    assert.equal(
      x.url.origin + x.url.pathname,
      'https://twitter.com/intent/tweet',
    );
    assert.deepEqual(
      [...x.url.searchParams],
      [
        ['url', canonical],
        ['text', title],
      ],
    );
    assert.equal(
      bluesky.url.origin + bluesky.url.pathname,
      'https://bsky.app/intent/compose',
    );
    assert.deepEqual(
      [...bluesky.url.searchParams],
      [['text', title + '\n' + canonical]],
    );
    assert.equal(
      linkedin.url.origin + linkedin.url.pathname,
      'https://www.linkedin.com/sharing/share-offsite/',
    );
    assert.deepEqual([...linkedin.url.searchParams], [['url', canonical]]);
    assert.equal(
      facebook.url.origin + facebook.url.pathname,
      'https://www.facebook.com/sharer/sharer.php',
    );
    assert.deepEqual([...facebook.url.searchParams], [['u', canonical]]);
    assert.equal(email.url.protocol, 'mailto:');
    assert.equal(email.url.pathname, '');
    assert.deepEqual(
      [...email.url.searchParams],
      [
        ['subject', title],
        ['body', title + '\r\n\r\n' + canonical],
      ],
    );
    assert.doesNotMatch(email.url.href, /\+/);
    assert.doesNotMatch(email.attributes, /target=/);
    for (const { attributes } of links.slice(0, 4)) {
      assert.match(attributes, /target="_blank"/);
      assert.match(attributes, /rel="noopener noreferrer"/);
      assert.match(attributes, /referrerpolicy="no-referrer"/);
      assert.match(attributes, /aria-label="[^"\n]+nouvel onglet/);
    }
    assert.doesNotMatch(
      html,
      /<(?:script|iframe|img|link|form)\b|\s(?:on\w+|ping|style)=|utm_/i,
    );
  }
});

test('share renderer rejects arbitrary paths, query strings, hosts and private routes', () => {
  assert.equal(renderShareLinks('/index.html'), renderShareLinks('/'));
  for (const route of [
    '/stats/',
    '/healthz',
    '/api/markets',
    '/unknown',
    '/?token=private',
    '/#visitor',
    '//evil.example',
    'https://evil.example',
    '"><script>alert(1)</script>',
    '__proto__',
    null,
    undefined,
  ]) {
    assert.throws(() => renderShareLinks(route), /Unknown share page/);
  }
});

test('public resources remain local with no widgets, preconnects or tracking handlers', () => {
  const directory = new URL('../runtime/public/', import.meta.url);
  for (const file of readdirSync(directory)) {
    if (!/\.(?:html|css|js)$/.test(file)) continue;
    const source = readFileSync(new URL(file, directory), 'utf8');
    assert.doesNotMatch(
      source,
      /\s(?:src|srcset)\s*=\s*["']\s*(?:https?:)?\/\//i,
      file,
    );
    assert.doesNotMatch(
      source,
      /<(?:iframe|embed|object)\b|\s(?:ping|on\w+)\s*=|rel=["'][^"']*(?:dns-prefetch|preconnect|prefetch)|sendBeacon|document\.cookie|localStorage|sessionStorage/i,
      file,
    );
    assert.doesNotMatch(
      source,
      /url\(\s*["']?(?:https?:)?\/\/|@import\b/i,
      file,
    );
    if (file.endsWith('.html')) {
      for (const match of source.matchAll(/<link\b[^>]*>/gi)) {
        if (/rel="canonical"/.test(match[0])) continue;
        assert.match(match[0], /href="\/(?!\/)/, file);
      }
    }
    if (file.endsWith('.js')) {
      assert.doesNotMatch(
        source,
        /fetch\(\s*["'`](?:https?:)?\/\/|XMLHttpRequest|WebSocket|EventSource/,
      );
    }
  }
  assert.equal(SECURITY_HEADERS['Referrer-Policy'], 'no-referrer');
  assert.equal(SECURITY_HEADERS['X-DNS-Prefetch-Control'], 'off');
  assert.doesNotMatch(
    SECURITY_HEADERS['Content-Security-Policy'],
    /https:|\*|unsafe-/,
  );
});

test('share cards match every indexable page and keep the branded local image', () => {
  for (const [route, file] of pages.filter(([route]) => route !== '/404')) {
    const source = readFileSync(
      new URL(`../runtime/public/${file}.html`, import.meta.url),
      'utf8',
    );
    const title = source.match(/<title>([^<]+)<\/title>/)[1];
    const metas = new Map(
      [
        ...source.matchAll(
          /<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"\s*\/>/g,
        ),
      ].map((match) => [match[1], match[2]]),
    );
    assert.equal(metas.get('og:title'), title);
    assert.equal(metas.get('twitter:title'), title);
    assert.equal(metas.get('og:url'), 'https://pwnymarket.fr' + route);
    assert.equal(
      metas.get('og:image'),
      'https://pwnymarket.fr/assets/v3/og.png',
    );
    assert.equal(metas.get('twitter:image'), metas.get('og:image'));
  }
});
