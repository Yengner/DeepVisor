import 'server-only';
import { createAdminClient } from '@/lib/server/supabase/admin';
import {readAllPages} from '@/lib/server/repositories/pagination';
import { hierarchyIssues, unresolvedEvidence } from '@/lib/shared/insights/model';
import type { Observation } from '@/lib/shared/lifecycle/model';
import type { IssueEvidence } from '@/lib/shared/insights/model';
import type { Json } from '@/lib/shared/types/supabase';
export const insightsEnabled=()=>process.env.DEEPVISOR_INSIGHTS_EVENTS==='true';
export async function observeIssues(business:string,account:string,source:string,at:string,issues:IssueEvidence[]){
 if(!insightsEnabled())return;
 const {error}=await createAdminClient().rpc('observe_insight_issues',{p_business:business,p_account:account,p_source:source,p_at:at,p_issues:issues as unknown as Json});
 if(error)throw error;
}
export async function observeHierarchyIssues(business:string,account:string,at:string,entities:Observation[]){
 if(!insightsEnabled())return;
 const previous=await readAllPages((from,to)=>createAdminClient().from('insight_issues').select('evidence').eq('business_id',business).eq('ad_account_id',account).eq('source','hierarchy').is('resolved_at',null).order('id').range(from,to),{nullDataError:'Issue evidence unavailable'});
 const current=hierarchyIssues(entities);
 await observeIssues(business,account,'hierarchy',at,[...current,...unresolvedEvidence(previous.map(r=>r.evidence as unknown as IssueEvidence),entities,current)]);
}

/** One read inside the existing sync worker/request budget. Unknown codes never become billing claims. */
export async function captureAccountHealth(business:string,account:string,external:string,accessToken:string){
 if(!insightsEnabled())return;
 const {fetchMetaObject}=await import('@/lib/server/sync/meta/client');
 const {accountHealthIssues}=await import('@/lib/shared/insights/health');
 const at=new Date().toISOString();
 const response=await fetchMetaObject<{account_status?:number;disable_reason?:number}>({path:external.startsWith('act_')?external:`act_${external}`,accessToken,params:{fields:'account_status,disable_reason'}});
 const evidence=accountHealthIssues(response);
 if(evidence!==null)await observeIssues(business,account,'account',at,evidence);
}
