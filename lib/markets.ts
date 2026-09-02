export const MARKETS = {
  'impots-next-official-notice': {
    id: 'impots-next-official-notice',
    title:
      'Impots.gouv.fr sera-t-il cité dans le prochain communiqué officiel parlant d’une fuite de données ?',
  },
  'maintenance-before-incident': {
    id: 'maintenance-before-incident',
    title: 'Le mot « maintenance » apparaîtra-t-il avant « incident cyber » ?',
  },
  'friday-1759': {
    id: 'friday-1759',
    title: 'La prochaine annonce tombera-t-elle un vendredi à 17 h 59 ?',
  },
  'password-reset-reaction': {
    id: 'password-reset-reaction',
    title: 'Quelqu’un proposera-t-il de « changer tous les mots de passe » ?',
  },
} as const;

export type MarketId = keyof typeof MARKETS;
export type VoteChoice = 'yes' | 'no';

export function isMarketId(value: unknown): value is MarketId {
  return typeof value === 'string' && Object.hasOwn(MARKETS, value);
}

export function isVoteChoice(value: unknown): value is VoteChoice {
  return value === 'yes' || value === 'no';
}
