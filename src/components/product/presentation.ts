export type StatusTone = 'positive' | 'information' | 'attention' | 'problem' | 'neutral';
const statuses: Record<string, { label: string; tone: StatusTone }> = {
  Healthy: { label: 'Healthy', tone: 'positive' },
  Executed: { label: 'Executed', tone: 'positive' },
  HOLD: { label: 'No change recommended', tone: 'positive' },
  Watching: { label: 'Watching', tone: 'information' },
  REVIEW: { label: 'Review', tone: 'information' },
  SHADOW: { label: 'Shadow', tone: 'information' },
  Shadow: { label: 'Shadow', tone: 'information' },
  'Observation only': { label: 'Shadow only', tone: 'information' },
  'Shadow recommendation': { label: 'Shadow recommendation', tone: 'information' },
  Recommendation: { label: 'Recommendation', tone: 'information' },
  'Needs approval': { label: 'Approval required', tone: 'attention' },
  'Approval required': { label: 'Approval required', tone: 'attention' },
  'Approved - not executed': { label: 'Approved · Not executed', tone: 'information' },
  Approved: { label: 'Approved · Not executed', tone: 'information' },
  Blocked: { label: 'Blocked', tone: 'problem' },
  'Needs attention': { label: 'Needs attention', tone: 'problem' },
  'Execution failed': { label: 'Execution needs checking', tone: 'problem' },
  'Needs reconciliation': { label: 'Change needs verification', tone: 'problem' },
  'Check failed': { label: 'Check unavailable', tone: 'problem' },
  'Execution pending': { label: 'Execution pending', tone: 'attention' },
  'Eligible - not executed': { label: 'Eligible · Not executed', tone: 'information' },
  'LIMITED AUTO': { label: 'Limited Auto', tone: 'information' },
  OFF: { label: 'Off', tone: 'neutral' },
  Paused: { label: 'Paused', tone: 'neutral' },
  'Insufficient data': { label: 'Insufficient data', tone: 'neutral' },
  active: { label: 'Active', tone: 'information' },
  paused: { label: 'Paused', tone: 'neutral' },
  disabled: { label: 'Disabled', tone: 'neutral' },
  inactive: { label: 'Inactive', tone: 'neutral' },
  learning: { label: 'Learning', tone: 'information' },
  pending_review: { label: 'In review', tone: 'attention' },
  in_review: { label: 'In review', tone: 'attention' },
  disapproved: { label: 'Not approved', tone: 'problem' },
  failed: { label: 'Needs attention', tone: 'problem' },
  error: { label: 'Needs attention', tone: 'problem' },
  connected: { label: 'Connected', tone: 'positive' },
  disconnected: { label: 'Disconnected', tone: 'neutral' },
  needs_reauth: { label: 'Reconnect required', tone: 'attention' },
  expired: { label: 'Reconnect required', tone: 'attention' },
};
const normalizedStatuses = Object.fromEntries(Object.entries(statuses).map(([key,value])=>[key.toLowerCase(),value]));
export function statusPresentation(status: string | null | undefined) {
  if (!status?.trim()) return { label: 'Unavailable', tone: 'neutral' as const };
  return normalizedStatuses[status.trim().toLowerCase()] ?? { label: status.replaceAll('_', ' '), tone: 'neutral' as const };
}
export const ownerMessages = {
  refresh: 'We could not finish refreshing your data. Check the latest sync status before trying again.',
  accounts: 'Your Meta accounts could not be loaded. Try again or check your connection.',
  selection: 'The account selection could not be confirmed. Refresh to check the selected account.',
  preferences: 'Your settings could not be fully saved. Reload to check them before trying again.',
  connection: 'This connection needs checking. Review its status or reconnect to Meta.',
  review: 'Your review could not be confirmed. Refresh to check its latest status before trying again.',
} as const;
export function meaningfulConfidence(provider: string, probability: number | null, confidence: number | null) {
  if (provider === 'Sample evaluation') return null;
  const value = probability ?? confidence;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}
export function monitoringSummary(evaluations:number, holds:number) {
  if(!Number.isSafeInteger(evaluations)||!Number.isSafeInteger(holds)||holds<0||evaluations<holds||evaluations<0) return 'Evaluation summary unavailable.';
  if(evaluations===0) return 'No completed evaluations recorded today. Check the latest sync and evaluation status above.';
  return holds>0?`${holds} evaluation${holds===1?'':'s'} recommended no change today.`:'Completed reviews are available in Decisions.';
}
