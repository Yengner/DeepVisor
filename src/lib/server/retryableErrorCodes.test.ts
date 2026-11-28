import { readdirSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const FIX = '20261127050347_stop_retryable_lease_errors.sql';

// PostgREST 14 retries 40001 forever, so no function may raise it. Earlier files are history.
it('adds no function raising 40001 after the fix', () => {
  const later = readdirSync('supabase/migrations').filter((name) => name.endsWith('.sql') && name > FIX);
  const offending = later.filter((name) => /errcode\s*=\s*'40001'|sqlstate\s+'40001'|serialization_failure/i
    .test(readFileSync(`supabase/migrations/${name}`, 'utf8')));
  expect(offending).toEqual([]);
});
