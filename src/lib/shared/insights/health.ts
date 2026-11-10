import type {IssueEvidence} from './model';
/** Preserve provider codes, but don't infer a specific billing or policy cause from disabled delivery alone. */
export function accountHealthIssues(raw:{account_status?:number;disable_reason?:number}):IssueEvidence[]|null{
 if(raw.account_status===1)return [];
 if(raw.account_status!==2&&raw.account_status!==3)return null;
 return [{key:'account-disabled',title:'Meta reports an unavailable advertising account',explanation:'Delivery may be blocked at the account level. Check Meta’s account and billing notices for the confirmed reason.',action:'Open Connections',href:'/integration',entities:[],code:`ACCOUNT_STATUS_${raw.account_status}${Number.isInteger(raw.disable_reason)?`_REASON_${raw.disable_reason}`:''}`}];
}
