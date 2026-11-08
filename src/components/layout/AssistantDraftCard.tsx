'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { AssistantPlan, CreativeCard } from '@/lib/shared/assistant/contracts';
import { formatCurrencyAmount } from '@/lib/shared/utils/currency';
import classes from './Assistant.module.css';
export default function AssistantDraftCard({ plan, creatives, currency, timezone, busy, savedDraftId, onSave, onModify }: {
    plan: AssistantPlan;
    creatives: CreativeCard[];
    currency: string | null;
    timezone: string | null;
    busy: boolean;
    savedDraftId: string | null;
    onSave: (plan: AssistantPlan) => Promise<boolean>;
    onModify: (plan: AssistantPlan) => Promise<boolean>;
}) {
    const [value, setValue] = useState(plan);
    const [confirmed, setConfirmed] = useState(false);
    const [editing, setEditing] = useState(false);
    const update = <K extends keyof AssistantPlan>(key: K, next: AssistantPlan[K]) => { setValue(v => ({ ...v, [key]: next })); setConfirmed(false); };
    const number = (key: 'budgetAmount' | 'durationDays' | 'radius' | 'ageMin' | 'ageMax' | 'latitude' | 'longitude', label: string) => <label>{label}<input type="number" step={['budgetAmount', 'latitude', 'longitude'].includes(key) ? 'any' : '1'} value={value[key] ?? ''} onChange={e => update(key, e.target.value === '' ? null : Number(e.target.value))}/></label>;
    return <section className={classes.draftCard} aria-label="Proposed campaign draft">
    <div className={classes.cardHeading}><strong>{savedDraftId ? 'Saved review draft' : 'Campaign proposal'}</strong><span>{savedDraftId ? 'Not published' : 'Suggestions · confirm before saving'}</span></div>
    <ol className={classes.preview} aria-label="Campaign structure"><li><small>Campaign</small><strong>{value.concept || 'Describe your campaign'}</strong><span>{value.targetMode === 'new_campaign' ? 'New campaign' : 'Reuse existing campaign'}</span></li><li><small>Ad set</small><strong>{value.location || 'Location needed'}</strong><span>{value.budgetAmount !== null && currency ? formatCurrencyAmount(value.budgetAmount, currency) : 'Budget needed'}{value.budgetType === 'daily' ? ' / day' : value.budgetType === 'lifetime' ? ' total' : ''} · {value.durationDays ?? '?'} days</span></li><li><small>Ad</small><strong>{value.headline || 'Creative to review'}</strong><span>{value.creativeId ? 'Existing creative selected' : 'Media required before publishing'}</span></li></ol>
    <button type="button" onClick={() => setEditing(v => !v)} aria-expanded={editing}>{editing ? 'Close editor' : 'Modify suggestions'}</button>
    {editing && <div className={classes.draftFields}>
      <label>Campaign concept<input value={value.concept ?? ''} maxLength={120} onChange={e => update('concept', e.target.value || null)}/></label>
      <label>Goal<select value={value.objective ?? ''} onChange={e => update('objective', e.target.value as AssistantPlan['objective'])}><option value="">Choose goal</option><option value="OUTCOME_LEADS">Leads</option><option value="OUTCOME_ENGAGEMENT">Engagement (builder unavailable)</option></select></label>
      <label>Contact destination<select value={value.destination ?? ''} onChange={e => update('destination', e.target.value as AssistantPlan['destination'])}><option value="">Choose destination</option><option value="MESSENGER">Messenger</option><option value="WHATSAPP">WhatsApp</option><option value="ON_AD">Instant form</option><option value="PHONE_CALL">Phone calls</option></select></label>
      <label>Budget type<select value={value.budgetType ?? ''} onChange={e => update('budgetType', e.target.value as AssistantPlan['budgetType'])}><option value="">Choose budget type</option><option value="lifetime">Total budget</option><option value="daily">Daily budget</option></select></label>
      {number('budgetAmount', `Budget (${currency ?? 'account currency unavailable'})`)}{number('durationDays', 'Duration in days')}
      <label>Start date and time (ISO with timezone)<input placeholder="2026-11-10T09:00:00-05:00" value={value.startAt ?? ''} onChange={e => update('startAt', e.target.value || null)}/><small>Account timezone: {timezone ?? 'unavailable'}</small></label>
      <label>Location<input value={value.location ?? ''} onChange={e => update('location', e.target.value || null)}/></label>
      {number('radius', 'Radius (miles)')}{number('ageMin', 'Minimum age')}{number('ageMax', 'Maximum age')}
      <label>Audience<select value={value.genders.length === 1 ? value.genders[0] : 'all'} onChange={e => update('genders', e.target.value === 'all' ? [] : [e.target.value as 'male' | 'female'])}><option value="all">All genders</option><option value="female">Women</option><option value="male">Men</option></select></label>
      <details><summary>Location coordinates (optional for review draft)</summary>{number('latitude', 'Latitude')}{number('longitude', 'Longitude')}</details>
      <label>Campaign placement<select value={value.targetMode} onChange={e => update('targetMode', e.target.value as AssistantPlan['targetMode'])}><option value="new_campaign">New campaign</option><option value="existing_campaign">Existing campaign</option><option value="existing_adset">Existing ad set</option></select></label>
      {value.targetMode !== 'new_campaign' && <label>Verified campaign ID<input value={value.campaignId ?? ''} onChange={e => update('campaignId', e.target.value || null)}/></label>}
      {value.targetMode === 'existing_adset' && <label>Verified ad-set ID<input value={value.adSetId ?? ''} onChange={e => update('adSetId', e.target.value || null)}/></label>}
      <label>Headline<input value={value.headline ?? ''} onChange={e => update('headline', e.target.value || null)}/></label>
      <label>Ad text<textarea rows={3} value={value.primaryText ?? ''} onChange={e => update('primaryText', e.target.value || null)}/></label>
      <label>Creative<select value={value.creativeId ?? ''} onChange={e => update('creativeId', e.target.value || null)}><option value="">Add media later</option>{value.creativeId && !creatives.some(c => c.id === value.creativeId) && <option value={value.creativeId}>Selected saved creative</option>}{creatives.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <button type="button" disabled={busy} onClick={() => void onModify(value)}>Keep these edits in conversation</button>
    </div>}
    <p className={classes.context}>This saves a review draft only. Location, destination setup and media may still need completion in the campaign builder.</p>
    {savedDraftId ? <Link href={`/campaigns/create?draft=${encodeURIComponent(savedDraftId)}`}>Open saved draft →</Link> : <><label className={classes.confirm}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/> I reviewed and confirm these draft values.</label><button type="button" disabled={busy || !confirmed} onClick={() => void onSave(value)}>Save draft</button></>}
  </section>;
}
