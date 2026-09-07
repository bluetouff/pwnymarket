import { MARKETS } from './markets.js';
import { getMarketPage } from './market-list.js';
import {
  validSummary,
  STATUS_LABELS,
  denialIndex,
  rankMarkets,
  getRandomMarket,
} from './market-tools.js';
export { validSummary } from './market-tools.js';

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
let currentPage = 1;
let catalogue = MARKETS.map((market) => ({ ...market, status: 'open' }));
const cards = new Map();
let loadedDay = '';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

for (const market of grid ? MARKETS : []) {
  const card = element('article', 'market-card');
  card.hidden = true;
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
  const title = element('h3');
  const link = element('a', '', market.title);
  link.href = '/m/' + market.id;
  title.append(link);
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
  const marketState = element('span', 'market-state', 'Statut en cours…');
  marketState.dataset.marketState = '';
  const denial = element('p', 'denial');
  denial.dataset.denial = '';
  const dossier = element('a', 'card-link', 'Dossier & partage ↗');
  dossier.href = '/m/' + market.id;
  card.append(
    head,
    marketState,
    title,
    element('p', 'card-detail', market.detail),
    choices,
    tally,
    submit,
    status,
    denial,
    oracle,
    dossier,
  );
  grid.append(card);
  cards.set(market.id, card);
}
for (const ballot of document.querySelectorAll('[data-market]')) {
  const id = ballot.dataset.market;
  ballots.get(id).push(ballot);
  for (const button of ballot.querySelectorAll('[data-choice]')) {
    button.addEventListener('click', () => {
      const currentId = ballot.dataset.market;
      const state = summaries.get(currentId);
      if (!state.summary || state.summary.hasVoted || state.submitting) return;
      state.selected = button.dataset.choice;
      render(currentId);
    });
  }
  ballot.querySelector('.submit').addEventListener('click', () => {
    const currentId = ballot.dataset.market;
    void castVote(currentId, summaries.get(currentId).selected);
  });
}

function render(id) {
  const state = summaries.get(id);
  const summary = state.summary;
  for (const ballot of ballots.get(id)) {
    const locked =
      !summary ||
      summary.status !== 'open' ||
      summary.hasVoted ||
      state.submitting ||
      Boolean(state.error);
    const badge = ballot.querySelector('[data-market-state]');
    if (badge && summary) {
      badge.textContent = STATUS_LABELS[summary.status];
      badge.dataset.state = summary.status;
    } else if (badge && state.error) {
      badge.textContent = 'Statut indisponible';
    }
    const denial = ballot.querySelector('[data-denial]');
    if (denial) {
      const index = denialIndex(summary);
      denial.textContent = !summary
        ? 'Indice de déni : indisponible.'
        : index === null
          ? 'Indice de déni : premier bulletin attendu.'
          : 'Indice de déni : ' +
            index +
            ' / 100' +
            (summary.total < 5 ? ' · moins de 5 votes' : '');
    }
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
      : summary && summary.status !== 'open'
        ? summary.status === 'resolved'
          ? 'Verdict au dossier'
          : 'Guichet fermé'
        : summary?.hasVoted
          ? 'Vote ' + (summary.choice === 'yes' ? 'OUI' : 'NON') + ' enregistré'
          : state.selected
            ? 'Confirmer ' +
              (state.selected === 'yes' ? 'OUI' : 'NON') +
              ' · 0 €'
            : 'Choisir son camp';
    ballot.querySelector('.status').textContent =
      state.error ||
      (summary && summary.status !== 'open'
        ? 'Votes clos. Le décompte est conservé.'
        : summary?.hasVoted
          ? 'Votre mauvaise foi a bien été comptabilisée.'
          : '1 voix par IP et par marché · centimes fictifs');
  }
  if (id === MARKETS[0].id && document.querySelector('#chart-yes')) {
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
    state.summary.status !== 'open' ||
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
      (!body.hasVoted && body.error !== 'market_closed')
    )
      throw new Error('unavailable');
    state.summary = body;
    state.selected = body.choice;
    const market = catalogue.find((item) => item.id === id);
    market.status = body.status;
    updatePulse();
    return {
      accepted: response.status === 201,
      choice: body.choice,
      total: body.total,
      ...(body.error ? { error: body.error } : {}),
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
      !MARKETS.every((market) => validSummary(body.markets[market.id])) ||
      !Array.isArray(body.catalogue) ||
      body.catalogue.length !== MARKETS.length ||
      !MARKETS.every(
        (market) =>
          body.catalogue.filter(
            (item) =>
              item.id === market.id &&
              item.status === body.markets[market.id].status,
          ).length === 1,
      ) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(body.day) ||
      !(
        body.dailyMarketId === null ||
        MARKETS.some((market) => market.id === body.dailyMarketId)
      )
    )
      throw new Error('unavailable');
    catalogue = MARKETS.map((market) => ({
      ...market,
      status: body.markets[market.id].status,
    }));
    loadedDay = body.day;
    updateDaily(body.dailyMarketId, body.day);
    for (const market of MARKETS) {
      const state = summaries.get(market.id);
      state.summary = body.markets[market.id];
      state.error = '';
      state.selected = state.summary.choice;
      render(market.id);
    }
    updatePulse();
    if (grid) filterMarkets();
    const crisisButton = document.querySelector('#crisis-button');
    if (crisisButton)
      crisisButton.disabled = !catalogue.some(
        (market) => market.status === 'open',
      );
  } catch {
    const crisisButton = document.querySelector('#crisis-button');
    if (crisisButton) crisisButton.disabled = true;
    for (const market of MARKETS) {
      summaries.get(market.id).summary = null;
      summaries.get(market.id).error =
        'Urne indisponible. Revenez après la pause café.';
      render(market.id);
    }
    for (const id of ['pulse-total', 'pulse-disputed', 'pulse-consensus']) {
      const node = document.getElementById(id);
      if (node) {
        node.textContent = 'Dépouillement indisponible';
        node.removeAttribute('href');
      }
    }
  }
}

