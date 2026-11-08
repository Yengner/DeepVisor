import 'server-only';
import { z } from 'zod';
import { zodResponsesFunction } from 'openai/helpers/zod';
import { authorizeAssistant, AssistantError, type AssistantAccess } from './access';
import { analyticsNames, analyticsTools, readAnalytics } from './analytics';
import { historicalDefaults } from './history';
import { asRecord } from '@/lib/shared/utils/format';
import { mediaFor } from '@/lib/server/campaigns/exploration/model';
import type { CreativeCard } from '@/lib/shared/assistant/contracts';
export const toolNames = ['getBusinessProfile', 'getAdvertisingDefaults', 'getPreviousCampaigns', 'getCampaignStructure', 'getCreativeHistory', 'getCreativePerformance', 'getAdvertisingGoals', 'getAccountCapabilities'] as const;
export type ToolName = typeof toolNames[number];
export const toolArguments = z.object({ campaignId: z.string().max(255).nullable(), objective: z.enum(['OUTCOME_LEADS', 'OUTCOME_ENGAGEMENT']).nullable(), optimizationGoal: z.string().max(80).nullable() }).strict();
const descriptions: Record<ToolName, string> = {
    getBusinessProfile: 'Saved business identity and preferences; no contact details.',
    getAdvertisingDefaults: 'Saved preferences and observed campaign-owned budget medians by objective, with coverage. Provide objective when known.',
    getPreviousCampaigns: 'Latest 50 saved campaigns, native IDs and observed configuration. Not live Meta state.',
    getCampaignStructure: 'Saved child ad sets and ads for a campaign. campaignId required. IDs are native Meta IDs.',
    getCreativeHistory: 'Latest 20 saved creative names, copy and IDs; concept labels are not inferred.',
    getCreativePerformance: 'Legacy all-history ad summary. For date-specific creative/ad questions use getPerformanceRankings or getAccountPerformance instead. Not causal or a guaranteed best creative.',
    getAdvertisingGoals: 'Saved goals and result definitions. Appointments cannot be inferred from leads.',
    getAccountCapabilities: 'Account currency, timezone and actual assistant capabilities. No live advertising writes.',
};
export const assistantTools = [...toolNames.map(name => zodResponsesFunction({ name, description: descriptions[name], parameters: toolArguments })), ...analyticsTools];
export async function loadCreatives(scope: AssistantAccess) {
    const { data, error } = await scope.db.from('ad_creatives').select('*').eq('business_id', scope.businessId).eq('ad_account_id', scope.account.id).order('updated_at', { ascending: false }).limit(20);
    if (error)
        throw new AssistantError('Creative history is unavailable.', 503);
    return data ?? [];
}
export async function creativeCards(scope: AssistantAccess, ids: string[]): Promise<CreativeCard[]> {
    if (!ids.length) return [];
    const { data, error } = await scope.db.from('ad_creatives').select('*').eq('business_id', scope.businessId).eq('ad_account_id', scope.account.id).in('platform_creative_id', ids.slice(0, 4)).limit(4);
    if (error) throw new AssistantError('Creative previews are unavailable.', 503);
    return (data ?? []).map(c => ({ id: c.platform_creative_id, name: c.name || c.headline || 'Saved creative', image: mediaFor(c).image, kind: mediaFor(c).kind }));
}
export async function readAssistantTool(name: string, args: unknown, expected: Pick<AssistantAccess, 'businessId' | 'userId' | 'account'>, reads = new Map<string, Promise<unknown>>()) {
    // Reauthorize every invocation; caller-supplied IDs are never authorization.
    const scope = await authorizeAssistant(expected.account.id);
    if (scope.businessId !== expected.businessId || scope.userId !== expected.userId)
        throw new AssistantError('Account access changed.', 403);
    if ((analyticsNames as readonly string[]).includes(name)) {
        const key = JSON.stringify([scope.businessId, scope.account.id, scope.userId, name, args]);
        let pending = reads.get(key);
        if (!pending) { pending = readAnalytics(name, args, scope); reads.set(key, pending); }
        return pending;
    }
    const parsed = toolArguments.parse(args);
    if (!toolNames.includes(name as ToolName))
        throw new AssistantError('Unknown assistant tool.');
    const { db, businessId, account } = scope;
    if (name === 'getAccountCapabilities')
        return { accountName: account.name, currency: account.currency_code, timezone: account.timezone, readSavedHistory: true, saveReviewDraft: true, supportedDraftObjectives: ['OUTCOME_LEADS'], metaWrites: false, uploads: true, uploadLimitation: 'Private draft attachments up to 4 MB. No Meta upload or model media analysis.', integrationStatus: scope.integration.status };
    if (['getBusinessProfile', 'getAdvertisingGoals', 'getAdvertisingDefaults'].includes(name)) {
        const { data: profile, error } = await db.from('business_profiles').select('business_name,industry,promoted_services,primary_goal,ad_goals,lead_type,monthly_budget,business_location,customer_radius,target_cost_per_lead,preferred_contact_method').eq('id', businessId).maybeSingle();
        if (error)
            throw new AssistantError('Business preferences are unavailable.', 503);
        if (name === 'getBusinessProfile')
            return { source: 'saved_preferences', currency: null, profile };
        if (name === 'getAdvertisingGoals')
            return { primaryGoal: profile?.primary_goal, goals: profile?.ad_goals, resultDefinition: profile?.lead_type, targetCostRange: profile?.target_cost_per_lead, warning: 'Leads, conversations, calls and appointments are different outcomes.' };
        const campaigns = await previousCampaigns(scope);
        const { data: adsets, error: audienceError } = await db.from('ad_entities').select('parent_external_id,optimization_goal,raw,updated_at').eq('business_id', businessId).eq('ad_account_id', account.id).eq('entity_level', 'adset').order('updated_at', { ascending: false }).limit(100);
        if (audienceError)
            throw new AssistantError('Historical audience settings are unavailable.', 503);
        const matching = (adsets ?? []).filter(a => parsed.optimizationGoal && a.optimization_goal === parsed.optimizationGoal && campaigns.some(c => c.external_id === a.parent_external_id && c.objective === parsed.objective));
        // A mixed-goal campaign is not a comparable budget observation.
        const comparable = campaigns.filter(c => matching.some(a => a.parent_external_id === c.external_id) && !(adsets ?? []).some(a => a.parent_external_id === c.external_id && a.optimization_goal !== parsed.optimizationGoal));
        const audiences = new Map<string, {
            settings: unknown;
            count: number;
            observedFrom: string;
            observedThrough: string;
        }>();
        for (const adset of matching) {
            const raw = asRecord(adset.raw), target = asRecord(raw.targeting), geo = asRecord(target.geo_locations);
            const settings = { ageMin: target.age_min ?? null, ageMax: target.age_max ?? null, genders: target.genders ?? null, geography: { countries: geo.countries ?? null, regions: geo.regions ?? null, cities: geo.cities ?? null, customLocations: geo.custom_locations ?? null } };
            if (!Object.keys(target).length)
                continue;
            const key = JSON.stringify(settings), current = audiences.get(key);
            audiences.set(key, { settings, count: (current?.count ?? 0) + 1, observedFrom: current && current.observedFrom < adset.updated_at ? current.observedFrom : adset.updated_at, observedThrough: current && current.observedThrough > adset.updated_at ? current.observedThrough : adset.updated_at });
        }
        return { savedPreferences: profile, savedPreferenceCurrency: null, history: historicalDefaults(comparable, account.currency_code, parsed.objective), optimizationGoal: parsed.optimizationGoal, audienceObservations: [...audiences.values()].filter(a => a.count >= 3).sort((a, b) => b.count - a.count).slice(0, 3), coverage: 'Latest 50 campaigns and 100 ad sets only; compatible optimization goal required. Audience observations are not recommendations or confirmed preferences.' };
    }
    if (name === 'getPreviousCampaigns')
        return (await previousCampaigns(scope)).map(c => ({ id: c.external_id, name: c.name, objective: c.objective, observedAt: c.updated_at }));
    if (name === 'getCampaignStructure') {
        if (!parsed.campaignId)
            throw new AssistantError('Select a campaign first.');
        const { data: parent, error: parentError } = await db.from('ad_entities').select('id').eq('business_id', businessId).eq('ad_account_id', account.id).eq('entity_level', 'campaign').eq('external_id', parsed.campaignId).maybeSingle();
        if (parentError || !parent)
            throw new AssistantError('Campaign is unavailable in this account.');
        const { data, error } = await db.from('ad_entities').select('external_id,name,entity_level,parent_external_id,optimization_goal,creative_external_id,raw,updated_at').eq('business_id', businessId).eq('ad_account_id', account.id).eq('campaign_id', parent.id).order('external_id').limit(50);
        if (error)
            throw new AssistantError('Campaign structure is unavailable.', 503);
        return { scope: 'Up to 50 saved children; not a complete inventory if limit reached.', nodes: (data ?? []).map(n => { const raw = asRecord(n.raw); const targeting = asRecord(raw.targeting); return { id: n.external_id, name: n.name, level: n.entity_level, parentId: n.parent_external_id, creativeId: n.creative_external_id, optimization: n.optimization_goal, observedAt: n.updated_at, audience: { ageMin: targeting.age_min ?? null, ageMax: targeting.age_max ?? null, genders: targeting.genders ?? null, geoLocations: targeting.geo_locations ?? null }, destination: raw.destination_type ?? null }; }) };
    }
    if (name === 'getCreativeHistory')
        return (await loadCreatives(scope)).map(c => ({ id: c.platform_creative_id, name: c.name, kind: c.creative_type, headline: c.headline, primaryText: c.primary_text?.slice(0, 500), observedAt: c.updated_at }));
    const { data, error } = await db.from('ad_entity_performance_summary').select('entity_id,spend,impressions,clicks,leads,messages,calls,first_day,last_day,history_status,synced_at').eq('ad_account_id', account.id).eq('entity_level', 'ad').order('spend', { ascending: false }).limit(20);
    if (error)
        throw new AssistantError('Creative performance is unavailable.', 503);
    const { data: ads, error: adsError } = await db.from('ad_entities').select('id,external_id,creative_external_id,name,objective').eq('business_id', businessId).eq('ad_account_id', account.id).eq('entity_level', 'ad').in('id', (data ?? []).map(d => d.entity_id));
    if (adsError)
        throw new AssistantError('Creative identity is unavailable.', 503);
    return { currency: account.currency_code, scope: '20 highest-spend saved ads; historical windows may differ. Compare only matching objectives, dates and result types. Creative quality or concepts cannot be proven from delivery totals.', ads: (data ?? []).map(row => ({ ...row, ad: ads?.find(a => a.id === row.entity_id) ?? null })) };
}
async function previousCampaigns({ db, businessId, account }: AssistantAccess) {
    const { data, error } = await db.from('ad_entities').select('external_id,name,objective,raw,updated_at').eq('business_id', businessId).eq('ad_account_id', account.id).eq('entity_level', 'campaign').order('updated_at', { ascending: false }).limit(50);
    if (error)
        throw new AssistantError('Campaign history is unavailable.', 503);
    return data ?? [];
}
