import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll,afterAll,expect,it } from 'vitest';
let db:PGlite;
beforeAll(async()=>{
 db=new PGlite();await db.exec(`
 create role anon;create role authenticated;create role service_role;
 create schema cron;create schema net;
 create table cron.job_run_details(runid bigint primary key,status text,end_time timestamptz);
 create table net._http_response(id bigint primary key,created timestamptz);
 create table cron.job(id bigint generated always as identity primary key,name text unique,schedule text,command text);
 create function cron.schedule(n text,s text,c text) returns bigint language sql as $$
 insert into cron.job(name,schedule,command) values(n,s,c) on conflict(name) do update set schedule=excluded.schedule,command=excluded.command returning id $$;
 insert into cron.job_run_details select n,'succeeded',now()-interval '8 days' from generate_series(1,5001)n;
 insert into cron.job_run_details values(6000,'succeeded',now()),(6001,'running',null),(6002,'running',now()-interval '8 days');
 insert into net._http_response values(1,now()-interval '2 days'),(2,now());
 `);
 await db.exec(readFileSync('supabase/migrations/20261028001536_operational_log_retention.sql','utf8'));
},20000);
afterAll(()=>db?.close());
it('bounds pruning, preserves recent and running diagnostics, and keeps the six-hour worker TTL independent',async()=>{
 expect((await db.query('select public.maintenance_prune_operational_logs() r')).rows[0]).toEqual({r:{cron_removed:5000,http_removed:1}});
 expect((await db.query('select runid from cron.job_run_details order by runid')).rows).toEqual([{runid:5001},{runid:6000},{runid:6001},{runid:6002}]);
 expect((await db.query('select id from net._http_response')).rows).toEqual([{id:2}]);
 expect((await db.query('select public.maintenance_prune_operational_logs() r')).rows[0]).toEqual({r:{cron_removed:1,http_removed:0}});
});
it('separates hourly retention from top-level daily vacuum and schedules idempotently',async()=>{
 const jobs=(await db.query('select schedule,command from cron.job order by id')).rows;
 expect(jobs).toEqual([{schedule:'17 * * * *',command:'select public.maintenance_prune_operational_logs();'},{schedule:'47 3 * * *',command:'vacuum (analyze) cron.job_run_details, net._http_response;'}]);
});
it.each(['anon','authenticated','service_role'])('denies pruning through the %s Data API role',async role=>{
 await db.exec('begin');try{await db.exec(`set local role ${role}`);await expect(db.query('select public.maintenance_prune_operational_logs()')).rejects.toMatchObject({code:'42501'});}finally{await db.exec('rollback;reset role');}
});
