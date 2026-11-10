import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {expect,it} from 'vitest';
const b='00000000-0000-4000-8000-000000000001',a='00000000-0000-4000-8000-000000000002',u='00000000-0000-4000-8000-000000000003',token='00000000-0000-4000-8000-000000000004',other='00000000-0000-4000-8000-000000000005';
it('isolates users, claims atomically, acknowledges exact content and preserves immutable history',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;create table auth.users(id uuid primary key);create table business_profiles(id uuid primary key,organization_id uuid);create table organization_memberships(organization_id uuid,user_id uuid);create table ad_accounts(id uuid primary key,business_id uuid);create function can_access_ad_account(uuid) returns boolean language sql as $$select false$$;`);
 await db.exec(readFileSync('supabase/migrations/20261109161829_insights_events.sql','utf8'));
 await db.exec(`create table ad_lifecycle_events(id uuid primary key,ad_account_id uuid,root_id text,affected_ids text[],created_at timestamptz);create table ad_lifecycle_acknowledgements(event_id uuid,user_id uuid);`);
 await db.exec(readFileSync('supabase/migrations/20261109164530_insights_delivery_hardening.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261109170109_insights_unknown_evidence.sql','utf8'));
 await db.exec(`insert into auth.users values('${u}'),('${other}');insert into business_profiles values('${b}','${b}');insert into organization_memberships values('${b}','${u}');insert into ad_accounts values('${a}','${b}');`);
 const present=async(t=token,key='event:1',urgent=false,until:string|null='2026-11-08',expected:string|null=null)=>{const r=await db.query<{id:string|null}>(`select present_insights($1,$2,$3,$4,'2026-11-09',$5,'{}',$6,$7,$8,$9) id`,[b,a,u,t,expected,[key],key,until,urgent]);return r.rows[0].id;};
 const id=await present();expect(id).toBeTruthy();expect(await present(other)).toBeNull();expect(await present()).toBe(id);
 expect((await db.query<{ok:boolean}>('select acknowledge_insights($1,$2,$3,$4) ok',[a,u,id,other])).rows[0].ok).toBe(false);
 expect((await db.query<{ok:boolean}>('select acknowledge_insights($1,$2,$3,$4) ok',[a,u,id,token])).rows[0].ok).toBe(true);
 expect(await present(token,'event:2',false,'2026-11-08','2026-11-08')).toBeNull();
 const urgent=await present(token,'issue:1',true,null,'2026-11-08');expect(urgent).toBeTruthy();
 await db.exec(`update insight_reviews set claim_until=now()-interval '1 minute'`);
 const newer=await present(other,'issue:2',true,null,'2026-11-08');expect(newer).toBeTruthy();expect(newer).not.toBe(urgent);
 await expect(db.query(`select present_insights($1,$2,$3,$4,'2026-11-09',null,'{}','{}','x',null,true)`,[b,a,other,token])).rejects.toThrow('Forbidden');
 await db.exec('set role service_role');await expect(db.query("update insight_presentations set payload='{}'")).rejects.toThrow('permission denied');await db.exec('reset role;set role authenticated');expect((await db.query('select * from insight_presentations')).rows).toEqual([]);await expect(db.query(`select acknowledge_insights($1,$2,$3,$4)`,[a,u,id,token])).rejects.toThrow('permission denied');await db.exec('reset role');
 await db.exec(`insert into ad_lifecycle_events select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${a}','ad',array['ad'],now()+n*interval '1 second' from generate_series(100,125) n`);
 const batch=await db.query<{sources:{events:Array<{id:string}>}}>('select pending_insight_sources($1,$2) sources',[a,u]);expect(batch.rows[0].sources.events).toHaveLength(20);
 await db.exec(`insert into insight_seen_sources select '${u}','${a}','lifecycle:'||id::text from ad_lifecycle_events where id>'00000000-0000-4000-8000-000000000105'`);
 const rest=await db.query<{sources:{events:Array<{id:string}>}}>('select pending_insight_sources($1,$2) sources',[a,u]);expect(rest.rows[0].sources.events).toHaveLength(6);
 const evidence=JSON.stringify([{key:'rejected:ad',code:'DISAPPROVED'}]);
 await db.query('select observe_insight_issues($1,$2,\'hierarchy\',\'2026-11-09T10:00Z\',$3)',[b,a,evidence]);
 await db.query('select observe_insight_issues($1,$2,\'hierarchy\',\'2026-11-09T09:00Z\',\'[]\')',[b,a]);
 expect((await db.query('select * from insight_issues where resolved_at is null')).rows).toHaveLength(1);
 await db.query('select observe_insight_issues($1,$2,\'hierarchy\',\'2026-11-09T10:30Z\',$3)',[b,a,JSON.stringify([{key:'rejected:ad',_unobserved:true}])]);
 const retained=await db.query<{revision:number;observed_at:Date|string}>('select revision,observed_at from insight_issues where resolved_at is null');expect(retained.rows[0].revision).toBe(1);expect(new Date(retained.rows[0].observed_at).toISOString()).toBe('2026-11-09T10:00:00.000Z');
 await db.query('select observe_insight_issues($1,$2,\'hierarchy\',\'2026-11-09T11:00Z\',\'[]\')',[b,a]);
 expect((await db.query('select * from insight_issues where resolved_at is null')).rows).toHaveLength(0);
 await db.query('select observe_insight_issues($1,$2,\'hierarchy\',\'2026-11-09T12:00Z\',$3)',[b,a,evidence]);expect((await db.query('select * from insight_issues')).rows).toHaveLength(2);
 }finally{await db.close();}
},20000);
