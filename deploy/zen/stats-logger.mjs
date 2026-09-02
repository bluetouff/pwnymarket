import {
  appendLog,
  LOG_DIRECTORY,
  normalizeLogLine,
  pruneLogs,
} from './stats-data.mjs';

// Apache starts piped logs as root. Drop all privileges before processing any request data.
if (process.getuid() !== 0) throw new Error('Logger must be started by Apache');
process.setgroups([]);
process.setgid('pwnystats');
process.setuid('pwnystats');
process.umask(0o077);

let pending = '';
let discard = false;
let lastDay = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  for (const part of chunk.split(/(?<=\n)/)) {
    const ended = part.endsWith('\n');
    if (discard || pending.length + part.length > 256) {
      pending = '';
      discard = !ended;
      continue;
    }
    pending += part;
    if (!ended) continue;
    const entry = normalizeLogLine(pending.trimEnd());
    pending = '';
    if (!entry) continue;
    try {
      if (entry.day !== lastDay) {
        pruneLogs(LOG_DIRECTORY);
        lastDay = entry.day;
      }
      appendLog(LOG_DIRECTORY, entry);
    } catch {
      // Never print a request, header or path supplied by a client.
      process.stderr.write('PwnyMarket statistics storage unavailable\n');
      process.exit(1);
    }
  }
});
