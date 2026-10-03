import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer, request } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from '../scripts/build.mjs';
import { ACTIVE_MARKET_ID, SECURITY_HEADERS } from '../runtime/security.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const metadata = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

test('native project has no runtime dependencies and only audited quality tools', () => {
  const require = createRequire(import.meta.url);
  for (const name of [
    'undici',
    'braces',
    'fast-uri',
    'miniflare',
    'wrangler',
    '@cloudflare/vite-plugin',
    'vinext',
  ])
    assert.throws(() => require.resolve(name), { code: 'MODULE_NOT_FOUND' });
  for (const field of [
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
    'overrides',
  ])
    assert.deepEqual(metadata[field] || {}, {}, field);
  assert.deepEqual(metadata.devDependencies, {
    oxfmt: '0.61.0',
    oxlint: '1.76.0',
  });
  const lock = JSON.parse(
    readFileSync(join(root, 'package-lock.json'), 'utf8'),
  );
  assert.equal(lock.lockfileVersion, 3);
  assert.deepEqual(lock.packages[''].devDependencies, metadata.devDependencies);
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!path) continue;
    assert.match(
      path,
      /^node_modules\/(?:oxfmt|oxlint|tinypool|@ox(?:fmt|lint)\/binding-[a-z0-9-]+)$/,
    );
    assert.equal(entry.dev, true, path);
  }
});

test('build produces an isolated byte-exact runtime with no npm install required', async (t) => {
  const output = mkdtempSync(join(tmpdir(), 'pwny-build-'));
  const destination = build(root, output);
  const packageJson = JSON.parse(
    readFileSync(join(destination, 'package.json'), 'utf8'),
  );
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(packageJson.devDependencies, undefined);
  assert.equal(existsSync(join(destination, 'node_modules')), false);
  const manifest = readFileSync(join(destination, 'SHA256SUMS'), 'utf8')
    .trim()
    .split('\n');
  for (const line of manifest) {
    const [digest, path] = line.split('  ');
    assert.doesNotMatch(path, /(?:^|\/)\.|node_modules|\.env|ndjson/);
    const bytes = readFileSync(join(destination, path));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), digest);
    if (path !== 'package.json')
      assert.deepEqual(bytes, readFileSync(join(root, path)));
  }
  assert.equal(manifest.filter((line) => line.endsWith('.html')).length, 6);
  assert.ok(manifest.some((line) => line.endsWith('runtime/server.mjs')));
  assert.ok(
    manifest.some((line) => line.endsWith('runtime/market-events.json')),
  );
  assert.notEqual(build(root, output), destination);

  // Run the copied server outside the repository and without inherited app config.
  const state = mkdtempSync(join(tmpdir(), 'pwny-'));
  const socketPath = join(state, 'a.sock');
  const child = spawn(
    process.execPath,
    [join(destination, 'runtime/server.mjs')],
    {
      cwd: state,
      env: {
        PWNYMARKET_SOCKET: socketPath,
        PWNYMARKET_LEDGER: join(state, 'votes.ndjson'),
        PWNYMARKET_PUBLIC_ORIGIN: 'https://example.test',
        VOTE_HASH_SECRET: 'build-test-secret-0123456789abcdef',
        VOTE_HASH_NAMESPACE: 'build-test-v1',
      },
      stdio: 'ignore',
    },
  );
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const closed = once(child, 'close');
      child.kill('SIGTERM');
      await closed;
    }
  });
  for (let i = 0; i < 100 && !existsSync(socketPath); i++)
    await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(existsSync(socketPath), true);
  const response = await new Promise((resolve, reject) => {
    const req = request({ socketPath, path: '/healthz' }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.setTimeout(2000, () => req.destroy(new Error('Timeout')));
    req.on('error', reject);
    req.end();
  });
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), { status: 'ok' });
});

