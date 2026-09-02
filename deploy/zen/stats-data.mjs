import {
  constants,
  closeSync,
  existsSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { join } from 'node:path';

export const LOG_DIRECTORY = '/var/lib/pwnymarket-stats/logs';
export const REPORT_DIRECTORY = '/var/lib/pwnymarket-stats/report';
export const MAX_DAILY_BYTES = 2 * 1024 * 1024;
export const RETENTION_DAYS = 14;
export const ROUTES = new Set([
  '/',
  '/about',
  '/privacy',
  '/api/votes',
  '/api/markets',
  '/assets',
  '/other',
]);
const DAY = 86400000;
const FILE_NAME = /^\d{4}-\d{2}-\d{2}\.(?:log|capped)$/;

export function normalizeLogLine(line, now = Date.now()) {
  const match = /^(\d{10}) ([1-5]\d{2}) (\d{1,12}|-) (\/[^\s]*)$/.exec(line);
  if (!match || !ROUTES.has(match[4])) return null;
  const timestamp = Number(match[1]) * 1000;
  if (timestamp > now + 60000 || timestamp < now - DAY) return null;
  const stamp = new Date(timestamp).toISOString();
  return {
    day: stamp.slice(0, 10),
    line:
      '[' +
      stamp.slice(0, 10) +
      ' ' +
      stamp.slice(11, 19) +
      '] ' +
      match[2] +
      ' ' +
      (match[3] === '-' ? '0' : match[3]) +
      ' ' +
      match[4] +
      '\n',
  };
}

export function pruneLogs(directory, now = Date.now()) {
  const cutoff = new Date(now - (RETENTION_DAYS - 1) * DAY)
    .toISOString()
    .slice(0, 10);
  for (const name of readdirSync(directory)) {
    if (!FILE_NAME.test(name) || name.slice(0, 10) >= cutoff) continue;
    const path = join(directory, name);
    if (lstatSync(path).isFile()) unlinkSync(path);
  }
}

export function appendLog(directory, entry) {
  const path = join(directory, entry.day + '.log');
  const descriptor = openSync(
    path,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_APPEND |
      constants.O_NOFOLLOW,
    0o600,
  );
  try {
    const size = existsSync(path) ? lstatSync(path).size : 0;
    if (size + Buffer.byteLength(entry.line) > MAX_DAILY_BYTES) {
      const marker = openSync(
        join(directory, entry.day + '.capped'),
        constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW,
        0o600,
      );
      closeSync(marker);
      return false;
    }
    const data = Buffer.from(entry.line);
    let offset = 0;
    while (offset < data.length) {
      const written = writeSync(descriptor, data, offset, data.length - offset);
      if (written < 1) throw new Error('Statistics storage unavailable');
      offset += written;
    }
    return true;
  } finally {
    closeSync(descriptor);
  }
}

export function collectLogs(directory, now = Date.now()) {
  pruneLogs(directory, now);
  const names = readdirSync(directory)
    .filter((name) => FILE_NAME.test(name))
    .sort();
  let input = '';
  let capped = false;
  for (const name of names) {
    const path = join(directory, name);
    const stat = lstatSync(path);
    if (!stat.isFile()) throw new Error('Invalid statistics file');
    if (name.endsWith('.capped')) {
      capped = true;
      continue;
    }
    if (stat.size > MAX_DAILY_BYTES + 1024)
      throw new Error('Statistics file too large');
    const data = readFileSync(path, 'utf8');
    for (const line of data.split('\n')) {
      if (!line) continue;
      const match =
        /^\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\] ([1-5]\d{2}) (\d{1,12}) (\/[^\s]*)$/.exec(
          line,
        );
      if (!match || !ROUTES.has(match[5]) || match[1] !== name.slice(0, 10))
        throw new Error('Invalid statistics record');
      // GoAccess requires a host. This constant exists only in memory, never identifies a visitor.
      input += '127.0.0.1 ' + line + '\n';
    }
  }
  return { input, capped };
}
