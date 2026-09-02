import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const directory = mkdtempSync('/private/tmp/pwny-preview-');
const socketPath = join(directory, 'app.sock');
const origin = 'http://127.0.0.1:4173';
const child = spawn(process.execPath, ['runtime/server.mjs'], {
  env: {
    ...process.env,
    PWNYMARKET_SOCKET: socketPath,
    PWNYMARKET_LEDGER: join(directory, 'votes.ndjson'),
    PWNYMARKET_PUBLIC_ORIGIN: origin,
    VOTE_HASH_SECRET: randomBytes(32).toString('hex'),
    VOTE_HASH_NAMESPACE: 'pwnymarket-preview-v1',
  },
  stdio: 'ignore',
});
let stopping = false;
const proxy = createServer((incoming, outgoing) => {
  if (incoming.headers.host !== '127.0.0.1:4173') {
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
proxy.listen(4173, '127.0.0.1', () =>
  process.stdout.write(
    'PwnyMarket local preview: ' + origin + '/ (isolated votes)\n',
  ),
);
