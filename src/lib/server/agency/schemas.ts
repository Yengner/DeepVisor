import { z } from 'zod';

export const BusinessAgencyPlanningScopeSchema = z.enum([
  'business',
  'integration',
  'selected_integrations',
]);

export const RunAgencyAssessmentRequestSchema = z.object({
  scope: BusinessAgencyPlanningScopeSchema.default('business'),
  platformIntegrationId: z.string().min(1).nullable().optional(),
  platformIntegrationIds: z.array(z.string().min(1)).default([]),
});

