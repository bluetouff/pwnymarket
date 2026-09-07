import { escapeHtml as xml, marketPath, PUBLIC_ORIGIN } from './html.mjs';

export function renderFeed(catalogue, events) {
  const entries = [...catalogue.values()].map((market) => ({
    market,
    id: market.id + ':published',
    at: market.publishedAt,
    title: market.title,
    description: 'Au catalogue : ' + market.detail,
  }));
  for (const event of events) {
    const market = catalogue.get(event.marketId);
    entries.push({
      market,
      id: market.id + ':' + event.type,
      at: event.at,
      title:
        (event.type === 'resolved'
          ? 'Le réel a tranché : '
          : 'Guichet fermé : ') + market.title,
      description:
        event.type === 'resolved'
          ? `${event.choice === 'yes' ? 'OUI' : 'NON'}. ${event.summary} Source : ${event.source.url}`
          : event.reason,
    });
  }
  entries.sort(
    (a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>Le Bulletin officiel du seum · PwnyMarket.fr</title>
<link>${PUBLIC_ORIGIN}/</link><description>Marchés absurdes, guichets fermés et verdicts sourcés. Publication garantie sans enveloppe timbrée.</description>
<language>fr</language><atom:link href="${PUBLIC_ORIGIN}/feed.xml" rel="self" type="application/rss+xml"/>
${entries.length ? `<lastBuildDate>${new Date(entries[0].at).toUTCString()}</lastBuildDate>` : ''}
${entries.map((entry) => `<item><title>${xml(entry.title)}</title><link>${PUBLIC_ORIGIN}${marketPath(entry.market)}</link><guid isPermaLink="false">${xml('pwnymarket:' + entry.id)}</guid><pubDate>${new Date(entry.at).toUTCString()}</pubDate><description>${xml(entry.description)}</description></item>`).join('\n')}
</channel></rss>`;
}
