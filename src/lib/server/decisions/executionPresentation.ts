import type { Database, Json } from '@/lib/shared/types/supabase';
import { formatCurrencyAmount } from '@/lib/shared/utils/currency';
type Execution = Database['ai']['Tables']['executed_actions']['Row'];
export type ExecutionDisplay = { status: string; startedAt: string | null; completedAt: string | null; before: string | null; after: string | null };
const object = (value: Json | undefined): Record<string, Json | undefined> => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const timestamp = (value:string|null) => value && Number.isFinite(Date.parse(value)) ? value : null;

/** Display only observed, allowlisted fields. Never substitute the proposed state. */
export function executionDisplay(execution:Execution, action:string):ExecutionDisplay {
  const before=object(execution.state_before_json);
  const after=object(execution.state_after_json);
  const capability=object(object(execution.request_metadata_json).budgetCapability);
  const currency=object(before.account).currency;
  const owner=capability.owner;
  const period=capability.period;
  const display=(state:Record<string,Json|undefined>):string|null=>{
    if(action==='PAUSE_DELIVERY_UNIT') {
      const status=object(state.adset).status;
      return status==='ACTIVE'?'Active':status==='PAUSED'?'Paused':null;
    }
    if(action!=='REDUCE_BUDGET'||(owner!=='campaign'&&owner!=='adset')||(period!=='daily'&&period!=='lifetime')||typeof currency!=='string'||!/^[A-Z]{3}$/.test(currency)||object(state.account).currency!==currency) return null;
    const value=object(state[owner])[`${period}_budget`];
    if(typeof capability.ownerId!=='string'||object(state[owner]).id!==capability.ownerId) return null;
    if(typeof value!=='string'||!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))) return null;
    const divisor=10**(new Intl.NumberFormat('en',{style:'currency',currency}).resolvedOptions().maximumFractionDigits??2);
    return `${formatCurrencyAmount(Number(value)/divisor,currency)} ${period} (${owner==='campaign'?'campaign':'ad set'})`;
  };
  return {status:object(execution.error_json).reconciliationRequired===true?'Needs reconciliation':execution.status==='succeeded'?'Executed':execution.status==='failed'?'Execution failed':'Execution pending',startedAt:timestamp(execution.started_at),completedAt:timestamp(execution.completed_at),before:display(before),after:display(after)};
}
