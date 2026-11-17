#!/usr/bin/env node
// CI guard for supabase/migrations: every file must be `<14-digit version>_<snake_name>.sql`
// with a unique version. Applied migrations are named by the version the database assigned, so a
// wrong or duplicated version means local history no longer matches the remote project.
// Usage: node scripts/ci/check-migrations.mjs [dir]   (exit 1 with GitHub annotations on problems)
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'supabase/migrations';
const NAME = /^(\d{14})_[a-z0-9_]+\.sql$/;
const problems = [];
const seen = new Map();

for (const file of readdirSync(dir).filter(f => !f.startsWith('.')).sort()) {
  const match = NAME.exec(file);
  if (!match) {
    problems.push({ file, message: 'Name must be <14-digit version>_<snake_case_name>.sql, using the version the database assigned when it was applied.' });
    continue;
  }
  const other = seen.get(match[1]);
  if (other) problems.push({ file, message: `Version ${match[1]} is also used by ${other}. Each migration needs its own version.` });
  else seen.set(match[1], file);
}

for (const { file, message } of problems) {
  console.log(`::error file=${join(dir, file)},title=Migration name::${message}`);
}
console.log(problems.length ? `${problems.length} migration problem(s).` : `${seen.size} migrations OK.`);
process.exit(problems.length ? 1 : 0);
