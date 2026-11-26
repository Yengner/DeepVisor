'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { requireUserId } from '@/lib/server/actions/user/session';
import { ACTIVE_BUSINESS_COOKIE, listUserBusinesses } from '@/lib/server/actions/business/context';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { BUSINESS_CATEGORY_OPTIONS } from '@/lib/shared/onboarding/businessProfileOptions';
import { accountNumber, feeCents, SERVICE_LEVELS } from '@/lib/shared/clients/model';
import { clientsDb, getOperator } from './operator';

/** `error` is a message key under `clients.error`. */
export type ClientActionResult = { ok: true; businessId?: string } | { ok: false; error: 'notAllowed' | 'name' | 'fee' | 'date' | 'taken' | 'account' | 'failed' };

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

async function setActiveBusiness(businessId: string) {
  const store = await cookies();
  store.set(ACTIVE_BUSINESS_COOKIE, businessId, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  // Connection and ad-account choices belong to the business being left.
  store.delete('platform_integration_id');
  store.delete('ad_account_row_id');
}

/** Works for any business the user is a member of, and no other. */
export async function switchBusiness(businessId: unknown): Promise<ClientActionResult> {
  const userId = await requireUserId();
  const target = (await listUserBusinesses(userId)).find((business) => business.businessId === businessId);
  if (!target) return { ok: false, error: 'notAllowed' };
  await setActiveBusiness(target.businessId);
  return { ok: true, businessId: target.businessId };
}

export async function createClientBusiness(input: { name?: unknown; location?: unknown; industry?: unknown }): Promise<ClientActionResult> {
  const userId = await requireUserId();
  if (!(await getOperator(userId))) return { ok: false, error: 'notAllowed' };
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 120) return { ok: false, error: 'name' };
  const industry = BUSINESS_CATEGORY_OPTIONS.find((option) => option.value === input.industry)?.value ?? null;
  const { data, error } = await clientsDb().rpc('create_client_business', {
    p_user: userId, p_name: name, p_location: text(input.location, 200) || null, p_industry: industry, p_language: await getLocale(),
  });
  if (error || typeof data !== 'string') {
    console.error('Client business could not be created:', error);
    return { ok: false, error: 'failed' };
  }
  revalidatePath('/', 'layout');
  return { ok: true, businessId: data };
}

/** The operator acting on one of their own active client businesses, or null. */
async function managedBusiness(businessId: unknown): Promise<string | null> {
  const userId = await requireUserId();
  const operator = await getOperator(userId);
  if (!operator || typeof businessId !== 'string') return null;
  if (!(await listUserBusinesses(userId)).some((business) => business.businessId === businessId && business.role === 'owner')) return null;
  const { data, error } = await clientsDb().from('client_engagements').select('business_id')
    .eq('business_id', businessId).eq('operator_organization_id', operator.organizationId).is('ended_at', null).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? businessId : null;
}

export async function saveEngagement(businessId: unknown, input: {
  serviceLevel?: unknown; fee?: unknown; paidThrough?: unknown; contentAddon?: unknown; note?: unknown;
}): Promise<ClientActionResult> {
  const business = await managedBusiness(businessId);
  if (!business) return { ok: false, error: 'notAllowed' };
  const fee = feeCents(typeof input.fee === 'string' ? input.fee : '');
  if (fee === null) return { ok: false, error: 'fee' };
  const paidThrough = text(input.paidThrough, 10);
  if (paidThrough && !(/^\d{4}-\d{2}-\d{2}$/.test(paidThrough) && !Number.isNaN(Date.parse(paidThrough)))) return { ok: false, error: 'date' };
  const { error } = await clientsDb().from('client_engagements').update({
    service_level: SERVICE_LEVELS.find((level) => level === input.serviceLevel) ?? 'managed',
    monthly_fee_cents: fee === '' ? null : fee,
    paid_through: paidThrough || null,
    content_addon: input.contentAddon === true,
    note: text(input.note, 2000) || null,
    updated_at: new Date().toISOString(),
  }).eq('business_id', business);
  if (error) return { ok: false, error: 'failed' };
  revalidatePath('/clients', 'layout');
  return { ok: true, businessId: business };
}

/**
 * Records which of the operator's ad accounts belongs to a client. A label for navigation and the
 * Ads Manager link: it copies no token, starts no sync and changes nothing in Meta.
 */
export async function linkClientAccount(businessId: unknown, externalAccountId: unknown): Promise<ClientActionResult> {
  const business = await managedBusiness(businessId);
  if (!business) return { ok: false, error: 'notAllowed' };
  const operator = (await getOperator(await requireUserId()))!;
  const number = accountNumber(typeof externalAccountId === 'string' ? externalAccountId : null);
  if (!number) return { ok: false, error: 'account' };
  // Only an account already saved on the operator's own connection can be linked.
  const saved = await createAdminClient().from('ad_accounts').select('name').eq('business_id', operator.businessId)
    .in('external_account_id', [number, `act_${number}`]).limit(1).maybeSingle();
  if (saved.error) return { ok: false, error: 'failed' };
  if (!saved.data) return { ok: false, error: 'account' };
  const { error } = await clientsDb().from('client_ad_accounts').insert({ external_account_id: number, business_id: business, name: saved.data.name });
  if (error) return { ok: false, error: error.code === '23505' ? 'taken' : 'failed' };
  revalidatePath('/clients', 'layout');
  return { ok: true, businessId: business };
}

export async function unlinkClientAccount(businessId: unknown, externalAccountId: unknown): Promise<ClientActionResult> {
  const business = await managedBusiness(businessId);
  const number = accountNumber(typeof externalAccountId === 'string' ? externalAccountId : null);
  if (!business || !number) return { ok: false, error: 'notAllowed' };
  const { error } = await clientsDb().from('client_ad_accounts').delete().eq('business_id', business).eq('external_account_id', number);
  if (error) return { ok: false, error: 'failed' };
  revalidatePath('/clients', 'layout');
  return { ok: true, businessId: business };
}
