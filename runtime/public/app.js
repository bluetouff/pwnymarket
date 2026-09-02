import { MARKETS } from './markets.js';

const summaries = new Map(
  MARKETS.map((market) => [
    market.id,
    { summary: null, selected: null, submitting: false, error: '' },
  ]),
);
const ballots = new Map(MARKETS.map((market) => [market.id, []]));
const grid = document.querySelector('#market-grid');
const filterButtons = [...document.querySelectorAll('[data-filter]')];
let filter = 'Tous';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

for (const market of MARKETS) {
  const card = element('article', 'market-card');
  card.dataset.market = market.id;
  card.dataset.category = market.category;
  const head = element('div', 'card-head');
  head.append(element('span', 'service-symbol', market.symbol));
  const label = element('div');
  label.append(
    element('small', '', market.category),
    element('p', '', market.service),
  );
  head.append(label);
  const title = element('h3', '', market.title);
  title.id = 'title-' + market.id;
  card.setAttribute('aria-labelledby', title.id);
  const choices = element('div', 'choices');
  for (const [choice, name] of [
    ['yes', 'YES · OUI'],
    ['no', 'NO · NON'],
  ]) {
    const button = element('button', 'choice ' + choice);
    button.type = 'button';
    button.dataset.choice = choice;
    const quote = element('strong', '', '…');
    quote.dataset.quote = choice;
    button.append(element('span', '', name), quote);
    choices.append(button);
  }
  const tally = element('div', 'tally');
  const total = element('span', '', 'Chargement…');
  total.dataset.total = '';
  tally.append(
    total,
    element('span', 'fake-volume', market.volume + ' PNY fictifs'),
  );
  const submit = element('button', 'submit', 'Choisir son camp');
  submit.type = 'button';
  const status = element('p', 'status');
  status.setAttribute('aria-live', 'polite');
  const oracle = element('div', 'card-oracle', '✳ Oracle : ');
  oracle.append(element('b', '', market.oracle));
  card.append(
    head,
    title,
    element('p', 'card-detail', market.detail),
    choices,
    tally,
    submit,
    status,
    oracle,
  );
  grid.append(card);
}
for (const ballot of document.querySelectorAll('[data-market]')) {
  const id = ballot.dataset.market;
  ballots.get(id).push(ballot);
  for (const button of ballot.querySelectorAll('[data-choice]')) {
    button.addEventListener('click', () => {
      const state = summaries.get(id);
      if (!state.summary || state.summary.hasVoted || state.submitting) return;
      state.selected = button.dataset.choice;
      render(id);
    });
  }
  ballot
    .querySelector('.submit')
    .addEventListener('click', () => castVote(id, summaries.get(id).selected));
}

export function validSummary(value) {
  return (
    value &&
    typeof value === 'object' &&
    ['yes', 'no', 'total', 'yesPercent', 'noPercent'].every(
      (key) => Number.isSafeInteger(value[key]) && value[key] >= 0,
    ) &&
    value.total === value.yes + value.no &&
    value.yesPercent <= 100 &&
    value.yesPercent ===
      (value.total ? Math.round((value.yes / value.total) * 100) : 50) &&
    value.noPercent === 100 - value.yesPercent &&
    [null, 'yes', 'no'].includes(value.choice) &&
    value.hasVoted === (value.choice !== null)
  );
}

