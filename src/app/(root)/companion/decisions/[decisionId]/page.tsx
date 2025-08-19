// app/decisions/[decisionId]/page.tsx
import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';
import { notFound } from 'next/navigation';
import DecisionReviewClient, { DecisionSSR, OptimizerActionRow } from '../../components/DecisionReviewClient';
// Adjust this import to your actual server supabase helper

export default async function DecisionPage({ params }: { params: Promise<{ decisionId: string }> }) {
  const { decisionId } = await params;
  const supabase = await createSupabaseClient();

  const { data: d, error: dErr } = await supabase
    .from('decisions')
    .select('*')
    .eq('id', decisionId)
    .single();

  if (!d || dErr) notFound();

  // Parse JSON columns safely on the server
  const plan = typeof d.plan_json === 'string' ? safeParse(d.plan_json) : d.plan_json;
  const gk   = typeof d.gatekeeper_result === 'string' ? safeParse(d.gatekeeper_result) : d.gatekeeper_result;

  const { data: rows, error: rErr } = await supabase
    .from('v_optimizer_actions')
    .select('*')
    .eq('decision_id', decisionId);

  if (rErr) {
    // You could show a nicer error UI if you prefer
    notFound();
  }

  const decision: DecisionSSR = {
    id: d.id,
    user_id: d.user_id,
    ad_account_id: d.ad_account_id,
    job_id: d.job_id,
    mode: d.mode,
    status: d.status,
    review_mode: d.review_mode,
    created_at: d.created_at,
    plan_meta: plan?.meta ?? {},
    gatekeeper_result: gk ?? null,
  };

  return (
    <DecisionReviewClient
      decision={decision}
      actions={(rows || []) as OptimizerActionRow[]}
    />
  );
}

function safeParse(s: string) {
  try { return JSON.parse(s); } catch { return null; }
}