const listHeading = document.querySelector('#markets h2');
let results, pagination, previousPage, nextPage, pageNumbers;
if (grid) {
  listHeading.tabIndex = -1;
  results = element('p', 'market-results');
  results.id = 'market-results';
  results.setAttribute('role', 'status');
  results.setAttribute('aria-live', 'polite');
  results.setAttribute('aria-atomic', 'true');
  grid.before(results);
  pagination = element('nav', 'market-pagination');
  pagination.setAttribute('aria-label', 'Pages des marchés');
  previousPage = element('button', 'page-button', '← Précédente');
  nextPage = element('button', 'page-button', 'Suivante →');
  pageNumbers = element('div', 'page-numbers');
  for (const button of [previousPage, nextPage]) {
    button.type = 'button';
    button.setAttribute('aria-controls', 'market-grid');
  }
  pagination.append(previousPage, pageNumbers, nextPage);
  grid.after(pagination);
  document.querySelector('.market-count').textContent =
    MARKETS.length + ' marchés · 0 expert';
}

function changePage(page) {
  currentPage = page;
  filterMarkets();
  listHeading.focus();
}

function filterMarkets() {
  const counts = new Map(
    [...summaries].map(([id, state]) => [id, state.summary]),
  );
  const ordered = rankMarkets(
    catalogue,
    counts,
    document.querySelector('#market-sort')?.value || 'catalogue',
  );
  const view = getMarketPage(ordered, {
    category: filter,
    query: document.querySelector('#market-search').value,
    page: currentPage,
    status: document.querySelector('#market-status')?.value || 'all',
  });
  const focused = document.activeElement;
  for (const market of ordered) grid.append(cards.get(market.id));
  currentPage = view.page;
  const visible = new Set(view.items.map((market) => market.id));
  for (const card of grid.children)
    card.hidden = !visible.has(card.dataset.market);
  if (
    focused?.closest('.market-card') &&
    !focused.closest('.market-card').hidden
  )
    focused.focus({ preventScroll: true });
  document.querySelector('#empty-markets').hidden = view.total !== 0;
  results.textContent = view.total
    ? view.from +
      ' à ' +
      view.to +
      ' sur ' +
      view.total +
      (view.total > 1 ? ' marchés · Page ' : ' marché · Page ') +
      view.page +
      ' sur ' +
      view.totalPages
    : '0 marché trouvé';
  pagination.hidden = view.totalPages < 2;
  previousPage.disabled = view.page === 1;
  nextPage.disabled = view.page === view.totalPages;
  const buttons = [];
  for (let page = 1; page <= view.totalPages; page++) {
    const button = element('button', 'page-button page-number', String(page));
    button.type = 'button';
    button.setAttribute('aria-label', 'Page ' + page);
    button.setAttribute('aria-controls', 'market-grid');
    if (page === view.page) button.setAttribute('aria-current', 'page');
    button.addEventListener('click', () => changePage(page));
    buttons.push(button);
  }
  pageNumbers.replaceChildren(...buttons);
}

