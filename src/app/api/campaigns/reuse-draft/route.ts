import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import {
  CampaignReuseDraftError,
  createCampaignReuseDraft,
} from '@/lib/server/campaigns/reuse';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { createServerClient } from '@/lib/server/supabase/server';
import { ErrorCode, fail, ok } from '@/lib/shared';
import type { CreateCampaignReuseDraftRequest } from '@/lib/shared/types/campaignDrafts';

export const runtime = 'nodejs';

const externalId = z.string().trim().min(1).max(255);
const reuseDraftRequestSchema = z
  .object({
    sourceType: z.enum(['campaign', 'adset', 'ad']),
    sourceCampaignId: externalId,
    sourceAdSetId: externalId.optional(),
    sourceAdId: externalId.optional(),
    budgetType: z.enum(['daily', 'lifetime']),
    budgetAmount: z.number().finite().positive(),
    startAt: z.string().trim().min(1).max(64),
    endAt: z.string().trim().min(1).max(64),
    creativeMode: z.enum(['reuse', 'fresh']),
    idempotencyKey: z.string().uuid(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.sourceType === 'adset' || value.sourceType === 'ad') && !value.sourceAdSetId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceAdSetId'],
        message: 'The source ad-set ID is required for this source type.',
      });
    }
    if (value.sourceType === 'ad' && !value.sourceAdId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceAdId'],
        message: 'The source ad ID is required for an ad source.',
      });
    }
    if (value.sourceAdId && !value.sourceAdSetId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceAdSetId'],
        message: 'The parent ad-set ID is required when an ad ID is provided.',
      });
    }
    if (value.creativeMode === 'reuse' && !value.sourceAdId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['creativeMode'],
        message: 'Exact creative reuse requires a selected source ad.',
      });
    }
  });

function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.join('.') || 'request';
    fieldErrors[field] ??= issue.message;
  }
  return fieldErrors;
}

export async function POST(request: NextRequest) {
  try {
    const sessionClient = await createServerClient();
    const { data: authData, error: authError } = await sessionClient.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json(
        fail('Authentication required.', ErrorCode.UNAUTHORIZED, {
          userMessage: 'Sign in before creating a campaign draft.',
        }),
        { status: 401 }
      );
    }

    const { user, businessId, onboarding } = await getRequiredAppContext(false);
    if (!onboarding.onboarding_completed) {
      return NextResponse.json(
        fail('Business setup is incomplete.', ErrorCode.CONFLICT, {
          userMessage: 'Finish business setup before creating a campaign draft.',
        }),
        { status: 409 }
      );
    }
    const parsed = reuseDraftRequestSchema.safeParse(
      await request.json().catch(() => null)
    );

    if (!parsed.success) {
      return NextResponse.json(
        fail('Invalid Run again request.', ErrorCode.VALIDATION_ERROR, {
          userMessage: 'Check the source, budget, and schedule before trying again.',
          details: { fieldErrors: zodFieldErrors(parsed.error) },
        }),
        { status: 400 }
      );
    }

    const { selectedPlatformId, selectedAdAccountId } = await resolveCurrentSelection(businessId);
    if (!selectedPlatformId || !selectedAdAccountId) {
      return NextResponse.json(
        fail('No active Meta selection.', ErrorCode.VALIDATION_ERROR, {
          userMessage: 'Select a connected Meta ad account before creating this draft.',
        }),
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const [{ data: integration, error: integrationError }, { data: adAccount, error: adAccountError }] =
      await Promise.all([
        supabase
          .from('platform_integrations')
          .select('id, business_id, platform_id, status, platforms ( key )')
          .eq('id', selectedPlatformId)
          .eq('business_id', businessId)
          .maybeSingle(),
        supabase
          .from('ad_accounts')
          .select('id, business_id, platform_id, currency_code, timezone, status')
          .eq('id', selectedAdAccountId)
          .eq('business_id', businessId)
          .maybeSingle(),
      ]);

    if (integrationError) throw integrationError;
    if (adAccountError) throw adAccountError;

    const platform = Array.isArray(integration?.platforms)
      ? integration.platforms[0]
      : integration?.platforms;
    if (!integration || integration.status !== 'connected' || platform?.key !== 'meta') {
      return NextResponse.json(
        fail('Selected integration is not connected Meta.', ErrorCode.INTEGRATION_ERROR, {
          userMessage: 'Reconnect Meta or select another connected account.',
        }),
        { status: 409 }
      );
    }
    if (!adAccount || adAccount.platform_id !== integration.platform_id) {
      return NextResponse.json(
        fail('Selected ad account does not belong to the active integration.', ErrorCode.CONFLICT, {
          userMessage: 'Select the Meta ad account again before creating this draft.',
        }),
        { status: 409 }
      );
    }

    const result = await createCampaignReuseDraft(supabase, {
      businessId,
      platformIntegrationId: integration.id,
      adAccountId: adAccount.id,
      userId: user.id,
      currencyCode: adAccount.currency_code,
      timezone: adAccount.timezone,
      request: parsed.data as CreateCampaignReuseDraftRequest,
    });

    return NextResponse.json(ok(result), { status: result.replayed ? 200 : 201 });
  } catch (error) {
    if (error instanceof CampaignReuseDraftError) {
      return NextResponse.json(
        fail(error.message, error.code, {
          userMessage: error.message,
          details: error.fieldErrors ? { fieldErrors: error.fieldErrors } : undefined,
        }),
        { status: error.status }
      );
    }

    console.error('Failed to create Run again campaign draft:', error);
    return NextResponse.json(
      fail('Failed to create Run again campaign draft.', ErrorCode.UNKNOWN_ERROR, {
        userMessage: 'We could not create this review draft right now.',
      }),
      { status: 500 }
    );
  }
}
