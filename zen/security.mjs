import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

export const ACTIVE_MARKET_ID = 'impots-next-official-notice';
export const VOTE_CHOICES = new Set(['yes', 'no']);

export const SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy': [
    "default-src 'none'",
    "base-uri 'none'",
    "connect-src 'self'",
    "font-src 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "img-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
  ].join('; '),
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy':
    'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
});

export function normalizeProxyIp(value) {
  if (Array.isArray(value) || typeof value !== 'string') return null;
  const candidate = value.trim().toLowerCase();
  if (!candidate || candidate.includes(',') || candidate.length > 45)
    return null;
  if (candidate.startsWith('::ffff:') && isIP(candidate.slice(7)) === 4)
    return candidate.slice(7);
  return isIP(candidate) ? candidate : null;
}

export function createVoterKey(secret, ip, marketId) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('Vote hashing is not configured');
  }
  if (!normalizeProxyIp(ip) || marketId !== ACTIVE_MARKET_ID) {
    throw new TypeError('Invalid voter identity');
  }
  return createHmac('sha256', secret)
    .update(`pwnymarket-zen-v1\0${marketId}\0${ip}`)
    .digest('hex');
}

export function isSameOriginVoteRequest(headers, publicOrigin) {
  if (headers['x-forwarded-proto'] !== 'https') return false;
  if (headers.origin !== publicOrigin) return false;
  const fetchSite = headers['sec-fetch-site'];
  return !fetchSite || fetchSite === 'same-origin' || fetchSite === 'same-site';
}