function render(id) {
  const state = summaries.get(id);
  const summary = state.summary;
  for (const ballot of ballots.get(id)) {
    const locked =
      !summary || summary.hasVoted || state.submitting || Boolean(state.error);
    for (const button of ballot.querySelectorAll('[data-choice]')) {
      button.disabled = locked;
      const selected = state.selected === button.dataset.choice;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
    for (const choice of ['yes', 'no']) {
      ballot.querySelector('[data-quote="' + choice + '"]').textContent =
        summary ? summary[choice + 'Percent'] + ' ¢' : '…';
    }
    ballot.querySelector('[data-total]').textContent = summary
      ? summary.total +
        (summary.total > 1 ? ' votes' : ' vote') +
        (!summary.total ? ' · cote neutre' : '')
      : state.error
        ? 'Votes indisponibles'
        : 'Chargement des votes…';
    const progress = ballot.querySelector('progress');
    if (progress && summary) {
      progress.value = summary.yesPercent;
      progress.textContent = summary.yesPercent + ' %';
    }
    const submit = ballot.querySelector('.submit');
    submit.disabled = locked || !state.selected;
    submit.textContent = state.submitting
      ? 'Dépouillement du grand n’importe quoi…'
      : summary?.hasVoted
        ? 'Vote ' + (summary.choice === 'yes' ? 'OUI' : 'NON') + ' enregistré'
        : state.selected
          ? 'Confirmer ' + (state.selected === 'yes' ? 'OUI' : 'NON') + ' · 0 €'
          : 'Choisir son camp';
    ballot.querySelector('.status').textContent =
      state.error ||
      (summary?.hasVoted
        ? 'Votre mauvaise foi a bien été comptabilisée.'
        : '1 voix par IP et par marché · centimes fictifs');
  }
  if (id === MARKETS[0].id) {
    document.querySelector('#chart-yes').textContent = summary
      ? summary.yesPercent + ' %'
      : '…';
  }
}

async function castVote(id, choice) {
  const state = summaries.get(id);
  if (
    !state ||
    !['yes', 'no'].includes(choice) ||
    !state.summary ||
    state.summary.hasVoted ||
    state.submitting ||
    state.error
  ) {
    return { accepted: false, error: 'vote_not_available' };
  }
  state.submitting = true;
  render(id);
  try {
    const response = await fetch('/api/votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketId: id, choice }),
      signal: AbortSignal.timeout(10000),
    });
    const body = await response.json();
    if (
      ![201, 409].includes(response.status) ||
      !validSummary(body) ||
      !body.hasVoted
    )
      throw new Error('unavailable');
    state.summary = body;
    state.selected = body.choice;
    return {
      accepted: response.status === 201,
      choice: body.choice,
      total: body.total,
    };
  } catch {
    state.error =
      'Confirmation indisponible. Rechargez pour vérifier votre vote.';
    return { accepted: false, error: 'vote_service_unavailable' };
  } finally {
    state.submitting = false;
    render(id);
  }
}

async function load() {
  try {
    const response = await fetch('/api/markets', {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    const body = await response.json();
    if (
      !response.ok ||
      !body.markets ||
      !MARKETS.every((market) => validSummary(body.markets[market.id]))
    )
      throw new Error('unavailable');
    for (const market of MARKETS) {
      const state = summaries.get(market.id);
      state.summary = body.markets[market.id];
      state.selected = state.summary.choice;
      render(market.id);
    }
  } catch {
    for (const market of MARKETS) {
      summaries.get(market.id).error =
        'Urne indisponible. Revenez après la pause café.';
      render(market.id);
    }
  }
}

function filterMarkets() {
  const query = document
    .querySelector('#market-search')
    .value.trim()
    .toLocaleLowerCase('fr');
  let count = 0;
  for (const card of grid.children) {
    const matches =
      (filter === 'Tous' || card.dataset.category === filter) &&
      card.textContent.toLocaleLowerCase('fr').includes(query);
    card.hidden = !matches;
    if (matches) count++;
  }
  document.querySelector('#empty-markets').hidden = count !== 0;
}
for (const button of filterButtons) {
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    for (const item of filterButtons)
      item.setAttribute('aria-pressed', String(item === button));
    filterMarkets();
  });
}
document
  .querySelector('#market-search')
  .addEventListener('input', filterMarkets);
if (document.modelContext?.registerTool) {
  document.modelContext.registerTool({
    annotations: {
      destructiveHint: false,
      idempotentHint: false,
      readOnlyHint: false,
    },
    description:
      'Enregistrer un vote satirique sans argent. Une voix par IP et par marché.',
    execute: ({ marketId = MARKETS[0].id, choice }) =>
      castVote(marketId, choice),
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        marketId: { type: 'string', enum: MARKETS.map((market) => market.id) },
        choice: { type: 'string', enum: ['yes', 'no'] },
      },
      required: ['choice'],
    },
    name: 'cast_pwnymarket_vote',
  });
}
for (const market of MARKETS) render(market.id);
void load();
