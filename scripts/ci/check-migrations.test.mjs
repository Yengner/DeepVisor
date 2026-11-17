import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const script = new URL('./check-migrations.mjs', import.meta.url).pathname;
const run = files => {
  const dir = mkdtempSync(join(tmpdir(), 'migrations-'));
  for (const f of files) writeFileSync(join(dir, f), '');
  return spawnSync(process.execPath, [script, dir], { encoding: 'utf8' });
};

test('accepts well-named, unique migrations', () => {
  const r = run(['20261117035925_business_ad_facts.sql', '20261117042757_booking_checkins.sql']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /2 migrations OK/);
});

test('rejects bad names and duplicate versions with annotations', () => {
  const r = run(['20261117035925_a.sql', '20261117035925_b.sql', '2026_bad.sql', 'Notes.sql']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /::error file=.*20261117035925_b\.sql.*also used by 20261117035925_a\.sql/);
  assert.match(r.stdout, /::error file=.*2026_bad\.sql/);
  assert.match(r.stdout, /::error file=.*Notes\.sql/);
});
