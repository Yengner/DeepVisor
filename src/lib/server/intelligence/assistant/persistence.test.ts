import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
it('enforces durable budgets, private rows, turn locking, revision checks and account foreign keys', async () => {
    const db = new PGlite();
    try {
        await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;create table auth.users(id uuid primary key);
   create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(bucket_id text);alter table storage.objects enable row level security;
   create table public.business_profiles(id uuid primary key);
   create table public.ad_accounts(id uuid primary key,business_id uuid,unique(business_id,id));`);
        await db.exec(readFileSync('supabase/migrations/20261105050106_assistant_conversations.sql', 'utf8'));
        const business = randomUUID(), account = randomUUID(), user = randomUUID(), other = randomUUID();
        await db.query('insert into business_profiles values($1),($2)', [business, other]);
        await db.query('insert into ad_accounts values($1,$2)', [account, business]);
        await db.query('insert into auth.users values($1)', [user]);
        const claim = (rev = 0, tokens = 100, lock = randomUUID(), businessId = business) => db.query<{
            claim_assistant_turn: {
                id: string;
            };
        }>('select public.claim_assistant_turn($1,$2,$3,$4,$5,$6,2,200,3,300,2)', [businessId, account, user, rev, lock, tokens]);
        await db.exec('set role service_role');
        const first = await claim();
        const id = first.rows[0].claim_assistant_turn.id;
        await expect(claim()).rejects.toThrow('ASSISTANT_BUSY');
        await db.query('update assistant_conversations set locked_until=null,revision=1 where id=$1', [id]);
        await expect(claim()).rejects.toThrow('ASSISTANT_REVISION');
        await claim(1);
        await db.query('update assistant_conversations set locked_until=null where id=$1', [id]);
        await expect(claim(1)).rejects.toThrow('ASSISTANT_CONVERSATION_LIMIT');
        // Clearing a conversation does not bypass the business's rolling rate limit.
        await db.query('update assistant_conversations set generation=$1 where id=$2', [randomUUID(), id]);
        await expect(claim(1)).rejects.toThrow('ASSISTANT_RATE_LIMIT');
        await expect(claim(0, 0, randomUUID(), other)).rejects.toThrow('foreign key');
        await db.exec('set role authenticated');
        await expect(db.exec('select * from assistant_conversations')).rejects.toThrow('permission');
        await expect(claim()).rejects.toThrow('permission');
        await db.exec('set role anon');
        await expect(db.exec('select * from assistant_usage')).rejects.toThrow('permission');
        await db.exec('reset role');
        expect((await db.query('select * from assistant_usage')).rows).toHaveLength(2);
    }
    finally {
        await db.close();
    }
}, 15000);
