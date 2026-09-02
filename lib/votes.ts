import { env } from 'cloudflare:workers';

import type { MarketId, VoteChoice } from '@/lib/markets';
import {
  createVoterKey as createPrivateVoterKey,
  getTrustedClientIp as readTrustedClientIp,
} from '@/lib/vote-security';

export type VoteSummary = {
  choice: VoteChoice | null;
  hasVoted: boolean;
  no: number;
  noPercent: number;
  total: number;
  yes: number;
  yesPercent: number;
};

function getDatabase(): D1Database {
  if (!env.DB) {
    throw new Error('Vote database is unavailable');
  }

  return env.DB;
}

function getVoteSecret(): string {
  const secret = env.VOTE_HASH_SECRET;

  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('Vote hashing is not configured');
  }

  return secret;
}

export function getTrustedClientIp(request: Request): string | null {
  return readTrustedClientIp(request, process.env.NODE_ENV === 'development');
}

export async function createVoterKey(
  ip: string,
  marketId: MarketId,
): Promise<string> {
  return createPrivateVoterKey(getVoteSecret(), ip, marketId);
}

export async function getVoteSummary(
  marketId: MarketId,
  voterKey: string,
): Promise<VoteSummary> {
  const database = getDatabase();
  const [countResult, ownVoteResult] = await database.batch([
    database
      .prepare(
        `SELECT choice, COUNT(*) AS count
         FROM votes
         WHERE market_id = ?
         GROUP BY choice`,
      )
      .bind(marketId),
    database
      .prepare(
        `SELECT choice
         FROM votes
         WHERE market_id = ? AND voter_key = ?
         LIMIT 1`,
      )
      .bind(marketId, voterKey),
  ]);

  let yes = 0;
  let no = 0;
  for (const row of countResult.results as Array<{
    choice: VoteChoice;
    count: number;
  }>) {
    if (row.choice === 'yes') yes = Number(row.count) || 0;
    if (row.choice === 'no') no = Number(row.count) || 0;
  }

  const total = yes + no;
  const choice =
    (ownVoteResult.results[0] as { choice?: VoteChoice } | undefined)?.choice ??
    null;
  const yesPercent = total === 0 ? 50 : Math.round((yes / total) * 100);

  return {
    choice,
    hasVoted: choice !== null,
    no,
    noPercent: 100 - yesPercent,
    total,
    yes,
    yesPercent,
  };
}

export async function recordVote(
  marketId: MarketId,
  voterKey: string,
  choice: VoteChoice,
): Promise<'created' | 'duplicate'> {
  try {
    await getDatabase()
      .prepare(
        `INSERT INTO votes (id, market_id, voter_key, choice, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), marketId, voterKey, choice, Date.now())
      .run();
    return 'created';
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('UNIQUE constraint failed')) {
      return 'duplicate';
    }
    throw error;
  }
}
