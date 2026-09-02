import assert from 'node:assert/strict';
import test from 'node:test';

import { createVoterKey, getTrustedClientIp } from '../lib/vote-security.ts';

const secret = '0123456789abcdef0123456789abcdef';
const market = 'impots-next-official-notice';

void test('only trusts the Cloudflare client IP header', () => {
  const request = new Request('https://example.test', {
    headers: { 'x-forwarded-for': '203.0.113.9' },
  });
  assert.equal(getTrustedClientIp(request), null);
});

void test('rejects malformed client IP values', () => {
  const request = new Request('https://example.test', {
    headers: { 'cf-connecting-ip': '127.0.0.1<script>' },
  });
  assert.equal(getTrustedClientIp(request), null);
});

void test('creates deterministic, market-separated pseudonyms without exposing the IP', async () => {
  const ip = '2001:db8::1';
  const first = await createVoterKey(secret, ip, market);
  const second = await createVoterKey(secret, ip, market);
  const otherMarket = await createVoterKey(secret, ip, 'friday-1759');

  assert.equal(first, second);
  assert.notEqual(first, otherMarket);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first.includes(ip), false);
});

void test('refuses short HMAC secrets', async () => {
  await assert.rejects(createVoterKey('too-short', '192.0.2.1', market));
});
