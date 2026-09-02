import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ACTIVE_MARKET_ID, createVoterKey } from '../runtime/security.mjs';

const secret = 'test-only-namespace-key-0123456789abcdef';

test('vote namespace is explicit, bounded and separates identities', () => {
  const key = createVoterKey(secret, '192.0.2.1', ACTIVE_MARKET_ID, 'test-v1');
  assert.equal(
    key,
    createVoterKey(secret, '192.0.2.1', ACTIVE_MARKET_ID, 'test-v1'),
  );
  assert.notEqual(
    key,
    createVoterKey(secret, '192.0.2.1', ACTIVE_MARKET_ID, 'test-v2'),
  );
  for (const invalid of [
    undefined,
    null,
    '',
    'a'.repeat(65),
    'bad\0prefix',
    'bad\nprefix',
    'bad\n',
    'bad\r',
    'bad prefix',
    '../path',
    '_prefix',
  ]) {
    assert.throws(
      () => createVoterKey(secret, '192.0.2.1', ACTIVE_MARKET_ID, invalid),
      /namespace/,
    );
  }
  assert.doesNotThrow(() =>
    createVoterKey(secret, '192.0.2.1', ACTIVE_MARKET_ID, 'a'.repeat(64)),
  );
});

test('missing identity configuration fails before opening a ledger', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pwny-namespace-'));
  const ledger = join(directory, 'votes.ndjson');
  const result = spawnSync(process.execPath, ['runtime/server.mjs'], {
    env: {
      ...process.env,
      VOTE_HASH_SECRET: secret,
      VOTE_HASH_NAMESPACE: '',
      PWNYMARKET_SOCKET: join(directory, 'app.sock'),
      PWNYMARKET_LEDGER: ledger,
    },
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Vote namespace is not configured/);
  assert.equal(existsSync(ledger), false);
});
