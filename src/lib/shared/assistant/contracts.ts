import { z } from 'zod';
import type { AnalyticsBlock } from './analytics';
const text = z.string().trim().max(500);
// Nullable means genuinely missing. Model proposals are never user confirmations.
export const assistantPlanSchema = z.object({
    concept: z.string().trim().min(1).max(120).nullable(),
    objective: z.enum(['OUTCOME_LEADS', 'OUTCOME_ENGAGEMENT']).nullable(),
    destination: z.enum(['MESSENGER', 'WHATSAPP', 'ON_AD', 'PHONE_CALL']).nullable(),
    budgetType: z.enum(['daily', 'lifetime']).nullable(),
    budgetAmount: z.number().finite().positive().max(250000).nullable(),
    durationDays: z.number().int().min(1).max(366).nullable(),
    startAt: z.string().datetime({ offset: true }).nullable(),
    location: z.string().trim().min(1).max(120).nullable(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    radius: z.number().positive().max(80).nullable(),
    ageMin: z.number().int().min(18).max(65).nullable(),
    ageMax: z.number().int().min(18).max(65).nullable(),
    genders: z.array(z.enum(['male', 'female'])).max(2),
    creativeId: text.nullable(),
    headline: text.nullable(),
    primaryText: z.string().max(2000).nullable(),
    targetMode: z.enum(['new_campaign', 'existing_campaign', 'existing_adset']),
    campaignId: text.nullable(),
    adSetId: text.nullable(),
}).strict();
export type AssistantPlan = z.infer<typeof assistantPlanSchema>;
export const assistantReplySchema = z.object({
    message: z.string().min(1).max(6000),
    visuals: z.array(z.object({ sourceId: z.string(), kind: z.enum(['kpis', 'comparison', 'trend', 'ranking', 'creative']), metrics: z.array(z.enum(['spend', 'conversion', 'costPerResult', 'ctr'])).max(4) }).strict()).max(2),
    insights: z.array(z.string()).max(3),
    suggestedFollowUps: z.array(z.string().min(1).max(120)).max(2),
    metadata: z.array(z.string()).max(6),
    plan: assistantPlanSchema.nullable(),
    creativeIds: z.array(z.string().max(255)).max(4),
    questions: z.array(z.string().max(300)).max(3),
}).strict();
export type AssistantReply = z.infer<typeof assistantReplySchema>;
export type CreativeCard = {
    id: string;
    name: string;
    image: string | null;
    kind: string | null;
};
export type AssistantMessage = {
    analytics?: AnalyticsBlock[];
    presentation?: { summary?: string; visuals: AnalyticsBlock[]; insights: Array<{ id: string; text: string; tone: 'favorable' | 'unfavorable' | 'neutral' }>; suggestedFollowUps: string[]; metadata: Array<{ id: string; title: string; details: string[] }> };
    creatives?: CreativeCard[];
    role: 'user' | 'assistant';
    text: string;
};
export type AssistantMedia = {
    id: string;
    name: string;
    mime: string;
    path: string;
    saved?: boolean;
};
export type AssistantState = {
    messages: AssistantMessage[];
    plan: AssistantPlan | null;
    creatives: CreativeCard[];
    revision: number;
    savedDraftId: string | null;
    attachments?: AssistantMedia[];
};
export const emptyAssistantState = (): AssistantState => ({ messages: [], plan: null, creatives: [], revision: 0, savedDraftId: null });
export const assistantRequestSchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('message'), question: z.string().trim().min(1).max(3000), context: z.object({ period: z.enum(['today', '7d', '30d']), platform: z.enum(['combined', 'facebook', 'instagram']) }).strict().optional(), revision: z.number().int().nonnegative(), adAccountId: z.string().uuid() }).strict(),
    z.object({ action: z.literal('save'), plan: assistantPlanSchema, revision: z.number().int().nonnegative(), adAccountId: z.string().uuid(), confirmed: z.literal(true) }).strict(),
    z.object({ action: z.literal('clear'), revision: z.number().int().nonnegative(), adAccountId: z.string().uuid() }).strict(),
    z.object({ action: z.literal('modify'), plan: assistantPlanSchema, revision: z.number().int().nonnegative(), adAccountId: z.string().uuid() }).strict(),
]);
