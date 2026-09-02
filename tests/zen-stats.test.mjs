import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  appendLog,
  collectLogs,
  MAX_DAILY_BYTES,
  normalizeLogLine,
  pruneLogs,
} from '../deploy/zen/stats-data.mjs';
import { renderReport } from '../deploy/zen/generate-stats.mjs';

const now = Date.parse('2026-09-02T12:00:00Z');
const seconds = now / 1000;

test('statistics accepts only bounded route buckets, never client identifiers', () => {
  const entry = normalizeLogLine(seconds + ' 200 123 /about', now);
  assert.deepEqual(entry, {
    day: '2026-09-02',
    line: '[2026-09-02 12:00:00] 200 123 /about\n',
  });
  for (const value of [
    seconds + ' 200 123 /?secret=hello',
    seconds + ' 200 123 /unknown/user@example.org',
    seconds + ' 200 123 /about\n203.0.113.2',
    '203.0.113.2 200 123 /',
    seconds + ' 200 -1 /',
    seconds + ' 200 123 /stats/',
    seconds + ' 999 123 /',
    seconds - 86401 + ' 200 123 /',
    seconds + 120 + ' 200 123 /',
  ])
    assert.equal(normalizeLogLine(value, now), null, value);
});

test('statistics appends without IP, caps storage and rejects symlinks', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pwny-stats-'));
  const entry = normalizeLogLine(seconds + ' 200 123 /', now);
  assert.equal(appendLog(dir, entry), true);
  const path = join(dir, entry.day + '.log');
  assert.equal(readFileSync(path, 'utf8').includes('127.0.0.1'), false);
  assert.equal(collectLogs(dir, now).input, '127.0.0.1 ' + entry.line);
  writeFileSync(path, 'x'.repeat(MAX_DAILY_BYTES));
  assert.equal(appendLog(dir, entry), false);
  assert.equal(readFileSync(path).length, MAX_DAILY_BYTES);
  assert.equal(existsSync(join(dir, entry.day + '.capped')), true);
  const otherDir = mkdtempSync(join(tmpdir(), 'pwny-stats-link-'));
  symlinkSync(path, join(otherDir, entry.day + '.log'));
  assert.throws(() => appendLog(otherDir, entry));
  assert.throws(() => collectLogs(otherDir, now));
});

test('retention deletes only identified stats files older than 14 UTC days', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pwny-stats-ttl-'));
  for (const name of [
    '2026-08-19.log',
    '2026-08-19.capped',
    '2026-08-20.log',
    'keep.txt',
  ])
    writeFileSync(join(dir, name), '');
  pruneLogs(dir, now);
  assert.equal(existsSync(join(dir, '2026-08-19.log')), false);
  assert.equal(existsSync(join(dir, '2026-08-19.capped')), false);
  assert.equal(existsSync(join(dir, '2026-08-20.log')), true);
  assert.equal(existsSync(join(dir, 'keep.txt')), true);
});

function fixture() {
  const row = { data: '/', hits: { count: 2 }, bytes: { count: 246 } };
  return {
    general: {
      valid_requests: 2,
      failed_requests: 0,
      bandwidth: 246,
      unique_visitors: 987654321,
    },
    requests: { data: [row] },
    static_requests: { data: [] },
    not_found: { data: [] },
    status_codes: { data: [] },
  };
}
test('private report escapes source text, omits unique metrics and needs no CSP exception', () => {
  const report = fixture();
  report.requests.data[0].data = '<script>alert(1)</script>';
  const html = renderReport(report, true, new Date(now));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.doesNotMatch(html, /<script|style=|987654321|unique_visitors/);
  assert.match(html, /Période incomplète/);
  assert.match(html, /2 requêtes/);
  report.general.failed_requests = 1;
  assert.throws(() => renderReport(report, false));
  const invalid = fixture();
  invalid.general.valid_requests = -1;
  assert.throws(() => renderReport(invalid, false));
});

test('Apache statistics never logs raw client input and protects the only report', () => {
  const apache = readFileSync(
    new URL('../deploy/zen/pwnymarket-stats.apache.conf', import.meta.url),
    'utf8',
  );
  const custom = apache
    .split('\n')
    .find((line) => line.startsWith('CustomLog'));
  assert.doesNotMatch(custom, /%(?:a|h|r|q|U|u|m)(?![A-Za-z])/);
  assert.doesNotMatch(custom, /User-Agent|Referer/);
  assert.match(
    apache,
    /AuthUserFile \/etc\/apache2\/pwnymarket-stats.htpasswd/,
  );
  assert.match(apache, /Require valid-user/);
  assert.match(apache, /Require all denied/);
  assert.match(apache, /private, no-store/);
  assert.doesNotMatch(apache, /unsafe-inline|unsafe-eval/);
  const logger = readFileSync(
    new URL('../deploy/zen/stats-logger.mjs', import.meta.url),
    'utf8',
  );
  assert.ok(
    logger.indexOf("process.setuid('pwnystats')") <
      logger.indexOf("process.stdin.on('data'"),
  );
  const installer = readFileSync(
    new URL('../deploy/zen/install-stats.sh', import.meta.url),
    'utf8',
  );
  assert.ok(
    installer.indexOf('htpasswd -cB') <
      installer.indexOf('install -m 0644 -o root -g root'),
  );
  const unit = readFileSync(
    new URL('../deploy/zen/pwnymarket-stats.service', import.meta.url),
    'utf8',
  );
  assert.match(unit, /PrivateNetwork=true/);
  assert.match(unit, /MemoryMax=256M/);
});
