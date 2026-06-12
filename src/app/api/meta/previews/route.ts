import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/server/actions/common/accessToken';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createServerClient } from '@/lib/server/supabase/server';
import { fetchMetaObject } from '@/lib/server/sync/meta/client';
import { ErrorCode, fail, ok } from '@/lib/shared';

export const dynamic = 'force-dynamic';

type MetaPreviewResponse = {
  data?: Array<{
    body?: string;
  }>;
};

const DEFAULT_PREVIEW_TYPES = ['DESKTOP_FEED_STANDARD'];
const MAX_PREVIEW_TYPES = 5;

function parsePreviewTypes(value: string | null): string[] {
  const requestedTypes = (value || DEFAULT_PREVIEW_TYPES.join(','))
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => /^[A-Z0-9_]+$/.test(item))
    .slice(0, MAX_PREVIEW_TYPES);

  return requestedTypes.length > 0 ? requestedTypes : DEFAULT_PREVIEW_TYPES;
}

export async function GET(request: NextRequest) {
  try {
    const platformId = request.nextUrl.searchParams.get('platformId');
    const creativeId = request.nextUrl.searchParams.get('creativeId');
    const previewTypes = parsePreviewTypes(request.nextUrl.searchParams.get('previewTypes'));

    if (!platformId || !creativeId || creativeId.startsWith('post:')) {
      return NextResponse.json(
        fail('Missing preview context', ErrorCode.VALIDATION_ERROR, {
          userMessage: 'Choose a synced Meta ad creative before opening a preview.',
        }),
        { status: 400 }
      );
    }

    const { businessId } = await getRequiredAppContext();
    const supabase = await createServerClient();
    const { data: creativeRows, error: creativeError } = await supabase
      .from('ad_creatives')
      .select('id, business_id, platform_integration_id, platform_creative_id')
      .eq('business_id', businessId)
      .eq('platform_creative_id', creativeId)
      .limit(1);

    if (creativeError) {
      throw creativeError;
    }

    const creative = creativeRows?.[0] ?? null;

    if (!creative || (creative.platform_integration_id && creative.platform_integration_id !== platformId)) {
      return NextResponse.json(
        fail('Creative not found', ErrorCode.NOT_FOUND, {
          userMessage: 'We could not find this creative in the selected Meta account.',
        }),
        { status: 404 }
      );
    }

    const accessToken = await getAccessToken(platformId);
    const previews: Record<string, { body: string }> = {};

    await Promise.all(
      previewTypes.map(async (previewType) => {
        const response = await fetchMetaObject<MetaPreviewResponse>({
          path: `${creativeId}/previews`,
          accessToken,
          params: {
            ad_format: previewType,
          },
        });
        const body = response.data?.[0]?.body;

        if (body) {
          previews[previewType] = { body };
        }
      })
    );

    return NextResponse.json(ok({ previews }));
  } catch (error) {
    return NextResponse.json(
      fail(
        error instanceof Error ? error.message : 'Failed to load Meta creative preview',
        ErrorCode.EXTERNAL_API_ERROR,
        {
          userMessage: 'We could not load the Meta preview for this creative right now.',
        }
      ),
      { status: 500 }
    );
  }
}
