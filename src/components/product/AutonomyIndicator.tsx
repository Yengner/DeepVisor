import { loadOverviewPolicy } from '@/lib/server/dashboard/overview/load';
import { modeLabel } from '@/lib/server/dashboard/overview/model';
import StatusBadge from './StatusBadge';
import classes from './Product.module.css';
const descriptions = {
  OFF: 'Automatic changes are off in your business policy. Saved reviews remain available in Decisions.',
  SHADOW: 'Shadow evaluations record observations only. They do not execute advertising changes.',
  REVIEW: 'Eligible changes require your approval. Approving records your choice; it does not execute the change here.',
  'LIMITED AUTO': 'Your policy is configured for limited automation. Only allowed, bounded budget reductions or pauses may execute when all safety checks and execution controls permit. This badge does not confirm that execution is enabled.',
  Unavailable: 'Your configured mode could not be loaded. Do not assume automation is on or off; check again shortly.',
};
export default async function AutonomyIndicator({businessId}:{businessId:string}) {
  const policy = await loadOverviewPolicy(businessId);
  const mode = modeLabel(policy.data?.mode ?? null, policy.failed);
  const allowed=(policy.data?.allowed_action_classes??[]).flatMap(action=>action==='REDUCE_BUDGET'?['Budget reduction']:action==='PAUSE_DELIVERY_UNIT'?['Pause ad set']:[]);
  return <details className={classes.mode}><summary>Configured mode: <StatusBadge status={mode}/></summary><p>{descriptions[mode]}</p>{!policy.failed&&mode!=='OFF'&&<p>Configured action classes: {allowed.length?allowed.join(', '):'None'}. Permissions do not confirm that an action has run. Budget increases, targeting edits, and creative changes are not enabled here.</p>}</details>;
}
