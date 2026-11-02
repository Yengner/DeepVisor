import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
it('preserves immutable history, rejects duplicate versions and enforces business RLS',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon; create role authenticated; create role service_role;
 create table public.business_profiles(id uuid primary key);
 create table public.ad_accounts(id uuid primary key,business_id uuid,unique(business_id,id));
 create function public.can_access_business(id uuid) returns boolean language sql as $$ select id::text=current_setting('test.business',true) $$;`);
 await db.exec(readFileSync('supabase/migrations/20261031034606_account_organizer.sql','utf8'));
 const a='11111111-1111-4111-8111-111111111111',account='22222222-2222-4222-8222-222222222222',base='33333333-3333-4333-8333-333333333333';
 await db.query('insert into business_profiles values($1)',[a]);await db.query('insert into ad_accounts values($1,$2)',[account,a]);
 await db.query("insert into account_organization_baselines(id,business_id,ad_account_id,created_by,consent_version,snapshot) values($1,$2,$3,$2,'organizer-v1','{}')",[base,a,account]);
 const insert="insert into account_organization_versions(baseline_id,business_id,ad_account_id,created_by,version,proposal,source_snapshot) values($1,$2,$3,$2,$4,'{}','{}')";
 await db.query(insert,[base,a,account,1]);await expect(db.query(insert,[base,a,account,1])).rejects.toThrow();
 await db.query(insert,[base,a,account,2]);
 await expect(db.exec("update account_organization_baselines set snapshot='{}'")).rejects.toThrow('immutable');
 await expect(db.exec("update account_organization_versions set proposal='{}'")).rejects.toThrow('immutable');
 await db.exec(`set role authenticated; set test.business='${a}'`);
 expect((await db.query('select * from account_organization_versions')).rows).toHaveLength(2);
 await db.exec(`set test.business='${account}'`);expect((await db.query('select * from account_organization_versions')).rows).toHaveLength(0);
 await expect(db.query(insert,[base,a,account,3])).rejects.toThrow();
 }finally{await db.close();}
},15000);
