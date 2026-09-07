import { readFileSync } from 'node:fs';
import { MARKETS } from './public/markets.js';
import { ARCHIVES } from './archive-data.mjs';

const officialHosts = new Set(
  ARCHIVES.flatMap((item) =>
    item.sources.map(([, url]) => new URL(url).hostname),
  ),
);
const snapshotDate = '2026-09-03T07:28:36.000Z';
const defaultCriteria =
  'OUI : une publication officielle postérieure à l’ouverture confirme explicitement l’événement décrit dans la question. NON : une publication officielle en établit explicitement le contraire. Une absence de communiqué ne suffit pas. Une clôture sans preuve laisse le résultat en attente.';

function timestamp(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  )
    throw new TypeError('Invalid event timestamp');
  return Date.parse(value);
}

function text(value, limit) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit)
    return false;
  for (const character of value) {
    if (character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
      return false;
  }
  return true;
}

export function isOfficialSource(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname.endsWith('.gouv.fr') || officialHosts.has(url.hostname))
    );
  } catch {
    return false;
  }
}

// Versioned editorial events; no administrative write route is exposed.
export function createCatalogue(markets, events, now = Date.now()) {
  if (!Array.isArray(events)) throw new TypeError('Invalid market events');
  const catalogue = new Map(
    markets.map((market) => {
      const publishedAt = market.publishedAt || snapshotDate;
      if (timestamp(publishedAt) > now)
        throw new TypeError('Market publication is in the future');
      return [
        market.id,
        Object.freeze({
          ...market,
          publishedAt,
          criteria: market.criteria || defaultCriteria,
          status: 'open',
          closedAt: null,
          closureReason: null,
          resolution: null,
        }),
      ];
    }),
  );
  for (const event of events) {
    const market = catalogue.get(event?.marketId);
    if (
      !market ||
      timestamp(event.at) > now ||
      timestamp(event.at) < timestamp(market.publishedAt)
    )
      throw new TypeError('Invalid market event');
    if (event.type === 'closed') {
      if (
        market.status !== 'open' ||
        !text(event.reason, 500) ||
        Object.keys(event).sort().join(',') !== 'at,marketId,reason,type'
      )
        throw new TypeError('Invalid market closure');
      catalogue.set(
        market.id,
        Object.freeze({
          ...market,
          status: 'closed',
          closedAt: event.at,
          closureReason: event.reason,
        }),
      );
    } else if (event.type === 'resolved') {
      const source = event.source;
      if (
        market.status !== 'closed' ||
        timestamp(event.at) < timestamp(market.closedAt) ||
        !['yes', 'no'].includes(event.choice) ||
        !text(event.summary, 1200) ||
        !source ||
        !isOfficialSource(source.url) ||
        !text(source.title, 300) ||
        timestamp(source.publishedAt) < timestamp(market.publishedAt) ||
        timestamp(source.publishedAt) > timestamp(event.at) ||
        Object.keys(source).sort().join(',') !== 'publishedAt,title,url' ||
        Object.keys(event).sort().join(',') !==
          'at,choice,marketId,source,summary,type'
      )
        throw new TypeError('Invalid market resolution');
      catalogue.set(
        market.id,
        Object.freeze({
          ...market,
          status: 'resolved',
          resolution: Object.freeze({
            at: event.at,
            choice: event.choice,
            summary: event.summary,
            source: Object.freeze({ ...source }),
          }),
        }),
      );
    } else throw new TypeError('Unknown market event');
  }
  return catalogue;
}

export const MARKET_EVENTS = JSON.parse(
  readFileSync(new URL('./market-events.json', import.meta.url), 'utf8'),
);
export const CATALOGUE = createCatalogue(MARKETS, MARKET_EVENTS);
