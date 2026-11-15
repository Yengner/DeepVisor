import type {IssueEvidence} from './model';

/**
 * Meta ad-account codes (Marketing API ad-account reference, `account_status` and
 * `disable_reason`). Only these explicit provider codes produce a specific cause; anything else
 * stays a generic "unavailable account" notice, and an unknown status produces no claim at all.
 */
export const ACCOUNT_STATUS={ACTIVE:1,DISABLED:2,UNSETTLED:3,PENDING_RISK_REVIEW:7,PENDING_SETTLEMENT:8,IN_GRACE_PERIOD:9,PENDING_CLOSURE:100,CLOSED:101} as const;
export const DISABLE_REASON={ADS_INTEGRITY_POLICY:1,ADS_IP_REVIEW:2,RISK_PAYMENT:3,GRAY_ACCOUNT_SHUT_DOWN:4,ADS_AFC_REVIEW:5,BUSINESS_INTEGRITY_RAR:6,PERMANENT_CLOSE:7,UNUSED_RESELLER_ACCOUNT:8,UNUSED_ACCOUNT:9,UMBRELLA_AD_ACCOUNT:10,BUSINESS_MANAGER_INTEGRITY_POLICY:11,MISREPRESENTED_AD_ACCOUNT:12,AOAB_DESHARE_LEGAL_ENTITY:13,CTX_THREAD_REVIEW:14,COMPROMISED_AD_ACCOUNT:15} as const;

export type AccountCause='billing'|'billing-pending'|'payment-risk'|'policy'|'review'|'compromised'|'closed'|'unavailable';
const BILLING_URL='https://business.facebook.com/billing_hub/payment_settings';
const QUALITY_URL='https://business.facebook.com/accountquality';

const CAUSES:Record<AccountCause,Pick<IssueEvidence,'title'|'explanation'|'action'|'href'>>={
 billing:{title:'Meta reports an unpaid balance',explanation:'Meta lists this ad account as unsettled, so ads can’t run until the outstanding balance is paid.',action:'Review billing in Meta',href:BILLING_URL},
 'billing-pending':{title:'Meta is waiting on a payment',explanation:'Meta reports a pending settlement or grace period. Ads can keep running for now, but Meta may stop them if the payment isn’t completed.',action:'Review billing in Meta',href:BILLING_URL},
 'payment-risk':{title:'Meta disabled this account over a payment concern',explanation:'Meta disabled the ad account and gives a payment-risk reason. Meta’s notice explains what it needs.',action:'Review billing in Meta',href:BILLING_URL},
 policy:{title:'Meta disabled this account for a policy reason',explanation:'Meta disabled the ad account under its advertising or business integrity policies. You can usually request a review in Account Quality.',action:'Open Account Quality',href:QUALITY_URL},
 review:{title:'Meta is reviewing this ad account',explanation:'Meta reports the account as under review. Ads may not run until the review finishes.',action:'Open Account Quality',href:QUALITY_URL},
 compromised:{title:'Meta flagged this account as compromised',explanation:'Meta disabled the ad account because it may have been accessed without permission. Secure the account in Meta before advertising again.',action:'Open Account Quality',href:QUALITY_URL},
 closed:{title:'This ad account is closed',explanation:'Meta reports the ad account as closed or closing. Ads can’t run from it.',action:'Open Connections',href:'/integration'},
 unavailable:{title:'Meta reports an unavailable advertising account',explanation:'Delivery may be blocked at the account level. Check Meta’s account and billing notices for the confirmed reason.',action:'Open Connections',href:'/integration'},
};

/** The cause Meta's explicit codes support, or null when the status is active or unknown. */
export function accountCause(status?:number,reason?:number):AccountCause|null{
 switch(status){
  case ACCOUNT_STATUS.UNSETTLED:return 'billing';
  case ACCOUNT_STATUS.PENDING_SETTLEMENT:case ACCOUNT_STATUS.IN_GRACE_PERIOD:return 'billing-pending';
  case ACCOUNT_STATUS.PENDING_RISK_REVIEW:return 'review';
  case ACCOUNT_STATUS.PENDING_CLOSURE:case ACCOUNT_STATUS.CLOSED:return 'closed';
  case ACCOUNT_STATUS.DISABLED:
   if(reason===DISABLE_REASON.RISK_PAYMENT)return 'payment-risk';
   if(reason===DISABLE_REASON.COMPROMISED_AD_ACCOUNT)return 'compromised';
   if(reason===DISABLE_REASON.PERMANENT_CLOSE)return 'closed';
   if(reason===DISABLE_REASON.ADS_INTEGRITY_POLICY||reason===DISABLE_REASON.BUSINESS_MANAGER_INTEGRITY_POLICY||reason===DISABLE_REASON.BUSINESS_INTEGRITY_RAR||reason===DISABLE_REASON.MISREPRESENTED_AD_ACCOUNT)return 'policy';
   if(reason===DISABLE_REASON.ADS_IP_REVIEW||reason===DISABLE_REASON.ADS_AFC_REVIEW||reason===DISABLE_REASON.CTX_THREAD_REVIEW)return 'review';
   return 'unavailable';
  default:return null;
 }
}

/** Read the cause back from a saved issue code such as `ACCOUNT_STATUS_2_REASON_3`. */
export function causeFromCode(code:string):AccountCause|null{
 const match=/^ACCOUNT_STATUS_(\d+)(?:_REASON_(\d+))?$/.exec(code);
 return match?accountCause(Number(match[1]),match[2]===undefined?undefined:Number(match[2])):null;
}

/**
 * Point Meta Billing / Account Quality at this ad account. Meta does not document a deep-link
 * parameter; `asset_id` is what Meta's own Business Suite links use. If Meta ignores it, the link
 * still opens the right page with the account picker, so this degrades to the generic link.
 */
export function metaAccountLink(href:string,externalAccountId?:string|null):string{
 const id=externalAccountId?.replace(/^act_/,'');
 if(!id||!/^\d{1,20}$/.test(id)||!/^https:\/\/business\.facebook\.com\//.test(href))return href;
 const url=new URL(href);url.searchParams.set('asset_id',id);return url.toString();
}

/** Preserve provider codes; name a billing or policy cause only when Meta's own code states it. */
export function accountHealthIssues(raw:{account_status?:number;disable_reason?:number},externalAccountId?:string|null):IssueEvidence[]|null{
 if(raw.account_status===ACCOUNT_STATUS.ACTIVE)return [];
 const cause=accountCause(raw.account_status,raw.disable_reason);
 if(!cause)return null;
 const copy=CAUSES[cause];
 return [{key:'account-disabled',...copy,href:metaAccountLink(copy.href,externalAccountId),entities:[],code:`ACCOUNT_STATUS_${raw.account_status}${Number.isInteger(raw.disable_reason)?`_REASON_${raw.disable_reason}`:''}`}];
}
