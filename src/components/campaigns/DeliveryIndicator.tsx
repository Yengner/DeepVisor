import classes from './CampaignDashboard.module.css';
export function DeliveryIndicator({ active }: { active?: boolean }) {
  return active ? <span className={classes.deliveryIndicator} title="Campaign, ad set and at least one ad are active in the latest saved Meta status. This is not a live impression check.">Active ads</span> : null;
}
