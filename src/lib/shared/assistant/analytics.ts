import { z } from 'zod';
export const analyticsBlockSchema = z.object({
  kind: z.enum(['kpis', 'comparison', 'trend', 'ranking', 'creative']).optional(),
  currency: z.string().nullable().optional(), status: z.string().optional(),
  baselineLabel: z.string().optional(), trendLabel: z.string().optional(),
  title: z.string().max(120), scope: z.string().max(300), note: z.string().max(1000),
  items: z.array(z.object({ key: z.string().optional(), baseline: z.string().optional(), label: z.string().max(300), value: z.string().max(150), change: z.object({ value: z.number().finite(), unit: z.string(), direction: z.enum(['favorable', 'unfavorable', 'neutral']) }).nullable() })).max(6),
  trend: z.array(z.object({ day: z.string(), value: z.number().finite().nullable(), results: z.number().finite().nullable().optional() })).max(90),
}).strict();
export type AnalyticsBlock = z.infer<typeof analyticsBlockSchema>;
