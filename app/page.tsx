'use client';

import {
  CircleDollarSign,
  Clock3,
  Code2,
  Flame,
  Search,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';

const miniMarkets = [
  {
    title: 'Le mot « maintenance » apparaîtra-t-il avant « incident cyber » ?',
    yes: 73,
    volume: '42 069 PNY',
    oracle: 'Ctrl+F dans le communiqué',
  },
  {
    title: 'La prochaine annonce tombera-t-elle un vendredi à 17 h 59 ?',
    yes: 34,
    volume: '8 008 PNY',
    oracle: 'Horloge parlante fatiguée',
  },
  {
    title: 'Quelqu’un proposera-t-il de « changer tous les mots de passe » ?',
    yes: 91,
    volume: '404 404 PNY',
    oracle: 'Capture Twitter d’un stagiaire',
  },
];

const ACTIVE_MARKET_ID = 'impots-next-official-notice';

type VoteChoice = 'yes' | 'no';
type VoteSummary = {
  choice: VoteChoice | null;
  hasVoted: boolean;
  no: number;
  noPercent: number;
  total: number;
  yes: number;
  yesPercent: number;
};

function isVoteSummary(value: unknown): value is VoteSummary {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<VoteSummary>;
  return (
    typeof candidate.hasVoted === 'boolean' &&
    typeof candidate.total === 'number' &&
    typeof candidate.yesPercent === 'number' &&
    typeof candidate.noPercent === 'number' &&
    (candidate.choice === null ||
      candidate.choice === 'yes' ||
      candidate.choice === 'no')
  );
}

export default function Home() {
  const [vote, setVote] = useState<VoteChoice | null>(null);
  const [summary, setSummary] = useState<VoteSummary | null>(null);
  const [voteStatus, setVoteStatus] = useState<
    'idle' | 'loading' | 'submitting' | 'success' | 'duplicate' | 'error'
  >('loading');

  const castVote = useCallback(async (choice: VoteChoice) => {
    setVoteStatus('submitting');
    try {
      const response = await fetch('/api/votes', {
        body: JSON.stringify({ choice, marketId: ACTIVE_MARKET_ID }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const body: unknown = await response.json();
      if (![201, 409].includes(response.status) || !isVoteSummary(body)) {
        throw new Error('vote-rejected');
      }
      setSummary(body);
      setVote(body.choice);
      setVoteStatus(response.status === 201 ? 'success' : 'duplicate');
      return {
        accepted: response.status === 201,
        choice: body.choice,
        total: body.total,
      };
    } catch {
      setVoteStatus('error');
      return {
        accepted: false,
        error: 'Le service de vote est temporairement indisponible.',
      };
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/votes?market=${ACTIVE_MARKET_ID}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok || !isVoteSummary(body))
          throw new Error('vote-summary-unavailable');
        return body;
      })
      .then((body) => {
        setSummary(body);
        setVote(body.choice);
        setVoteStatus('idle');
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError'))
          setVoteStatus('error');
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!document.modelContext?.registerTool) return;
    const controller = new AbortController();
    document.modelContext.registerTool(
      {
        annotations: {
          destructiveHint: false,
          idempotentHint: false,
          readOnlyHint: false,
        },
        description:
          'Vote OUI ou NON sur le marché satirique PwnyMarket actif. Aucun argent réel.',
        execute: ({ choice }: { choice: VoteChoice }) => castVote(choice),
        inputSchema: {
          additionalProperties: false,
          properties: { choice: { enum: ['yes', 'no'], type: 'string' } },
          required: ['choice'],
          type: 'object',
        },
        name: 'cast_pwnymarket_vote',
      },
      { signal: controller.signal },
    );
    return () => controller.abort();
  }, [castVote]);

  const yesPercent = summary?.yesPercent ?? 50;
  const noPercent = summary?.noPercent ?? 50;
  const hasVoted = summary?.hasVoted ?? false;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/92 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-4 px-4 sm:px-6">
          <a
            className="flex items-center gap-2.5"
            href="#top"
            aria-label="PwnyMarket — accueil"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-[17px] font-black text-primary-foreground shadow-[inset_0_-2px_0_rgb(0_0_0/12%)]">
              P
            </span>
            <span className="text-[19px] font-extrabold tracking-[-0.04em]">
              PwnyMarket
            </span>
          </a>

          <nav
            className="ml-5 hidden items-center gap-1 md:flex"
            aria-label="Navigation principale"
          >
            <a className="nav-link nav-link-active" href="#markets">
              Marchés
            </a>
            <a className="nav-link" href="#activity">
              Activité
            </a>
            <a className="nav-link" href="#method">
              Méthode douteuse
            </a>
          </nav>

          <div
            className="ml-auto hidden min-w-0 max-w-[330px] flex-1 items-center gap-2 rounded-xl border bg-muted/55 px-3 py-2.5 lg:flex"
            aria-hidden="true"
          >
            <Search
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="truncate text-sm text-muted-foreground">
              Chercher un service innocent…
            </span>
          </div>

          <Badge
            className="ml-auto bg-fake text-fake-foreground md:ml-2"
            variant="secondary"
          >
            <CircleDollarSign data-icon="inline-start" /> 0 € réel
          </Badge>
          <a
            className={buttonVariants({
              className: 'hidden sm:inline-flex',
              variant: 'outline',
            })}
            href="https://github.com/bluetouff/pwnymarket"
          >
            <Code2 data-icon="inline-start" /> GitHub
          </a>
        </div>
      </header>

      <div className="border-b border-amber-300/70 bg-amber-50 text-amber-950">
        <div className="mx-auto flex max-w-[1320px] items-start gap-2 px-4 py-2.5 text-xs leading-5 sm:items-center sm:px-6">
          <ShieldAlert
            className="mt-0.5 size-4 shrink-0 sm:mt-0"
            aria-hidden="true"
          />
          <p>
            <strong>PARODIE INTÉGRALE.</strong> Aucune cote n’est réelle, aucun
            jeton n’a de valeur et rien ici n’évalue la sécurité d’un site.
          </p>
        </div>
      </div>

      <div
        id="top"
        className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 sm:py-10"
      >
        <section className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.13em] text-primary">
              <Flame className="size-4 fill-current" aria-hidden="true" />{' '}
              Tendance totalement inventée
            </div>
            <h1 className="max-w-3xl text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
              Le marché qui ne sait rien,
              <span className="text-muted-foreground">
                {' '}
                mais l’affiche très précisément.
              </span>
            </h1>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            Des pronostics absurdes sur les mésaventures numériques de
            l’administration. Pour rire, jamais pour nuire.
          </p>
        </section>

        <section className="featured-grid" aria-labelledby="featured-title">
          <article className="min-w-0 border-b p-5 sm:p-7 lg:border-b-0 lg:border-r">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-blue-50 text-blue-700" variant="secondary">
                CYBER-LOTO
              </Badge>
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Clock3 className="size-3.5" aria-hidden="true" /> Résolution :
                quand l’oracle se réveille
              </span>
            </div>

            <h2
              id="featured-title"
              className="mt-5 max-w-3xl text-2xl font-bold leading-tight tracking-[-0.035em] sm:text-[30px]"
            >
              Impots.gouv.fr sera-t-il cité dans le prochain communiqué officiel
              parlant d’une fuite de données ?
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Question tirée d’un chapeau administratif. Le pourcentage reflète
              uniquement les votes et ne décrit aucun risque réel.
            </p>

            <div className="mt-8 rounded-xl border bg-grid px-4 pb-3 pt-5">
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    COTE OUI
                  </div>
                  <div className="mt-0.5 text-3xl font-black tracking-[-0.05em] text-yes">
                    {voteStatus === 'loading' ? '…' : `${yesPercent} %`}
                  </div>
                </div>
                <div className="text-right text-xs leading-5 text-muted-foreground">
                  Volume fictif
                  <br />
                  <strong className="text-foreground">12 345 PNY</strong>
                </div>
              </div>
              <svg className="h-36 w-full" viewBox="0 0 640 150">
                <title>Courbe décorative de cote fictive</title>
                <defs>
                  <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop
                      offset="0"
                      stopColor="var(--yes)"
                      stopOpacity="0.22"
                    />
                    <stop offset="1" stopColor="var(--yes)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M4 116 C45 109 68 118 100 101 S155 76 190 87 S238 108 274 84 S326 48 360 62 S421 97 454 71 S510 36 548 55 S594 45 636 28 L636 146 L4 146 Z"
                  fill="url(#chart-fill)"
                />
                <path
                  d="M4 116 C45 109 68 118 100 101 S155 76 190 87 S238 108 274 84 S326 48 360 62 S421 97 454 71 S510 36 548 55 S594 45 636 28"
                  fill="none"
                  stroke="var(--yes)"
                  strokeLinecap="round"
                  strokeWidth="4"
                />
                <circle
                  cx="636"
                  cy="28"
                  r="6"
                  fill="var(--yes)"
                  stroke="white"
                  strokeWidth="3"
                />
              </svg>
            </div>
          </article>

          <aside className="p-5 sm:p-7" aria-label="Bulletin de vote fictif">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Votre non-pari</h3>
              <Badge variant="outline">0,00 €</Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Choisissez un bouton. Il ne se passera presque rien.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                className={`quote-button quote-yes ${vote === 'yes' ? 'quote-selected' : ''}`}
                disabled={
                  hasVoted ||
                  voteStatus === 'loading' ||
                  voteStatus === 'submitting'
                }
                onClick={() => setVote('yes')}
                type="button"
              >
                <span>OUI</span>
                <strong>{yesPercent} ¢</strong>
              </button>
              <button
                className={`quote-button quote-no ${vote === 'no' ? 'quote-selected' : ''}`}
                disabled={
                  hasVoted ||
                  voteStatus === 'loading' ||
                  voteStatus === 'submitting'
                }
                onClick={() => setVote('no')}
                type="button"
              >
                <span>NON</span>
                <strong>{noPercent} ¢</strong>
              </button>
            </div>

            <div className="mt-5 rounded-xl bg-muted/70 p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {summary
                    ? `${summary.total} vote${summary.total > 1 ? 's' : ''}`
                    : 'Votes indisponibles'}
                </span>
                <span>0 PNY</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${yesPercent}%` }}
                />
              </div>
            </div>

            <Button
              className="mt-4 h-11 w-full text-sm font-bold"
              disabled={
                !vote ||
                hasVoted ||
                voteStatus === 'loading' ||
                voteStatus === 'submitting'
              }
              onClick={() => vote && void castVote(vote)}
            >
              {voteStatus === 'submitting'
                ? 'Urne en carton en cours…'
                : hasVoted
                  ? `Vote ${summary?.choice === 'yes' ? 'OUI' : 'NON'} enregistré`
                  : vote
                    ? `Voter ${vote === 'yes' ? 'OUI' : 'NON'} pour de faux`
                    : 'Choisir OUI ou NON'}
            </Button>

            <p
              className="mt-3 text-center text-xs leading-5 text-muted-foreground"
              aria-live="polite"
            >
              {voteStatus === 'success' &&
                'Vote enregistré. Votre IP n’a pas été conservée.'}
              {voteStatus === 'duplicate' &&
                'Un vote existe déjà pour cette IP sur ce marché.'}
              {voteStatus === 'error' &&
                'Service de vote indisponible. Aucun faux résultat de secours.'}
              {['idle', 'loading', 'submitting'].includes(voteStatus) &&
                '1 vote par IP et par marché. Adresse IP jamais stockée.'}
            </p>

            <div className="mt-5 border-t pt-5">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-700">
                  <Sparkles className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    Oracle certifié n’importe quoi
                  </div>
                  <div className="mt-1 text-sm font-semibold">
                    Capture Twitter d’un stagiaire
                  </div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    Plan B : pile ou face, pièce fournie par le Trésor public.
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section id="markets" className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-extrabold tracking-[-0.03em]">
              Autres marchés très sérieux
            </h2>
            <a
              className="text-sm font-semibold text-primary hover:underline"
              href="#method"
            >
              Voir la méthode
            </a>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {miniMarkets.map((market) => (
              <article className="market-card" key={market.title}>
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="outline">FAKE</Badge>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {market.volume}
                  </span>
                </div>
                <h3 className="mt-4 min-h-16 text-[15px] font-bold leading-6">
                  {market.title}
                </h3>
                <div className="mt-5 flex items-center gap-2">
                  <span className="mini-quote mini-yes">
                    OUI {market.yes} ¢
                  </span>
                  <span className="mini-quote mini-no">
                    NON {100 - market.yes} ¢
                  </span>
                </div>
                <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                  Oracle : {market.oracle}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <article id="activity" className="market-card scroll-mt-24">
            <Badge variant="outline">ACTIVITÉ</Badge>
            <h2 className="mt-4 text-lg font-extrabold">
              {summary?.total ?? '…'} bulletins dans l’urne
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              OUI {yesPercent} % · NON {noPercent} %. Une consultation ludique,
              sans compte, portefeuille, mise ni gain.
            </p>
          </article>
          <article id="method" className="market-card scroll-mt-24">
            <Badge variant="outline">MÉTHODE DOUTEUSE</Badge>
            <h2 className="mt-4 text-lg font-extrabold">
              Oracle : le communiqué, sinon la pièce
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Les marchés ne prétendent ni prévoir un incident ni mesurer une
              vulnérabilité. Ils ne sont résolus que pour la blague, à partir
              d’une annonce publique.
            </p>
          </article>
        </section>
      </div>

      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-2 px-4 py-6 text-xs leading-5 text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            PwnyMarket est une parodie indépendante, sans affiliation avec
            Polymarket ni l’administration française.
          </p>
          <p>MIT · 0 € réel · 0 tracker</p>
        </div>
      </footer>
    </main>
  );
}
