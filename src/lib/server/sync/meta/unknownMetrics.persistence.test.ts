import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
it('migrates existing zero observations without rewriting them and permits explicit unknowns',async()=>{
 const db=new PGlite();
 try {
  for(const table of ['ad_entity_performance_daily','ad_entity_performance_summary','ad_entity_performance_hourly','ad_audience_breakdowns_summary'])
   await db.exec(`create table public.${table}(reach numeric not null default 0,ctr numeric not null default 0,cpc numeric not null default 0,cpm numeric not null default 0,leads numeric not null default 0,messages numeric not null default 0,calls numeric not null default 0); insert into public.${table} default values;`);
  await db.exec(readFileSync('supabase/migrations/20261029185835_allow_unknown_meta_metrics.sql','utf8'));
  await db.exec('insert into public.ad_audience_breakdowns_summary(reach,leads,messages,calls) values(null,null,null,null)');
  expect((await db.query('select reach from public.ad_audience_breakdowns_summary')).rows).toEqual([{reach:'0'},{reach:null}]);
 }finally{await db.close();}
},15000);
