import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {expect,it} from 'vitest';
it('publishes once, preserves history, rejects stale leases and denies public mutation',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;create table auth.users(id uuid primary key);create table business_profiles(id uuid primary key);create table ad_accounts(id uuid primary key);create function can_access_ad_account(uuid) returns boolean language sql as $$select false$$;create table account_sync_jobs(id uuid primary key,business_id uuid,ad_account_id uuid,lease_generation integer,status text,lease_expires_at timestamptz);`);
 await db.exec(readFileSync('supabase/migrations/20261108204650_ad_lifecycle_intelligence.sql','utf8'));
 const b='00000000-0000-4000-8000-000000000001',a='00000000-0000-4000-8000-000000000002',j='00000000-0000-4000-8000-000000000003';
 await db.exec(`insert into business_profiles values('${b}');insert into ad_accounts values('${a}');insert into account_sync_jobs values('${j}','${b}','${a}',1,'running',now()+interval '5 minutes')`);
 const first=await db.query(`select publish_ad_lifecycle($1,1,null,'[]','[]') id`,[j]);
 expect((await db.query(`select publish_ad_lifecycle($1,1,null,'[]','[]') id`,[j])).rows).toEqual(first.rows);
 await expect(db.query(`select publish_ad_lifecycle($1,2,null,'[]','[]')`,[j])).rejects.toThrow('Invalid lifecycle lease');
 await db.exec('set role service_role');await expect(db.query('update ad_lifecycle_observations set entities=\'[]\'')).rejects.toThrow('permission denied');await db.exec('reset role;set role authenticated');
 expect((await db.query('select * from ad_lifecycle_observations')).rows).toEqual([]);
 await expect(db.query(`select publish_ad_lifecycle($1,1,null,'[]','[]')`,[j])).rejects.toThrow('permission denied');
 }finally{await db.close();}
},15000);
