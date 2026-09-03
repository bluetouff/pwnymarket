export const MARKET_PAGE_SIZE = 10;

function searchText(value) {
  return typeof value === 'string'
    ? value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr')
    : '';
}

export function getMarketPage(
  markets,
  { category = 'Tous', query = '', page = 1 } = {},
) {
  const needle = searchText(query).trim();
  const matches = markets.filter(
    (market) =>
      (category === 'Tous' || market.category === category) &&
      searchText(
        [
          market.title,
          market.service,
          market.category,
          market.detail,
          market.oracle,
          market.symbol,
        ].join(' '),
      ).includes(needle),
  );
  const total = matches.length;
  const totalPages = Math.max(1, Math.ceil(total / MARKET_PAGE_SIZE));
  const current = Math.min(
    totalPages,
    Number.isSafeInteger(page) && page > 0 ? page : 1,
  );
  const offset = (current - 1) * MARKET_PAGE_SIZE;
  return {
    items: matches.slice(offset, offset + MARKET_PAGE_SIZE),
    page: current,
    totalPages,
    total,
    from: total ? offset + 1 : 0,
    to: Math.min(offset + MARKET_PAGE_SIZE, total),
  };
}
