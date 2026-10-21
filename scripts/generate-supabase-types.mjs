import { spawnSync } from 'node:child_process';
import { writeFileSync, renameSync } from 'node:fs';
const result = spawnSync('npx', ['supabase', 'gen', 'types', 'typescript', '--linked', '--schema', 'public,ai,intelligence'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
if (result.error || result.status !== 0) {
  process.stderr.write(result.error?.message ?? result.stderr ?? 'Supabase type generation failed');
  process.exit(1);
}
for (const schema of ['public', 'ai', 'intelligence']) {
  if (!result.stdout.includes(`  ${schema}: {`)) throw new Error(`Missing ${schema} schema; existing bindings preserved`);
}
const target = new URL('../src/lib/shared/types/supabase.ts', import.meta.url);
const temporary = new URL('../src/lib/shared/types/supabase.ts.tmp', import.meta.url);
writeFileSync(temporary, result.stdout);
renameSync(temporary, target);
