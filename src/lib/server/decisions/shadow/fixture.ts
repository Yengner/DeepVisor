import type { DecisionResult } from '../types';
import { evaluationVersion, type ShadowJob } from './evaluate';
export const now = new Date('2026-10-06T12:00:00.000Z');
export const identity = { providerId:'test',providerVersion:'1',modelId:'test-model',modelVersion:'1' };
export const decision: DecisionResult = { ...identity,decision:'REDUCE_BUDGET',confidence:0.9 };
export function fixture(): ShadowJob {
  return { id:'job',business_id:'business',platform_integration_id:'integration',ad_account_id:'account',entity_id:'123',
    evaluation_version:evaluationVersion(identity),source_hash:'hash',source_synced_at:now.toISOString(),source_sync_job_id:'sync',started_at:now.toISOString(),
    feature_snapshot_id:'snapshot',decision_run_id:'run',action_proposal_id:'proposal',history:[],
    source_json:{ asOfDay:'2026-10-05',currency:'USD',timeZone:'UTC',
      entity:{id:'123',campaignId:'789',status:'ACTIVE',effectiveStatus:'ACTIVE',campaignStatus:'ACTIVE',dailyBudget:'10000',lifetimeBudget:'0',campaignDailyBudget:'0',campaignLifetimeBudget:'0'},
      policy:{ id:'policy',business_id:'business',mode:'observe',allowed_action_classes:['REDUCE_BUDGET','PAUSE_DELIVERY_UNIT'],max_budget_change_percent:20,
        budget_boundaries_json:{lockedEntityIds:[],currency:'USD',timeZone:'UTC',budgetPeriod:'daily',minBudgetMinor:1000,maxBudgetMinor:20000},
        cooldown_config_json:{cooldownHours:24,maxDailyChanges:3},minimum_evidence_json:{spend:100,impressions:600,results:2,activeDays:4,decisionConfidence:0.8,trackingConfidence:'medium',maxSnapshotAgeDays:1,maxEntityAgeMinutes:15},
      },
      rows:Array.from({length:60},(_,i)=>({adset_id:'123',day:new Date(now.getTime()-(i+1)*86400000).toISOString().slice(0,10),spend:20,reach:500,impressions:1000,clicks:50,inline_link_clicks:40,leads:2,messages:1,calls:0})),
    },
  };
}

