import { z } from 'zod';

export const BusinessIntelligencePlanningScopeSchema = z.enum([
  'business',
  'integration',
  'selected_integrations',
]);

export const RunIntelligenceAssessmentRequestSchema = z.object({
  scope: BusinessIntelligencePlanningScopeSchema.default('business'),
  platformIntegrationId: z.string().min(1).nullable().optional(),
  platformIntegrationIds: z.array(z.string().min(1)).default([]),
});
