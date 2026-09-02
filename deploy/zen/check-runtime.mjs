import { pathToFileURL } from 'node:url';

// Reviewed 2026-09-02 against the official Node.js LTS/security releases.
// https://nodejs.org/en/blog/vulnerability/july-2026-security-releases
// https://nodejs.org/en/blog/release/v24.20.0
export function isSupportedProductionRuntime(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return false;
  const [, major, minor, patch] = match.map(Number);
  return (
    (major === 22 && (minor > 23 || (minor === 23 && patch >= 2))) ||
    (major === 24 && (minor > 18 || (minor === 18 && patch >= 1)))
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (!isSupportedProductionRuntime(process.versions.node)) {
    console.error(
      'Production requires patched LTS Node 22.23.2+ or 24.18.1+; no runtime is upgraded automatically.',
    );
    process.exitCode = 1;
  }
}
