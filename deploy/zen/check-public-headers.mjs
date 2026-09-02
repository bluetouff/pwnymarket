import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { SECURITY_HEADERS } from '../../zen/security.mjs';

export function assertPublicSecurityHeaders(headers) {
  for (const [name, expected] of Object.entries(SECURITY_HEADERS)) {
    assert.equal(
      headers.get(name),
      expected,
      `${name} must have exactly one expected value`,
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
  try {
    for (const [path, expectedStatus] of [
      ['/', 200],
      ['/healthz', 200],
      ['/__pwnymarket_header_check__', 404],
    ]) {
      const response = await fetch(`https://pwnymarket.fr${path}`, {
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });
      await response.arrayBuffer();
      assert.equal(
        response.status,
        expectedStatus,
        `Unexpected status for ${path}`,
      );
      assertPublicSecurityHeaders(response.headers);
    }
    console.log('PUBLIC_HEADERS_OK (home, health and error response)');
  } catch (error) {
    console.error(`PUBLIC_HEADERS_FAILED: ${error.message}`);
    process.exitCode = 1;
  }
}
