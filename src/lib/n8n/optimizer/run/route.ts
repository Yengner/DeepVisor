import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';

export const runtime = 'nodejs';

const ALLOWED_MODES = new Set(['shadow', 'review', 'auto', 'canary'] as const);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const {
            userId,
            adAccountId,
            mode = 'review',
            caps = { max_account_budget_change_pct: 25 },
        }: {
            userId?: string;
            adAccountId?: string;
            mode?: 'shadow' | 'review' | 'auto' | 'canary';
            caps?: { max_account_budget_change_pct?: number };
        } = body;

        if (!userId || !adAccountId) {
            return new Response(
                JSON.stringify({ ok: false, error: 'userId and adAccountId are required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }
        if (!ALLOWED_MODES.has(mode)) {
            return new Response(
                JSON.stringify({ ok: false, error: `invalid mode "${mode}"` }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const webhookUrl = process.env.N8N_OPTIMIZER_WEBHOOK_URL;
        if (!webhookUrl) {
            return new Response(
                JSON.stringify({ ok: false, error: 'N8N_OPTIMIZER_WEBHOOK_URL not set' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }


        console.log('Received request:', { userId, adAccountId, mode, caps });

        const jobId = crypto.randomUUID();
        const supabase = await createSupabaseClient();

        // 1) Create the job (queued)
        {
            const { error } = await supabase.from('jobs').insert({
                id: jobId,
                user_id: userId,
                type: 'daily_optimizer',
                status: 'queued',
                step: 'start',
                percent: 0,
                meta: { adAccountId, mode, caps },
            });
            if (error) {
                return new Response(
                    JSON.stringify({ ok: false, error: `supabase insert failed: ${error.message}` }),
                    { status: 500, headers: { 'Content-Type': 'application/json' } }
                );
            }
        }

        // 2) Fire n8n Webhook
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12_000); // 12s safety
        let n8nResp: Response | null = null;
        try {
            n8nResp = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    //  add a shared secret later

                },
                body: JSON.stringify({ jobId, userId, adAccountId, mode, caps }),
                signal: controller.signal,
            });
        } catch (err: any) {
            clearTimeout(timeout);
            // mark job as error
            await supabase
                .from('jobs')
                .update({ status: 'error', error: `n8n unreachable: ${err?.message || 'fetch_failed'}` })
                .eq('id', jobId);

            return new Response(
                JSON.stringify({ ok: false, error: 'n8n_unreachable', jobId }),
                { status: 502, headers: { 'Content-Type': 'application/json' } }
            );
        }
        clearTimeout(timeout);

        if (!n8nResp.ok) {
            const text = await n8nResp.text().catch(() => '');
            await supabase
                .from('jobs')
                .update({ status: 'error', error: `n8n ${n8nResp.status}: ${text?.slice(0, 300)}` })
                .eq('id', jobId);

            return new Response(
                JSON.stringify({ ok: false, error: 'n8n_start_failed', jobId }),
                { status: 502, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(JSON.stringify({ ok: true, jobId }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (e: any) {
        return new Response(
            JSON.stringify({ ok: false, error: e?.message || 'bad_request' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
