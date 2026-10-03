import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export function build(root = projectRoot, outputRoot = join(root, 'dist')) {
  const files = new Map();
  function collect(relative) {
    const path = join(root, relative);
    const stat = lstatSync(path);
    assert.equal(stat.isSymbolicLink(), false, `Symlink refused: ${relative}`);
    if (stat.isDirectory()) {
      assert.ok(['runtime', 'runtime/public'].includes(relative));
      for (const name of readdirSync(path).sort())
        collect(`${relative}/${name}`);
      return;
    }
    assert.ok(stat.isFile(), `Regular file required: ${relative}`);
    assert.match(
      relative,
      /^(?:runtime\/[a-z0-9-]+\.mjs|runtime\/market-events\.json|runtime\/public\/[a-zA-Z0-9][a-zA-Z0-9.-]*\.(?:html|js|css|svg|png|ttf|txt))$/,
      `Unexpected runtime file: ${relative}`,
    );
    if (/\.m?js$/.test(relative))
      execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
    files.set(relative, readFileSync(path));
  }
  collect('runtime');
  for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) {
    assert.ok(lstatSync(join(root, name)).isFile(), name);
    files.set(name, readFileSync(join(root, name)));
  }
  const metadata = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  files.set(
    'package.json',
    Buffer.from(
      JSON.stringify(
        {
          name: metadata.name,
          version: metadata.version,
          private: true,
          type: 'module',
          engines: metadata.engines,
          scripts: {
            start: 'node runtime/server.mjs',
            dev: 'node runtime/preview.mjs',
          },
        },
        null,
        2,
      ) + '\n',
    ),
  );

  // Every build gets its own directory; no prior output is overwritten or removed.
  try {
    mkdirSync(outputRoot);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const outputStat = lstatSync(outputRoot);
  assert.ok(outputStat.isDirectory(), 'Output must be a real directory');
  assert.equal(outputStat.isSymbolicLink(), false, 'Output symlink refused');
  const destination = mkdtempSync(join(outputRoot, 'pwnymarket-'));
  const sums = [];
  for (const [relative, bytes] of files) {
    const path = join(destination, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes, { flag: 'wx' });
    sums.push(
      createHash('sha256').update(bytes).digest('hex') + '  ' + relative,
    );
  }
  writeFileSync(join(destination, 'SHA256SUMS'), sums.join('\n') + '\n', {
    flag: 'wx',
  });
  return destination;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  console.log(build());
