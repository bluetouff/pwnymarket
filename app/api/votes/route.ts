import { NextResponse } from 'next/server';

import {
  isMarketId,
  isVoteChoice,
  type MarketId,
  type VoteChoice,
} from '@/lib/markets';
import {
  createVoterKey,
  getTrustedClientIp,
  getVoteSummary,
  recordVote,
} from '@/lib/votes';

const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

function json(body: object, status = 200): NextResponse {
  return NextResponse.json(body, { headers: RESPONSE_HEADERS, status });
}

function isSameOriginRequest(request: Request): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && !['none', 'same-origin', 'same-site'].includes(fetchSite))
    return false;

  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

async function readSmallJsonBody(request: Request): Promise<unknown> {
  if (
    !request.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('application/json')
  ) {
    throw new TypeError('invalid-content-type');
  }

  if (!request.body) throw new TypeError('empty-body');

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > 512) {
    throw new RangeError('body-too-large');
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 512) {
      await reader.cancel();
      throw new RangeError('body-too-large');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(new TextDecoder().decode(bytes));
}

function parseVoteBody(
  value: unknown,
): { choice: VoteChoice; marketId: MarketId } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== 2 || keys[0] !== 'choice' || keys[1] !== 'marketId')
    return null;
  if (!isMarketId(record.marketId) || !isVoteChoice(record.choice)) return null;
  return { choice: record.choice, marketId: record.marketId };
}

async function identifyVoter(
  request: Request,
  marketId: MarketId,
): Promise<string | null> {
  const ip = getTrustedClientIp(request);
  if (!ip) return null;
  return createVoterKey(ip, marketId);
}

export async function GET(request: Request): Promise<NextResponse> {
  const marketId = new URL(request.url).searchParams.get('market');
  if (!isMarketId(marketId)) return json({ error: 'unknown_market' }, 400);

  try {
    const voterKey = await identifyVoter(request, marketId);
    if (!voterKey) return json({ error: 'vote_identity_unavailable' }, 503);
    return json(await getVoteSummary(marketId, voterKey));
  } catch {
    return json({ error: 'vote_service_unavailable' }, 503);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOriginRequest(request))
    return json({ error: 'cross_origin_request' }, 403);

  let parsed: { choice: VoteChoice; marketId: MarketId } | null = null;
  try {
    parsed = parseVoteBody(await readSmallJsonBody(request));
  } catch (error) {
    if (error instanceof RangeError)
      return json({ error: 'request_too_large' }, 413);
    return json({ error: 'invalid_request' }, 400);
  }
  if (!parsed) return json({ error: 'invalid_vote' }, 400);

  try {
    const voterKey = await identifyVoter(request, parsed.marketId);
    if (!voterKey) return json({ error: 'vote_identity_unavailable' }, 503);

    const result = await recordVote(parsed.marketId, voterKey, parsed.choice);
    const summary = await getVoteSummary(parsed.marketId, voterKey);
    return json(
      { ...summary, accepted: result === 'created' },
      result === 'created' ? 201 : 409,
    );
  } catch {
    return json({ error: 'vote_service_unavailable' }, 503);
  }
}
