export const STATUS_LABELS = Object.freeze({
  open: 'Urne ouverte',
  closed: 'Guichet fermé',
  resolved: 'Le réel a tranché',
});

export function validSummary(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    ['yes', 'no', 'total', 'yesPercent', 'noPercent'].every(
      (key) => Number.isSafeInteger(value[key]) && value[key] >= 0,
    ) &&
    Number.isSafeInteger(value.yes + value.no) &&
    value.total === value.yes + value.no &&
    value.yesPercent <= 100 &&
    value.yesPercent ===
      (value.total ? Math.round((value.yes / value.total) * 100) : 50) &&
    value.noPercent === 100 - value.yesPercent &&
    [null, 'yes', 'no'].includes(value.choice) &&
    value.hasVoted === (value.choice !== null) &&
    ['open', 'closed', 'resolved'].includes(value.status),
  );
}

// Zero votes has no index: a neutral opening quote is not an observed result.
export function denialIndex(summary) {
  return summary?.total > 0
    ? Math.round((200 * Math.min(summary.yes, summary.no)) / summary.total)
    : null;
}

export function rankMarkets(markets, summaries, sort = 'catalogue') {
  const result = [...markets];
  if (!['votes', 'disputed', 'consensus'].includes(sort)) return result;
  return result.sort((a, b) => {
    const first = summaries.get(a.id);
    const second = summaries.get(b.id);
    const aTotal = first?.total || 0;
    const bTotal = second?.total || 0;
    if (sort === 'votes') return bTotal - aTotal;
    // A split or consensus needs at least five ballots to enter the ranking.
    const aEligible = aTotal >= 5;
    const bEligible = bTotal >= 5;
    if (aEligible !== bEligible) return aEligible ? -1 : 1;
    if (!aEligible) return bTotal - aTotal;
    const aSplit = Math.min(first.yes, first.no) / aTotal;
    const bSplit = Math.min(second.yes, second.no) / bTotal;
    return (
      (sort === 'disputed' ? bSplit - aSplit : aSplit - bSplit) ||
      bTotal - aTotal
    );
  });
}

export function getDailyMarket(markets, date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  const candidates = markets
    .filter((market) => market.status === 'open')
    .sort((a, b) => a.id.localeCompare(b.id, 'en'));
  if (!candidates.length) return null;
  // Stable UTC rotation, without a job or a per-visitor seed.
  return candidates[Math.floor(Date.parse(day) / 86400000) % candidates.length];
}

export function getRandomMarket(markets, random = Math.random) {
  const candidates = markets.filter((market) => market.status === 'open');
  return candidates.length
    ? candidates[Math.floor(random() * candidates.length)]
    : null;
}
