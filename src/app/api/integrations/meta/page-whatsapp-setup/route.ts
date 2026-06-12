import { NextRequest, NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { getMetaPages } from '@/lib/server/actions/meta/pages/actions';
import { createAdminClient } from '@/lib/server/supabase/admin';
import type { WhatsAppNumberSource, WhatsAppSetupResult } from '@/lib/shared/types/whatsappSetup';
import { ErrorCode, fail, ok } from '@/lib/shared';

const WHATSAPP_NUMBER_SOURCES = new Set<WhatsAppNumberSource>([
  'page_phone_confirmed',
  'manual',
  'skipped',
  'not_available',
]);

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function normalizePhoneForStorage(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/[\s\-()]/g, '');
  return normalized || null;
}

function isValidInternationalPhone(value: string): boolean {
  return /^\+?[0-9]{7,20}$/.test(value);
}

function parseWhatsAppNumberSource(value: unknown): WhatsAppNumberSource | null {
  return typeof value === 'string' && WHATSAPP_NUMBER_SOURCES.has(value as WhatsAppNumberSource)
    ? (value as WhatsAppNumberSource)
    : null;
}

export async function POST(request: NextRequest) {
  try {
    const { businessId } = await getRequiredAppContext();
    const body = await request.json().catch(() => ({}));
    const integrationId = cleanString(body.integrationId);
    const externalAccountId = cleanString(body.externalAccountId);
    const pageId = cleanString(body.pageId);
    const requestedSource = parseWhatsAppNumberSource(body.whatsappNumberSource);
    const manualNumber = normalizePhoneForStorage(cleanString(body.whatsappNumber));

    if (!integrationId || !pageId || !requestedSource) {
      return NextResponse.json(
        fail('Missing WhatsApp setup payload', ErrorCode.VALIDATION_ERROR, {
          userMessage: 'Choose a Facebook Page and WhatsApp setup option to continue.',
        }),
        { status: 400 }
      );
    }

    const pagesResponse = await getMetaPages({
      platformId: integrationId,
      adAccountId: externalAccountId,
    });

    if (!pagesResponse.success) {
      return NextResponse.json(pagesResponse, { status: 502 });
    }

    const selectedPage = pagesResponse.data.find((page) => page.page_id === pageId) ?? null;
    if (!selectedPage) {
      return NextResponse.json(
        fail('Selected Page was not returned by Meta', ErrorCode.VALIDATION_ERROR, {
          userMessage: 'Choose a Facebook Page returned by Meta.',
        }),
        { status: 400 }
      );
    }

    const pagePhone = normalizePhoneForStorage(selectedPage.phone);
    let whatsappNumber: string | null = null;
    let whatsappNumberSource: WhatsAppNumberSource = requestedSource;

    if (requestedSource === 'page_phone_confirmed') {
      if (!pagePhone) {
        return NextResponse.json(
          fail('Page phone is not available', ErrorCode.VALIDATION_ERROR, {
            userMessage: 'Enter a WhatsApp number or skip WhatsApp for now.',
          }),
          { status: 400 }
        );
      }

      whatsappNumber = pagePhone;
    }

    if (requestedSource === 'manual') {
      if (!manualNumber || !isValidInternationalPhone(manualNumber)) {
        return NextResponse.json(
          fail('Invalid WhatsApp number', ErrorCode.VALIDATION_ERROR, {
            userMessage: 'Enter a valid WhatsApp number with country code.',
          }),
          { status: 400 }
        );
      }

      whatsappNumber = manualNumber;
    }

    if (requestedSource === 'skipped') {
      whatsappNumber = null;
      whatsappNumberSource = pagePhone ? 'skipped' : 'not_available';
    }

    if (requestedSource === 'not_available') {
      whatsappNumber = null;
      whatsappNumberSource = pagePhone ? 'skipped' : 'not_available';
    }

    const setupResult: WhatsAppSetupResult = {
      pagePhone,
      whatsappNumber,
      whatsappNumberSource,
      whatsappSetupCompleted: true,
    };

    // TODO: Later, replace or enhance this with automatic WhatsApp Business Account/WABA detection. V2 should fetch WABA phone numbers and show them in a dropdown, plus provide a button to connect/create a WABA.
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('business_profiles')
      .update({
        meta_page_id: selectedPage.page_id,
        meta_page_name: selectedPage.name,
        meta_page_instagram_account_id: selectedPage.instagram_account_id ?? null,
        meta_page_instagram_account_name: selectedPage.instagram_account_name ?? null,
        meta_page_instagram_account_username: selectedPage.instagram_account_username ?? null,
        meta_page_instagram_account_picture_url: selectedPage.instagram_account_picture_url ?? null,
        meta_page_picture_url: selectedPage.picture_url ?? null,
        page_phone: setupResult.pagePhone,
        whatsapp_number: setupResult.whatsappNumber,
        whatsapp_number_source: setupResult.whatsappNumberSource,
        whatsapp_setup_completed: setupResult.whatsappSetupCompleted,
        updated_at: new Date().toISOString(),
      })
      .eq('id', businessId);

    if (error) {
      throw error;
    }

    return NextResponse.json(
      ok({
        selectedPage: {
          id: selectedPage.id,
          pageId: selectedPage.page_id,
          name: selectedPage.name,
          phone: selectedPage.phone,
          instagramAccountId: selectedPage.instagram_account_id ?? null,
          instagramAccountName: selectedPage.instagram_account_name ?? null,
          instagramAccountUsername: selectedPage.instagram_account_username ?? null,
          instagramAccountPictureUrl: selectedPage.instagram_account_picture_url ?? null,
          pictureUrl: selectedPage.picture_url ?? null,
        },
        whatsappSetup: setupResult,
      })
    );
  } catch (error) {
    return NextResponse.json(
      fail(
        error instanceof Error ? error.message : 'Failed to save WhatsApp setup',
        ErrorCode.UNKNOWN_ERROR,
        {
          userMessage: 'We could not save your WhatsApp setup right now.',
        }
      ),
      { status: 500 }
    );
  }
}
