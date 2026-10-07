import { describe, expect, it } from 'vitest';
import type { Database } from '@/lib/shared/types/supabase';
import { executionDisplay } from './executionPresentation';
const fixture=():Database['ai']['Tables']['executed_actions']['Row']=>({id:'execution',business_id:'business',action_proposal_id:'proposal',status:'succeeded',created_at:'2026-10-07T10:00:00Z',updated_at:'2026-10-07T11:00:00Z',started_at:'2026-10-07T10:00:00Z',completed_at:'2026-10-07T11:00:00Z',error_json:null,
  request_metadata_json:{budgetCapability:{owner:'campaign',ownerId:'campaign',period:'daily'},request:{fields:{daily_budget:'8000'}}},
  state_before_json:{account:{currency:'USD'},campaign:{id:'campaign',daily_budget:'10000'},adset:{status:'ACTIVE'}},
  state_after_json:{account:{currency:'USD'},campaign:{id:'campaign',daily_budget:'9000'},adset:{status:'PAUSED'}},
});
describe('read-only execution audit presentation',()=>{
  it('shows observed budget owner values, not the requested amount',()=>{
    expect(executionDisplay(fixture(),'REDUCE_BUDGET')).toMatchObject({status:'Executed',before:'$100.00 daily (campaign)',after:'$90.00 daily (campaign)'});
  });
  it('never invents after-state or timestamps when missing',()=>{
    const data=fixture();data.state_after_json=null;data.completed_at=null;data.started_at='bad';
    expect(executionDisplay(data,'REDUCE_BUDGET')).toMatchObject({after:null,completedAt:null,startedAt:null});
  });
  it('supports observed pause status independently of budget metadata',()=>{
    const data=fixture();data.request_metadata_json={};
    expect(executionDisplay(data,'PAUSE_DELIVERY_UNIT')).toMatchObject({before:'Active',after:'Paused'});
  });
  it('prioritizes reconciliation over an execution status',()=>{
    const data=fixture();data.error_json={reconciliationRequired:true};
    expect(executionDisplay(data,'REDUCE_BUDGET').status).toBe('Needs reconciliation');
  });
  it('rejects malformed, mismatched and unsupported audit fields',()=>{
    const data=fixture();data.state_after_json={account:{currency:'EUR'},campaign:{id:'campaign',daily_budget:'9000'}};
    expect(executionDisplay(data,'REDUCE_BUDGET').after).toBeNull();
    data.state_after_json={account:{currency:'USD'},campaign:{id:'other',daily_budget:'9000'}};
    expect(executionDisplay(data,'REDUCE_BUDGET').after).toBeNull();
    data.state_after_json={account:{currency:'USD'},campaign:{id:'campaign',daily_budget:'-5'}};
    expect(executionDisplay(data,'REDUCE_BUDGET').after).toBeNull();
    expect(executionDisplay(data,'INCREASE_BUDGET').before).toBeNull();
  });
});
