import type { MarketId } from '@/lib/markets';

const encoder = new TextEncoder();

export function getTrustedClientIp(
  request: Request,
  allowDevelopmentFallback = false,
): string | null {
  const cloudflareIp = request.headers.get('cf-connecting-ip');
  const candidate =
    cloudflareIp ?? (allowDevelopmentFallback ? '127.0.0.1' : null);

  if (
    !candidate ||
    candidate.length > 45 ||
    !/^[0-9a-f:.]+$/i.test(candidate)
  ) {
    return null;
  }

  return candidate;
}

export async function createVoterKey(
  secret: string,
  ip: string,
  marketId: MarketId,
): Promise<string> {
  if (secret.length < 32) {
    throw new Error('Vote hashing is not configured');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`pwnymarket-v1\0${marketId}\0${ip}`),
  );

  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
