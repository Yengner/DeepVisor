import 'server-only';
import { fetchMetaCollection, fetchMetaObject } from '@/lib/server/sync/meta/client';
import {
  mergeWhatsAppCandidates, normalizeWhatsAppNumber, whatsAppNumbersFromAdSets,
  type PortfolioNumber, type WhatsAppAdsCheck, type WhatsAppCandidate,
} from '@/lib/shared/whatsapp/setup';

/** A portfolio with more WhatsApp accounts than this is probably not one business's own. */
const MAX_PORTFOLIO_ACCOUNTS = 10;

export interface DetectDeps {
  fetchCollection: typeof fetchMetaCollection;
  fetchObject: typeof fetchMetaObject;
}

export interface DetectInput {
  accessToken: string;
  /** The selected ad account's Meta id. Never taken from the browser. */
  adAccountExternalId: string;
  /** Raw ad sets from the last sync, for when Meta can't be read now. */
  loadSavedAdSets: () => Promise<unknown[]>;
  /** False for a borrowed login: only this ad account's own ads may be read. */
  includePortfolio?: boolean;
}

/** Only the portfolio that owns this ad account, so another business's numbers are never offered. */
async function portfolioNumbers(deps: DetectDeps, accessToken: string, accountId: string): Promise<PortfolioNumber[]> {
  try {
    const account = await deps.fetchObject<{ business?: { id?: string } }>({
      path: accountId, accessToken, params: { fields: 'business{id}' },
    });
    if (!account.business?.id) return [];
    const wabas = await deps.fetchCollection<{ id?: string }>({
      path: `${account.business.id}/owned_whatsapp_business_accounts`, accessToken, params: { fields: 'id', limit: 50 },
    });
    if (wabas.length > MAX_PORTFOLIO_ACCOUNTS) return [];
    const lists = await Promise.all(wabas.filter(waba => waba.id).map(waba =>
      deps.fetchCollection<{ display_phone_number?: string; verified_name?: string; is_on_biz_app?: boolean }>({
        path: `${waba.id}/phone_numbers`, accessToken,
        params: { fields: 'display_phone_number,verified_name,is_on_biz_app', limit: 50 },
      }).catch(() => [])));
    return lists.flat().flatMap(row => {
      const number = normalizeWhatsAppNumber(row.display_phone_number);
      return number ? [{ number, name: row.verified_name ?? null, onPhoneApp: row.is_on_biz_app ?? null }] : [];
    });
  } catch {
    // Many logins can't read the portfolio. The ads check stands on its own.
    return [];
  }
}

export async function detectWhatsAppNumbers(
  input: DetectInput,
  deps: DetectDeps = { fetchCollection: fetchMetaCollection, fetchObject: fetchMetaObject },
): Promise<{ candidates: WhatsAppCandidate[]; adsCheck: WhatsAppAdsCheck }> {
  const accountId = `act_${input.adAccountExternalId.replace(/^act_/, '')}`;
  const readAds = async (): Promise<{ adSets: unknown[]; adsCheck: WhatsAppAdsCheck }> => {
    try {
      const adSets = await deps.fetchCollection<unknown>({
        path: `${accountId}/adsets`, accessToken: input.accessToken,
        params: { fields: 'promoted_object,effective_status', limit: 200 },
      });
      return { adSets, adsCheck: 'live' };
    } catch {
      const adSets = await input.loadSavedAdSets().catch(() => []);
      return { adSets, adsCheck: adSets.length > 0 ? 'saved' : 'unavailable' };
    }
  };
  const [ads, portfolio] = await Promise.all([
    readAds(), input.includePortfolio === false ? [] : portfolioNumbers(deps, input.accessToken, accountId),
  ]);
  return { candidates: mergeWhatsAppCandidates(whatsAppNumbersFromAdSets(ads.adSets), portfolio), adsCheck: ads.adsCheck };
}
