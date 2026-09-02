(() => {
  'use strict';

  const marketId = 'impots-next-official-notice';
  const elements = {
    bar: document.querySelector('#yes-bar'),
    chartYes: document.querySelector('#chart-yes'),
    no: document.querySelector('#choice-no'),
    quoteNo: document.querySelector('#quote-no'),
    quoteYes: document.querySelector('#quote-yes'),
    status: document.querySelector('#vote-status'),
    submit: document.querySelector('#submit-vote'),
    total: document.querySelector('#vote-total'),
    yes: document.querySelector('#choice-yes'),
  };
  let selected = null;
  let summary = null;

  function validSummary(value) {
    return (
      value &&
      typeof value === 'object' &&
      typeof value.total === 'number' &&
      typeof value.yesPercent === 'number' &&
      typeof value.noPercent === 'number' &&
      typeof value.hasVoted === 'boolean' &&
      [null, 'yes', 'no'].includes(value.choice)
    );
  }

  function render(message) {
    const yesPercent = summary?.yesPercent ?? 50;
    const noPercent = summary?.noPercent ?? 50;
    elements.chartYes.textContent = `${yesPercent} %`;
    elements.quoteYes.textContent = `${yesPercent} ¢`;
    elements.quoteNo.textContent = `${noPercent} ¢`;
    elements.bar.value = yesPercent;
    elements.bar.textContent = `${yesPercent} %`;
    elements.total.textContent = summary
      ? `${summary.total} vote${summary.total > 1 ? 's' : ''}`
      : 'Votes indisponibles';
    elements.yes.classList.toggle('selected', selected === 'yes');
    elements.no.classList.toggle('selected', selected === 'no');
    const locked = Boolean(summary?.hasVoted);
    elements.yes.disabled = locked;
    elements.no.disabled = locked;
    elements.submit.disabled = locked || !selected;
    elements.submit.textContent = locked
      ? `Vote ${summary.choice === 'yes' ? 'OUI' : 'NON'} enregistré`
      : selected
        ? `Voter ${selected === 'yes' ? 'OUI' : 'NON'} pour de faux`
        : 'Choisir OUI ou NON';
    elements.status.textContent =
      message || '1 vote par IP et par marché. Adresse IP jamais stockée.';
  }

  function select(choice) {
    if (summary?.hasVoted) return;
    selected = choice;
    render();
  }

  async function load() {
    try {
      const response = await fetch(
        `/api/votes?market=${encodeURIComponent(marketId)}`,
        { cache: 'no-store' },
      );
      const body = await response.json();
      if (!response.ok || !validSummary(body)) throw new Error('unavailable');
      summary = body;
      selected = body.choice;
      render();
    } catch {
      elements.yes.disabled = true;
      elements.no.disabled = true;
      elements.submit.disabled = true;
      render('Service de vote indisponible. Aucun faux résultat de secours.');
    }
  }

  async function castVote(choice) {
    elements.submit.disabled = true;
    elements.submit.textContent = 'Urne en carton en cours…';
    try {
      const response = await fetch('/api/votes', {
        body: JSON.stringify({ choice, marketId }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const body = await response.json();
      if (![201, 409].includes(response.status) || !validSummary(body))
        throw new Error('rejected');
      summary = body;
      selected = body.choice;
      render(
        response.status === 201
          ? 'Vote enregistré. Votre IP n’a pas été conservée.'
          : 'Un vote existe déjà pour cette IP sur ce marché.',
      );
      return {
        accepted: response.status === 201,
        choice: body.choice,
        total: body.total,
      };
    } catch {
      render('Service de vote indisponible. Aucun faux résultat de secours.');
      return { accepted: false, error: 'vote_service_unavailable' };
    }
  }

  elements.yes.addEventListener('click', () => select('yes'));
  elements.no.addEventListener('click', () => select('no'));
  elements.submit.addEventListener(
    'click',
    () => selected && castVote(selected),
  );

  if (document.modelContext?.registerTool) {
    document.modelContext.registerTool({
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        readOnlyHint: false,
      },
      description:
        'Vote OUI ou NON sur le marché satirique PwnyMarket actif. Aucun argent réel.',
      execute: ({ choice }) => castVote(choice),
      inputSchema: {
        additionalProperties: false,
        properties: { choice: { enum: ['yes', 'no'], type: 'string' } },
        required: ['choice'],
        type: 'object',
      },
      name: 'cast_pwnymarket_vote',
    });
  }

  void load();
})();
