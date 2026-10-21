// MCP's type tool returns public only. Add ai/intelligence from a live MCP
// information_schema/pg_proc export; fail on unsupported types rather than guess.
import { readFile, writeFile } from 'node:fs/promises';
const [publicFile, catalogFile, output] = process.argv.slice(2);
if (!output) throw new Error('Usage: reconcile-types.mjs public-types.ts catalog.json output.ts');
const catalog = JSON.parse(await readFile(catalogFile, 'utf8'));
const numeric = ['int2','int4','int8','float4','float8','numeric','integer','bigint','double precision'];
function type(sql) {
 if (sql.startsWith('_')) return `${type(sql.slice(1))}[]`;
 if (sql.endsWith('[]')) return `${type(sql.slice(0,-2))}[]`;
 if (numeric.includes(sql)) return 'number';
 if (['text','uuid','timestamptz','timestamp with time zone','timestamp','date','varchar'].includes(sql)) return 'string';
 if (['json','jsonb'].includes(sql)) return 'Json';
 if (['bool','boolean'].includes(sql)) return 'boolean';
 if (sql === 'void') return 'undefined';
 throw new Error(`Unsupported database type ${sql}`);
}
let additions = '';
for (const schema of ['ai','intelligence']) {
 additions += `  ${schema}: {\n    Tables: {\n`;
 for (const table of [...new Set(catalog.columns.filter(c=>c.table_schema===schema).map(c=>c.table_name))].sort()) {
  const columns = catalog.columns.filter(c=>c.table_schema===schema&&c.table_name===table);
  additions += `      ${table}: {\n`;
  for (const mode of ['Row','Insert','Update']) {
   additions += `        ${mode}: {\n`;
   for (const c of columns) {
    const nullable = c.is_nullable === 'YES';
    const optional = mode === 'Update' || mode === 'Insert' && (nullable || c.column_default !== null);
    additions += `          ${c.column_name}${optional?'?':''}: ${type(c.udt_name)}${nullable?' | null':''}\n`;
   }
   additions += '        }\n';
  }
  additions += '        Relationships: [\n';
  for (const fk of catalog.foreign_keys.filter(f=>f.schema===schema&&f.table===table)) {
   const unique = catalog.unique_keys.filter(u=>u.schema===schema&&u.table===table);
   const one = unique.some(u=>u.columns.every(c=>fk.columns.includes(c)));
   additions += `          { foreignKeyName: ${JSON.stringify(fk.name)}; columns: ${JSON.stringify(fk.columns)}; isOneToOne: ${one}; referencedRelation: ${JSON.stringify(fk.target)}; referencedColumns: ${JSON.stringify(fk.target_columns)} },\n`;
  }
  additions += '        ]\n      }\n';
 }
 additions += '    }\n    Views: { [_ in never]: never }\n    Functions: {\n';
 for (const f of catalog.functions.filter(f=>f.schema===schema).sort((a,b)=>a.name.localeCompare(b.name))) {
  const args = f.args ? f.args.split(', ').map(a=>{
   const [signature,def] = a.split(' DEFAULT ');
   const [name,...rest] = signature.split(' ');
   return `${name}${def!==undefined?'?':''}: ${type(rest.join(' '))} | null`;
  }).join('; ') : '';
  additions += `      ${f.name}: { Args: ${args?`{ ${args} }`:'{ [_ in never]: never }'}; Returns: ${type(f.returns)} }\n`;
 }
 additions += '    }\n    Enums: { [_ in never]: never }\n    CompositeTypes: { [_ in never]: never }\n  }\n';
}
let content = await readFile(publicFile,'utf8');
content = content.replace('  public: {',additions+'  public: {').replace('export const Constants = {','export const Constants = {\n  ai: { Enums: {} },\n  intelligence: { Enums: {} },');
await writeFile(output, '// Public: Supabase MCP generated. ai/intelligence: live catalog; see scripts/beta-fixtures/reconcile-types.mjs.\n'+content.trimEnd()+'\n');
