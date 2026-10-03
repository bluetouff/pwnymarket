import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
if (
  args.length &&
  (args.length !== 2 || args[0] !== '--port' || !/^[0-9]{1,5}$/.test(args[1]))
)
  throw new Error('Usage: node runtime/preview.mjs [--port 4173]');
const port = args.length ? Number(args[1]) : 4173;
if (port < 1 || port > 65535) throw new Error('Invalid preview port');
const directory = mkdtempSync(join(tmpdir(), 'pwny-'));
const socketPath = join(directory, 'app.sock');
if (Buffer.byteLength(socketPath) > 103)
  throw new Error('Preview temporary path is too long; use a shorter TMPDIR');
const authority = `127.0.0.1:${port}`;
const origin = `http://${authority}`;
const child = spawn(
  process.execPath,
  [fileURLToPath(new URL('./server.mjs', import.meta.url))],
  {
    env: {
      ...process.env,
      PWNYMARKET_SOCKET: socketPath,
      PWNYMARKET_LEDGER: join(directory, 'votes.ndjson'),
      PWNYMARKET_PUBLIC_ORIGIN: origin,
      VOTE_HASH_SECRET: randomBytes(32).toString('hex'),
      VOTE_HASH_NAMESPACE: 'pwnymarket-preview-v1',
    },
    stdio: 'ignore',
  },
);
let stopping = false;
const proxy = createServer((incoming, outgoing) => {
  if (incoming.headers.host !== authority) {
    outgoing.writeHead(403);
    outgoing.end();
    return;
  }
  const forwarded = request(
    {
      socketPath,
      path: incoming.url,
      method: incoming.method,
      headers: {
        ...incoming.headers,
        'x-forwarded-proto': 'https',
        'x-forwarded-for': '127.0.0.1',
      },
    },
    (response) => {
      outgoing.writeHead(response.statusCode, {
        ...response.headers,
        'cache-control': 'no-store',
      });
      response.pipe(outgoing);
    },
  );
  forwarded.on('error', () => {
    if (!outgoing.headersSent) outgoing.writeHead(503);
    outgoing.end('Local preview unavailable');
  });
  incoming.pipe(forwarded);
});
function stop() {
  if (stopping) return;
  stopping = true;
  proxy.close();
  child.kill('SIGTERM');
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
child.on('exit', () => {
  if (!stopping) {
    process.stderr.write('Local preview stopped\n');
    proxy.close();
    process.exitCode = 1;
  }
});
proxy.on('error', () => {
  process.stderr.write('Local preview could not listen\n');
  stop();
  process.exitCode = 1;
});
for (
  let attempt = 0;
  attempt < 100 && !existsSync(socketPath) && child.exitCode === null;
  attempt++
)
  await delay(20);
if (!existsSync(socketPath)) {
  stop();
  throw new Error('Local runtime unavailable');
}
proxy.listen(port, '127.0.0.1', () =>
  process.stdout.write(
    'PwnyMarket local preview: ' + origin + '/ (isolated votes)\n',
  ),
);
