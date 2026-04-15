import { NextRequest, NextResponse } from 'next/server';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { runBusinessIntelligenceAssessment } from '@/lib/server/intelligence';
import { RunIntelligenceAssessmentRequestSchema } from '@/lib/server/intelligence/schemas';
import { ErrorCode, fail, ok } from '@/lib/shared';

export async function POST(request: NextRequest) {
  try {
    const { businessId } = await getRequiredAppContext();
    const selection = await resolveCurrentSelection(businessId);
    const body = await request.json().catch(() => ({}));
    const parsed = RunIntelligenceAssessmentRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        fail('Invalid assessment request', ErrorCode.VALIDATION_ERROR, {
          userMessage: 'Review the selected integration and try again.',
        }),
        { status: 400 }
      );
    }

    const result = await runBusinessIntelligenceAssessment({
      businessId,
      scope: parsed.data.scope,
      platformIntegrationId: parsed.data.platformIntegrationId ?? null,
      platformIntegrationIds: parsed.data.platformIntegrationIds,
      defaultAdAccountId: selection.selectedAdAccountId,
      defaultPlatformIntegrationId: selection.selectedPlatformId,
    });

    return NextResponse.json(ok(result));
  } catch (error) {
    console.log('Assessment failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to run assessment';
    const status = message.includes('Select and sync') ? 400 : 500;

    return NextResponse.json(
      fail(message, status === 400 ? ErrorCode.VALIDATION_ERROR : ErrorCode.UNKNOWN_ERROR, {
        userMessage: message,
      }),
      { status }
    );
  }
}