previousPage?.addEventListener('click', () => changePage(currentPage - 1));
nextPage?.addEventListener('click', () => changePage(currentPage + 1));
for (const button of filterButtons) {
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    currentPage = 1;
    for (const item of filterButtons)
      item.setAttribute('aria-pressed', String(item === button));
    filterMarkets();
  });
}
document.querySelector('#market-search')?.addEventListener('input', () => {
  currentPage = 1;
  filterMarkets();
});
for (const id of ['market-sort', 'market-status'])
  document.getElementById(id)?.addEventListener('change', () => {
    currentPage = 1;
    filterMarkets();
  });

function updatePulse() {
  if (!grid || !document.querySelector('#pulse-total')) return;
  const counts = new Map(
    [...summaries].map(([id, state]) => [id, state.summary]),
  );
  const total = [...counts.values()].reduce(
    (sum, summary) => sum + (summary?.total || 0),
    0,
  );
  document.querySelector('#pulse-total').textContent =
    total.toLocaleString('fr-FR');
  const eligible = catalogue.filter(
    (market) => counts.get(market.id)?.total >= 5,
  );
  for (const [id, sort] of [
    ['pulse-disputed', 'disputed'],
    ['pulse-consensus', 'consensus'],
  ]) {
    const node = document.getElementById(id);
    const market = rankMarkets(eligible, counts, sort)[0];
    node.textContent = market
      ? market.title
      : 'La commission attend cinq bulletins.';
    if (market) node.href = '/m/' + market.id;
    else node.removeAttribute('href');
  }
}

function updateDaily(id, day) {
  const featured = document.querySelector('.daily-market');
  if (!featured || !id) return;
  const market = MARKETS.find((item) => item.id === id);
  const ballot = featured.querySelector('[data-market]');
  const oldId = ballot.dataset.market;
  ballots.set(
    oldId,
    ballots.get(oldId).filter((item) => item !== ballot),
  );
  ballot.dataset.market = id;
  ballots.get(id).push(ballot);
  const title = featured.querySelector('#market-title a');
  title.textContent = market.title;
  title.href = '/m/' + id;
  featured.querySelector('.text-link').href = '/m/' + id;
  featured.querySelector('.daily-detail').textContent = market.detail;
  featured.querySelector('.oracle strong').textContent = market.oracle;
  featured.querySelector('.oracle p').textContent =
    market.volume + ' PNY fictifs';
  const time = featured.querySelector('time');
  time.dateTime = day;
  time.textContent =
    new Date(day).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }) + ' · UTC';
  featured.dataset.day = day;
}

document.querySelector('#crisis-button')?.addEventListener('click', () => {
  const market = getRandomMarket(catalogue);
  if (market) window.location.assign('/m/' + market.id);
});

// A local easter egg; nothing is persisted or sent when it is activated.
let minitelKeys = '';
const minitelExit = element(
  'button',
  'minitel-exit',
  '3615 PWNY · Retour au XXIe siècle',
);
minitelExit.type = 'button';
minitelExit.hidden = true;
document.body.append(minitelExit);
function exitMinitel() {
  document.body.classList.remove('minitel-mode');
  minitelExit.hidden = true;
  minitelKeys = '';
}
minitelExit.addEventListener('click', exitMinitel);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    exitMinitel();
    return;
  }
  if (
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.repeat ||
    event.target.closest('input, textarea, select, [contenteditable]')
  )
    return;
  minitelKeys = (minitelKeys + event.key).slice(-4);
  if (minitelKeys === '3615') {
    document.body.classList.add('minitel-mode');
    minitelExit.hidden = false;
    minitelExit.focus();
    minitelKeys = '';
  }
});
document.addEventListener('visibilitychange', () => {
  if (
    !document.hidden &&
    loadedDay &&
    loadedDay !== new Date().toISOString().slice(0, 10)
  )
    void load();
});
function scheduleNextDay() {
  const now = new Date();
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  window.setTimeout(
    () => {
      if (!document.hidden) void load();
      scheduleNextDay();
    },
    next - now.getTime() + 1000,
  );
}
scheduleNextDay();
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
if (grid) filterMarkets();
void load();
