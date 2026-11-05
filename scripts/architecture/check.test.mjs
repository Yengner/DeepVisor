import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectArchitecture } from './check.mjs';

function inspect(files) {
  const root = mkdtempSync(join(tmpdir(), 'deepvisor-architecture-'));
  try {
    for (const [name, source] of Object.entries(files)) {
      const path = join(root, 'src', name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, source);
    }
    return inspectArchitecture(root);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('resolves relative/alias imports, re-exports and dynamic imports', () => {
  const found = inspect({
    'lib/shared/a.ts': "export { value } from '../server/b'; import('@/lib/server/b');",
    'lib/server/b.ts': 'export const value = 1;',
  });
  assert.deepEqual(found, ['shared-boundary: src/lib/shared/a.ts -> src/lib/server/b.ts']);
});

test('type-only imports are erased; server action imports remain permitted', () => {
  assert.deepEqual(inspect({
    'components/view.tsx': "'use client'; import type { Value } from '@/lib/server/model'; import { type Other } from '@/lib/server/model'; import { save } from '@/lib/server/action';",
    'lib/server/model.ts': 'export type Value = string; export type Other = number;',
    'lib/server/action.ts': "'use server'; export async function save() {}",
  }), []);
});

test('rejects runtime client/server and server/presentation imports', () => {
  const found = inspect({
    'components/view.tsx': "'use client'; import { value } from '@/lib/server/model';",
    'lib/server/model.ts': "import '@/components/view'; export const value = 1;",
  });
  assert.equal(found.length, 3);
  assert.ok(found.some(item => item.startsWith('runtime-cycle:')));
  assert.ok(found.some(item => item.startsWith('client-boundary:')));
  assert.ok(found.some(item => item.startsWith('server-boundary:')));
});

test('feature type dependencies cannot pull in repositories', () => {
  assert.deepEqual(inspect({
    'lib/server/features/types.ts': "type Value = import('../repositories/model').Value;",
    'lib/server/repositories/model.ts': 'export type Value = string;',
  }), ['feature-boundary: src/lib/server/features/types.ts -> src/lib/server/repositories/model.ts']);
});

test('finds cycles through barrels and requires; excludes tests and archive', () => {
  assert.deepEqual(inspect({
    'lib/client/index.ts': "export * from './child';",
    'lib/client/child.ts': "const parent = require('./index');",
    'lib/client/ignored.test.ts': "import '@/lib/server/model';",
    '_archive/old.ts': "import '@/lib/server/model';",
    'lib/server/model.ts': 'export const value = 1;',
  }), ['runtime-cycle: src/lib/client/child.ts <-> src/lib/client/index.ts']);
});

test('new shared performance rules cannot import external packages', () => {
  assert.deepEqual(inspect({ 'lib/shared/performance/example.ts': "import 'node:fs';" }),
    ['performance-external: src/lib/shared/performance/example.ts -> node:fs']);
});
