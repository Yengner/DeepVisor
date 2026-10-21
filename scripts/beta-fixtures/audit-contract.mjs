// Local-only reconstruction of the five additive AI migrations for comparison
// against MCP catalog exports. Never a baseline or reset script for Supabase.
import { PGlite } from '@electric-sql/pglite';
import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../../', import.meta.url);
const source = await readFile(new URL('src/lib/server/decisions/outcomes/persistence.test.ts', root), 'utf8');
const setup = source.split('await db.exec(`')[1].split('insert into public.business_profiles')[0];
const db = new PGlite();
await db.exec(setup);
const files = ['20261006000000_add_v2_decision_persistence.sql','20261007000000_add_review_execution_claims.sql','20261008000000_add_shadow_evaluation_jobs.sql','20261009000000_add_action_outcome_measurements.sql','20261010000000_add_limited_auto_execution.sql'];
for (const file of files) await db.exec(await readFile(new URL(`supabase/migrations/${file}`, root), 'utf8'));
const queries = {
 columns: `select table_schema,table_name,jsonb_agg(jsonb_build_object('name',column_name,'type',udt_name,'nullable',is_nullable,'default',column_default) order by ordinal_position) columns from information_schema.columns where table_schema='ai' group by 1,2 order by 1,2`,
 constraints: `select conrelid::regclass::text as table_name,conname,pg_get_constraintdef(oid) definition from pg_constraint where connamespace='ai'::regnamespace and contype<>'n' order by 1,2`,
 functions: `select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) args,p.prosecdef,p.proacl,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='ai' and p.prokind='f'`,
 indexes: `select * from pg_indexes where schemaname='ai'`,
 policies: `select * from pg_policies where schemaname='ai'`,
};
const normalize = value => JSON.stringify(value ?? null).replaceAll('public.', '').replace(/\\n|\s+/g, '').replaceAll('"','');
const report = {};
for (const [key, sql] of Object.entries(queries)) {
 const expected = (await db.query(sql)).rows;
 const actual = JSON.parse(await readFile(`/tmp/dv-audit-${key}.json`, 'utf8'));
 const mismatches = [];
 for (const row of expected) {
  const candidate = actual.find(a => key === 'columns' ? a.table_schema === row.table_schema && a.table_name === row.table_name : key === 'constraints' ? a.table_name === row.table_name && a.conname === row.conname : key === 'functions' ? a.schema === row.schema && a.name === row.name : key === 'indexes' ? a.schemaname === row.schemaname && a.indexname === row.indexname : a.schemaname === row.schemaname && a.tablename === row.tablename && a.policyname === row.policyname);
  if (key === 'policies' && candidate && typeof candidate.roles === 'string') candidate.roles = candidate.roles.slice(1,-1).split(',');
  // proacl owner names differ between local PGlite and hosted postgres; grants
  // are checked separately by RLS tests, not by an owner-dependent string.
  if (key === 'functions') { delete row.proacl; if(candidate) delete candidate.proacl; }
  if (normalize(candidate) !== normalize(row)) mismatches.push({ expected: row, actual: candidate });
 }
 report[key] = { compared: expected.length, mismatches };
}
await writeFile('/tmp/dv-contract-comparison.json', JSON.stringify(report,null,2));
console.log(Object.fromEntries(Object.entries(report).map(([k,v])=>[k,{compared:v.compared,mismatches:v.mismatches.length}])));
await db.close();