test('build rejects unexpected data and symlinks without overwriting output', () => {
  for (const privateFile of ['runtime/.env', 'runtime/public/.env.txt']) {
    const fixture = mkdtempSync(join(tmpdir(), 'pwny-build-'));
    cpSync(join(root, 'runtime'), join(fixture, 'runtime'), {
      recursive: true,
    });
    const output = join(fixture, 'output');
    writeFileSync(join(fixture, privateFile), 'TEST_SECRET_ONLY=never-copy');
    assert.throws(() => build(fixture, output), /Unexpected runtime file/);
    assert.equal(existsSync(output), false);
  }
  const linked = mkdtempSync(join(tmpdir(), 'pwny-build-'));
  symlinkSync(join(root, 'runtime'), join(linked, 'runtime'), 'dir');
  assert.throws(() => build(linked, join(linked, 'output')), /Symlink refused/);
  const target = mkdtempSync(join(tmpdir(), 'pwny-build-'));
  const link = join(linked, 'linked-output');
  symlinkSync(target, link, 'dir');
  assert.throws(() => build(root, link), /Output/);
  assert.deepEqual(readdirSync(target), []);
});

test('native server refuses incomplete configuration without npm dependencies', () => {
  const result = spawnSync(
    process.execPath,
    [join(root, 'runtime/server.mjs')],
    {
      env: {},
      encoding: 'utf8',
      timeout: 5000,
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Vote hashing is not configured/);
});

test(
  'native preview is portable, loopback-only and isolates votes',
  { timeout: 15000 },
  async (t) => {
    const reservation = createServer();
    reservation.listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const port = reservation.address().port;
    await new Promise((resolve) => reservation.close(resolve));
    const state = mkdtempSync(join(tmpdir(), 'pwny-'));
    const child = spawn(
      process.execPath,
      [join(root, 'runtime/preview.mjs'), '--port', String(port)],
      {
        cwd: state,
        env: { TMPDIR: state },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    t.after(async () => {
      if (child.exitCode === null && child.signalCode === null) {
        const closed = once(child, 'close');
        child.kill('SIGTERM');
        await closed;
      }
    });
    let output = '';
    let errors = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (errors += chunk));
    for (let i = 0; i < 150 && !output.includes('isolated votes'); i++) {
      if (child.exitCode !== null) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.match(output, /isolated votes/, errors);
    const origin = `http://127.0.0.1:${port}`;
    const send = (path, headers = {}, body) =>
      new Promise((resolve, reject) => {
        const req = request(
          {
            hostname: '127.0.0.1',
            port,
            path,
            method: body ? 'POST' : 'GET',
            headers,
          },
          (res) => {
            let text = '';
            res.on('data', (chunk) => (text += chunk));
            res.on('end', () =>
              resolve({ status: res.statusCode, headers: res.headers, text }),
            );
          },
        );
        req.setTimeout(2000, () => req.destroy(new Error('Preview timeout')));
        req.on('error', reject);
        req.end(body);
      });
    const home = await send('/');
    assert.equal(home.status, 200);
    assert.equal(
      home.headers['content-security-policy'],
      SECURITY_HEADERS['Content-Security-Policy'],
    );
    assert.equal(home.headers['set-cookie'], undefined);
    assert.equal((await send('/', { host: 'evil.example' })).status, 403);
    const body = JSON.stringify({ marketId: ACTIVE_MARKET_ID, choice: 'yes' });
    const headers = {
      origin,
      'content-type': 'application/json',
      'x-forwarded-for': '192.0.2.1',
    };
    assert.equal(
      (
        await send(
          '/api/votes',
          { ...headers, origin: 'https://evil.example' },
          body,
        )
      ).status,
      403,
    );
    assert.equal((await send('/api/votes', headers, body)).status, 201);
    assert.equal(
      (
        await send(
          '/api/votes',
          { ...headers, 'x-forwarded-for': '192.0.2.2' },
          body,
        )
      ).status,
      409,
    );
    const directories = readdirSync(state).filter((name) =>
      name.startsWith('pwny-'),
    );
    assert.equal(directories.length, 1);
    const ledger = readFileSync(
      join(state, directories[0], 'votes.ndjson'),
      'utf8',
    );
    assert.equal(ledger.trim().split('\n').length, 1);
    assert.doesNotMatch(ledger, /192\.0\.2\.|127\.0\.0\.1/);
  },
);

test('preview rejects invalid or ambiguous ports before opening a server', () => {
  for (const args of [
    ['--port', '0'],
    ['--port', '65536'],
    ['--port', '-1'],
    ['--port', '1e3'],
    ['--host', '0.0.0.0'],
  ]) {
    const result = spawnSync(
      process.execPath,
      [join(root, 'runtime/preview.mjs'), ...args],
      {
        env: {},
        encoding: 'utf8',
        timeout: 5000,
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage:|Invalid preview port/);
  }
});
