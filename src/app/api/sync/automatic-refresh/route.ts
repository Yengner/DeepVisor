import { NextRequest, NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { enqueueAutomaticAccountSync, targetedSimulationAllowed } from '@/lib/server/sync/automaticRefresh';
import { dispatchAccountSync } from '@/lib/server/sync/dispatch';
export const maxDuration = 300;
const headers = { 'Cache-Control': 'no-store' };

async function scope() {
  const { businessId } = await getRequiredAppContext();
  return { businessId, ...await resolveCurrentSelection(businessId) };
}
export async function POST(request: NextRequest) {
  if(request.headers.get('origin')!==request.nextUrl.origin) return NextResponse.json({error:'Forbidden'},{status:403});
  try {
    // No browser-supplied tenant, integration, account or freshness overrides.
    const body=await request.json();
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length) return NextResponse.json({error:'Invalid payload'},{status:400});
    const {businessId,selectedPlatformId,selectedAdAccountId}=await scope();
    if(!selectedPlatformId||!selectedAdAccountId)return NextResponse.json({status:'skipped',reason:'not_connected'},{headers});
    const result=await enqueueAutomaticAccountSync({businessId,integrationId:selectedPlatformId,adAccountId:selectedAdAccountId,
      source:'app_visit',allowSimulation:targetedSimulationAllowed()});
    if(result.status==='queued'&&result.jobId)dispatchAccountSync(result.jobId,businessId);
    return NextResponse.json(result,{status:result.jobId?202:200,headers});
  } catch(error) {
    unstable_rethrow(error);
    if(error instanceof SyntaxError)return NextResponse.json({error:'Invalid payload'},{status:400});
    console.error('Automatic Meta refresh unavailable');
    return NextResponse.json({error:'Automatic refresh unavailable.'},{status:500,headers});
  }
}
export async function GET(request: NextRequest) {
  try {
    const {businessId,selectedPlatformId,selectedAdAccountId}=await scope();
    if(!selectedPlatformId||!selectedAdAccountId)return NextResponse.json({status:'disconnected',lastSuccessfulAt:null},{headers});
    const client=createAdminClient();
    const [state,latest,integration]=await Promise.all([
      client.from('ad_account_sync_state').select('last_successful_sync_job_id').eq('ad_account_id',selectedAdAccountId).maybeSingle(),
      client.from('account_sync_jobs').select('id,status,finished_at').eq('business_id',businessId)
        .eq('platform_integration_id',selectedPlatformId).eq('ad_account_id',selectedAdAccountId).order('created_at',{ascending:false}).limit(1).maybeSingle(),
      client.from('platform_integrations').select('status,token_expires_at').eq('business_id',businessId).eq('id',selectedPlatformId).maybeSingle(),
    ]);
    if(state.error||latest.error||integration.error)throw state.error??latest.error??integration.error;
    let lastSuccessfulAt:string|null=null;
    if(state.data?.last_successful_sync_job_id){
      const success=await client.from('account_sync_jobs').select('finished_at').eq('id',state.data.last_successful_sync_job_id)
        .eq('business_id',businessId).eq('ad_account_id',selectedAdAccountId).eq('status','completed').maybeSingle();
      if(success.error)throw success.error;lastSuccessfulAt=success.data?.finished_at??null;
    }
    if(lastSuccessfulAt&&request.nextUrl.searchParams.has('knownSuccessfulAt')&&request.nextUrl.searchParams.get('knownSuccessfulAt')!==lastSuccessfulAt)
      revalidateTag(`dashboard-context:${businessId}`,{expire:0});
    const reauth=integration.data?.status==='needs_reauth'||Boolean(integration.data?.token_expires_at&&Date.parse(integration.data.token_expires_at)<=Date.now());
    return NextResponse.json({status:reauth?'reauthentication_required':latest.data?.status??'never_synced',jobId:latest.data?.id??null,lastSuccessfulAt},{headers});
  } catch(error) {
    unstable_rethrow(error);console.error('Automatic refresh status unavailable');
    return NextResponse.json({error:'Sync status unavailable.'},{status:500,headers});
  }
}
