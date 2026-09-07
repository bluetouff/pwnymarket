import { readFileSync } from 'node:fs';
import { escapeHtml as esc, marketPath, PUBLIC_ORIGIN } from './html.mjs';
import { renderShareLinks } from './share.mjs';
import { STATUS_LABELS } from './public/market-tools.js';

const template = readFileSync(
  new URL('./public/market.html', import.meta.url),
  'utf8',
);

function date(value) {
  return new Date(value).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function ballot(market) {
  return `<aside class="ballot" data-market="${market.id}" aria-label="Voter sur ce marché">
<div class="ballot-head"><h2>Placer un non-pari</h2><span>0,00 €</span></div>
<p class="muted">Votre capital : une conviction discutable.</p>
<span class="market-state" data-market-state>${STATUS_LABELS[market.status]}</span>
<div class="choices"><button class="choice yes" type="button" data-choice="yes" disabled><span>YES · OUI</span><strong data-quote="yes">…</strong></button><button class="choice no" type="button" data-choice="no" disabled><span>NO · NON</span><strong data-quote="no">…</strong></button></div>
<div class="tally"><span data-total>Chargement des votes…</span><progress max="100" value="50">50 %</progress></div>
<button class="submit" type="button" disabled>Choisir son camp</button>
<p class="status" aria-live="polite">Une voix par IP et par marché.</p>
<p class="denial" data-denial>Indice de déni : en attente des votes.</p>
<div class="oracle"><span aria-hidden="true">✳</span><div><small>ORACLE AGRÉÉ PAR LUI-MÊME</small><strong>${esc(market.oracle)}</strong><p>${esc(market.volume)} PNY fictifs</p></div></div>
</aside>`;
}

export function renderDaily(market, day) {
  if (!market)
    return '<section class="daily-empty"><h2>Tous les guichets sont fermés.</h2><p>Le comité du hasard attend la réouverture.</p></section>';
  return `<section class="featured daily-market" aria-labelledby="market-title" data-day="${day}">
<article class="market-main"><div class="meta"><span class="category">LE MARCHÉ DU JOUR</span><time datetime="${day}">${date(day)} · UTC</time></div>
<p class="daily-oracle">Le Conseil constitutionnel du pile ou face a tranché.</p>
<h2 id="market-title"><a href="${marketPath(market)}">${esc(market.title)}</a></h2>
<p class="daily-detail">${esc(market.detail)}</p>
<a class="text-link" href="${marketPath(market)}">Ouvrir le dossier ↗</a>
<p class="daily-footnote">Un tirage quotidien. Toute compétence serait une coïncidence.</p></article>${ballot(market)}</section>`;
}

function resolution(market) {
  if (market.status === 'open')
    return '<p>Urne ouverte. Le dossier suit son cours, ce qui peut prendre une certaine éternité.</p>';
  const closure = `<p>Guichet fermé le <time datetime="${market.closedAt}">${date(market.closedAt)}</time>. ${esc(market.closureReason)}</p>`;
  if (!market.resolution)
    return (
      closure +
      '<p>Résultat en attente. La commission cherche encore son tampon.</p>'
    );
  const result = market.resolution;
  return `<p class="resolution-verdict">LE RÉEL A TRANCHÉ : ${result.choice === 'yes' ? 'OUI' : 'NON'}</p>${closure}
<p>${esc(result.summary)}</p><p>Résolution du <time datetime="${result.at}">${date(result.at)}</time>.</p>
<a class="text-link" href="${esc(result.source.url)}" rel="noopener noreferrer" referrerpolicy="no-referrer">${esc(result.source.title)} ↗</a>
<p class="muted">Publication officielle du ${date(result.source.publishedAt)}.</p>`;
}

export function renderMarketPage(market) {
  const title = market.title + ' · PwnyMarket.fr';
  const main = `<a class="back-link" href="/#markets">← Retour à la salle des non-marchés</a>
<section class="featured market-dossier" aria-labelledby="market-title"><article class="market-main">
<div class="meta"><span class="category">${esc(market.category)}</span><span>${esc(market.service)}</span></div>
<h1 id="market-title">${esc(market.title)}</h1><p class="daily-detail">${esc(market.detail)}</p>
<p class="muted">Parodie · votes réels · aucun gain.</p></article>${ballot(market)}</section>
<section class="market-rules"><div><p class="eyebrow">Le règlement tient sur un Cerfa</p><h2>Ce qui permet de trancher</h2><p>${esc(market.criteria)}</p>
<p class="muted">L’oracle satirique est décoratif. Le verdict documenté repose sur la publication citée.</p></div><div><p class="eyebrow">État du dossier</p><h2>${STATUS_LABELS[market.status]}</h2>${resolution(market)}</div></section>
<noscript><p>Le dossier et ses sources sont consultables ici. Activez JavaScript pour lire le décompte et voter.</p></noscript>`;
  const replacements = new Map([
    ['<!-- PAGE_TITLE -->', esc(title)],
    ['<!-- PAGE_DESCRIPTION -->', esc(market.detail)],
    ['<!-- PAGE_URL -->', PUBLIC_ORIGIN + marketPath(market)],
    ['<!-- SHARE_LINKS -->', renderShareLinks(marketPath(market))],
    ['<!-- MARKET_CONTENT -->', main],
  ]);
  return template.replace(
    /<!-- (?:PAGE_TITLE|PAGE_DESCRIPTION|PAGE_URL|SHARE_LINKS|MARKET_CONTENT) -->/g,
    (key) => replacements.get(key),
  );
}
