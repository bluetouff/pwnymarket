import assert from 'node:assert/strict';
import test from 'node:test';
import { ARCHIVES, ARCHIVE_REVIEWED_AT } from '../runtime/archive-data.mjs';
import { renderArchives } from '../runtime/archive.mjs';

test('archive records have distinct IDs, bounded dates and official sources only', () => {
  assert.equal(ARCHIVES.length, 24);
  assert.equal(new Set(ARCHIVES.map((item) => item.id)).size, ARCHIVES.length);
  const officialDomains = new Set([
    'www.impots.gouv.fr',
    'presse.economie.gouv.fr',
    'aefe.gouv.fr',
    'www.gagny.fr',
    'numerique.gouv.fr',
    'www.numerique.gouv.fr',
    'www.ville-quiberon.fr',
    'www.enseignementsup-recherche.gouv.fr',
    'www.interieur.gouv.fr',
    'www.education.gouv.fr',
    'www.bourgogne-franche-comte.ars.sante.fr',
    'www.lescrous.fr',
    'www.sports.gouv.fr',
    'ofb.gouv.fr',
    'www.urssaf.org',
    'www.jeunes.gouv.fr',
    'www.francetravail.org',
    'brest.fr',
    'www.hautsdefrance.fr',
    'www.mairie-fontromeu.fr',
    'www.normandie.ars.sante.fr',
    'www.hauts-de-france.ars.sante.fr',
    'www.pays-de-la-loire.ars.sante.fr',
  ]);
  for (const item of ARCHIVES) {
    assert.match(item.id, /^[a-z0-9-]+$/);
    assert.match(item.date, /^202[56]-\d{2}-\d{2}$/);
    assert.equal(new Date(item.date).toISOString().slice(0, 10), item.date);
    assert.ok(item.date <= ARCHIVE_REVIEWED_AT);
    assert.ok(
      item.administration &&
        item.service &&
        item.volume &&
        item.status &&
        item.detail,
    );
    assert.ok(item.sources.length);
    for (const [label, href] of item.sources) {
      const url = new URL(href);
      assert.equal(url.protocol, 'https:');
      assert.ok(officialDomains.has(url.hostname), href);
      assert.ok(label);
    }
    assert.doesNotMatch(item.detail, /[,.;]\s+pas\b/i);
  }
});

test('archive preserves qualifiers, units and incidents announced in a later year', () => {
  const byId = new Map(ARCHIVES.map((item) => [item.id, item]));
  assert.equal(
    byId.get('brest-2025').volume,
    'Environ 50 000 lignes de contacts',
  );
  assert.match(byId.get('ficoba-2026').volume, /comptes potentiellement/);
  assert.match(byId.get('ants-2026').volume, /comptes potentiellement/);
  assert.match(byId.get('pajemploi-2025').volume, /Jusqu’à/);
  assert.match(byId.get('sports-2025').volume, /foyers/);
  assert.match(byId.get('parcoursup-occitanie-2025').detail, /octobre 2025/);
  assert.match(byId.get('educonnect-2025').detail, /fin de 2025/);
  assert.match(byId.get('font-romeu-2025').volume, /Fuite non établie/);
  assert.match(byId.get('ofb-2026').volume, /Non précisé/);
  const html = renderArchives();
  assert.equal(
    (html.match(/class="archive-entry"/g) || []).length,
    ARCHIVES.length,
  );
  for (const item of ARCHIVES) assert.ok(html.includes(`id="${item.id}"`));
});

test('archive renderer escapes editorial text and refuses executable source URLs', () => {
  const item = {
    ...ARCHIVES[0],
    administration: '<img src=x onerror=alert(1)>',
    sources: [['<script>source</script>', 'https://www.impots.gouv.fr/']],
  };
  const html = renderArchives([item]);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script&gt;source/);
  assert.doesNotMatch(html, /<img|<script/);
  for (const href of [
    'javascript:alert(1)',
    'http://example.org/',
    'https://user:password@example.org/',
  ]) {
    assert.throws(() =>
      renderArchives([{ ...item, sources: [['Source', href]] }]),
    );
  }
});
