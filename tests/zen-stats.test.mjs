import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
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

test('generator runs through a current release symlink and imports without publishing', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'pwny-stats-entry-')));
  const release = join(dir, 'release');
  const current = join(dir, 'current');
  const report = join(dir, 'report');
  mkdirSync(release);
  mkdirSync(report);
  symlinkSync(release, current, 'dir');
  copyFileSync(
    new URL('../deploy/zen/generate-stats.mjs', import.meta.url),
    join(release, 'generate-stats.mjs'),
  );
  // Use the unmodified CLI with isolated empty input, never production log/report paths.
  writeFileSync(
    join(release, 'stats-data.mjs'),
    `export const LOG_DIRECTORY = ${JSON.stringify(dir)};
export const REPORT_DIRECTORY = ${JSON.stringify(report)};
export function collectLogs() { return { input: '', capped: false }; }
`,
  );
  const html = join(report, 'index.html');
  const run = (args) =>
    spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 5000 });
  const imported = run([
    '--input-type=module',
    '-e',
    `await import(${JSON.stringify(pathToFileURL(join(current, 'generate-stats.mjs')).href)})`,
  ]);
  assert.equal(imported.status, 0, imported.stderr);
  assert.equal(existsSync(html), false, 'import must not publish');
  for (const path of [release, current]) {
    const result = run([join(path, 'generate-stats.mjs')]);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(html), 'successful CLI must publish: ' + path);
    assert.match(
      readFileSync(html, 'utf8'),
      /Pas encore de requêtes à compter/,
    );
    assert.equal(statSync(html).mode & 0o777, 0o640);
    assert.equal(existsSync(join(report, 'index.html.next')), false);
    unlinkSync(html);
  }
});

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
  assert.equal(
    installer.split('\n').filter((line) => line === 'check_report').length,
    2,
  );
  assert.match(installer, /runuser -u www-data -- test -r/);
  assert.match(installer, /pwnystats:www-data:640/);
  assert.ok(
    installer.lastIndexOf('check_report') <
      installer.indexOf('echo "PRIVATE_GOACCESS_OK'),
  );
  const unit = readFileSync(
    new URL('../deploy/zen/pwnymarket-stats.service', import.meta.url),
    'utf8',
  );
  assert.match(unit, /PrivateNetwork=true/);
  assert.match(unit, /MemoryMax=256M/);
});
