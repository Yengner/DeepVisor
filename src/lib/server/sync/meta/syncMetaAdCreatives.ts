import 'server-only';

import { asRecord, asString, uniqueStrings } from '@/lib/shared';
import type { Database, Json } from '@/lib/shared/types/supabase';
import { upsertCreativeFeatureSnapshots } from '@/lib/server/repositories/ai/upsertCreativeFeatureSnapshots';
import { upsertAdCreatives } from '@/lib/server/repositories/ad_creatives/upsertAdCreatives';
import type { RepositoryClient } from '@/lib/server/repositories/utils';
import { fetchMetaAdCreativeSeeds } from './fetch';

type AdAccountRow = Database['public']['Tables']['ad_accounts']['Row'];
type CampaignDimRow = Database['public']['Tables']['campaign_dims']['Row'];
type AdsetDimRow = Database['public']['Tables']['adset_dims']['Row'];
type AdDimRow = Database['public']['Tables']['ad_dims']['Row'];
type AdCreativeRow = Database['public']['Tables']['ad_creatives']['Row'];

type CreativeAssociation = {
  adIds: Set<string>;
  adsetIds: Set<string>;
  campaignIds: Set<string>;
};

function trimString(value: unknown): string | null {
  const normalized = asString(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function pickSingleValue(values: Set<string>): string | null {
  if (values.size !== 1) {
    return null;
  }

  return values.values().next().value ?? null;
}

function safeHost(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

function safePath(value: string | null): string {
  if (!value) {
    return '';
  }

  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`.toLowerCase();
  } catch {
    return value.toLowerCase();
  }
}

function buildCreativeAssociations(input: {
  ads: AdDimRow[];
  adsetsByExternalId: Map<string, AdsetDimRow>;
  campaignsByExternalId: Map<string, CampaignDimRow>;
}): Map<string, CreativeAssociation> {
  const associations = new Map<string, CreativeAssociation>();

  for (const ad of input.ads) {
    if (!ad.creative_id) {
      continue;
    }

    const scopedCreativeId = `${ad.ad_account_id}::${ad.creative_id}`;
    const existing = associations.get(scopedCreativeId) ?? {
      adIds: new Set<string>(),
      adsetIds: new Set<string>(),
      campaignIds: new Set<string>(),
    };

    existing.adIds.add(ad.id);

    const adset = input.adsetsByExternalId.get(ad.adset_external_id);
    const adsetId = ad.adset_id ?? adset?.id ?? null;
    if (adsetId) {
      existing.adsetIds.add(adsetId);
    }

    const campaign = adset?.campaign_external_id
      ? input.campaignsByExternalId.get(adset.campaign_external_id)
      : null;
    const campaignId = ad.campaign_id ?? adset?.campaign_id ?? campaign?.id ?? null;
    if (campaignId) {
      existing.campaignIds.add(campaignId);
    }

    associations.set(scopedCreativeId, existing);
  }

  return associations;
}

function buildCreativeIdsByAdAccount(ads: AdDimRow[]): Map<string, string[]> {
  const creativeIdsByAdAccount = new Map<string, Set<string>>();

  for (const ad of ads) {
    const creativeId = trimString(ad.creative_id);
    if (!creativeId) {
      continue;
    }

    const existing = creativeIdsByAdAccount.get(ad.ad_account_id) ?? new Set<string>();
    existing.add(creativeId);
    creativeIdsByAdAccount.set(ad.ad_account_id, existing);
  }

  return new Map(
    Array.from(creativeIdsByAdAccount.entries()).map(([adAccountId, creativeIds]) => [
      adAccountId,
      Array.from(creativeIds.values()),
    ])
  );
}

function inferPrimaryFormat(creative: AdCreativeRow): string | null {
  const creativeType = trimString(creative.creative_type)?.toLowerCase() ?? '';
  const objectStorySpec = asRecord(creative.object_story_spec);
  const linkData = asRecord(objectStorySpec.link_data);
  const assetFeedSpec = asRecord(creative.asset_feed_spec);
  const assetImages = Array.isArray(assetFeedSpec.images) ? assetFeedSpec.images.length : 0;
  const assetVideos = Array.isArray(assetFeedSpec.videos) ? assetFeedSpec.videos.length : 0;
  const assetBodies = Array.isArray(assetFeedSpec.bodies) ? assetFeedSpec.bodies.length : 0;
  const hasCarousel =
    Array.isArray(linkData.child_attachments) && linkData.child_attachments.length > 1;
  const hasDynamicAssets = assetImages > 1 || assetVideos > 1 || assetBodies > 1;

  if (hasCarousel || creativeType.includes('carousel')) {
    return 'carousel';
  }

  if (creative.video_id || creativeType.includes('video') || assetVideos > 0) {
    return 'video';
  }

  if (hasDynamicAssets || creativeType.includes('dynamic')) {
    return 'dynamic';
  }

  if (creative.image_url || creative.image_hash || creative.thumbnail_url) {
    return 'image';
  }

  if (creative.link_url) {
    return 'link';
  }

  return trimString(creative.creative_type);
}

function inferOfferType(text: string, ctaType: string | null): string | null {
  const normalizedCta = (ctaType ?? '').toLowerCase();

  if (/\b(save|sale|discount|deal|promo|\d+%\s*off)\b/.test(text)) {
    return 'discount';
  }

  if (/\b(download|guide|ebook|checklist|resource|learn more)\b/.test(text)) {
    return 'lead_magnet';
  }

  if (
    /\b(book|schedule|appointment|consult|demo|estimate|quote)\b/.test(text) ||
    normalizedCta.includes('book') ||
    normalizedCta.includes('quote')
  ) {
    return 'consultation';
  }

  if (
    /\b(shop|buy|order|cart|product)\b/.test(text) ||
    normalizedCta.includes('shop')
  ) {
    return 'product_sale';
  }

  if (
    /\b(message|chat|dm|whatsapp|messenger)\b/.test(text) ||
    normalizedCta.includes('message')
  ) {
    return 'conversation';
  }

  if (
    /\b(sign up|register|apply|join|subscribe)\b/.test(text) ||
    normalizedCta.includes('sign')
  ) {
    return 'signup';
  }

  return null;
}

function inferLandingPageType(input: {
  text: string;
  linkUrl: string | null;
  ctaType: string | null;
}): string | null {
  const normalizedCta = (input.ctaType ?? '').toLowerCase();

  if (normalizedCta.includes('message') || normalizedCta.includes('whatsapp')) {
    return 'messaging';
  }

  if (!input.linkUrl) {
    if (
      normalizedCta.includes('lead') ||
      normalizedCta.includes('sign') ||
      /\b(contact|quote|apply|demo|book)\b/.test(input.text)
    ) {
      return 'instant_form';
    }

    return null;
  }

  const path = safePath(input.linkUrl);

  if (path.includes('calendly') || /\b(book|schedule|appointment|consult)\b/.test(path)) {
    return 'booking';
  }

  if (
    /\b(shop|product|collection|cart|checkout)\b/.test(path) ||
    /\b(shop|buy|order)\b/.test(input.text)
  ) {
    return 'product';
  }

  if (
    /\b(quote|estimate|contact|apply|demo|lead)\b/.test(path) ||
    /\b(quote|estimate|contact|apply|demo)\b/.test(input.text)
  ) {
    return 'lead_form';
  }

  if (
    /\b(blog|article|guide|learn|resource)\b/.test(path) ||
    /\b(guide|ebook|checklist|learn)\b/.test(input.text)
  ) {
    return 'content';
  }

  return 'landing_page';
}

function inferHookStyle(textParts: string[]): string | null {
  const opening = textParts.find((part) => part.length > 0)?.toLowerCase() ?? '';
  const combined = textParts.join(' ').toLowerCase();

  if (!opening) {
    return null;
  }

  if (opening.includes('?') || /^(are|is|what|why|how|can|do|want to)\b/.test(opening)) {
    return 'question';
  }

  if (/^(\$|\d+%|\d+\+?)/.test(opening)) {
    return 'stat';
  }

  if (/\b(testimonial|review|customers? say|client(s)? say|rated)\b/.test(combined)) {
    return 'testimonial';
  }

  if (/\b(limited time|today only|ending soon|last chance|hurry)\b/.test(combined)) {
    return 'urgency';
  }

  if (/^(book|shop|get|learn|discover|save|boost|stop|start)\b/.test(opening)) {
    return 'command';
  }

  if (/\b(save|discount|offer|free)\b/.test(combined)) {
    return 'offer';
  }

  return 'benefit';
}

function deriveCreativeUnderstanding(creative: AdCreativeRow): {
  ctaType: string | null;
  headlineText: string | null;
  bodyText: string | null;
  primaryFormat: string | null;
  offerType: string | null;
  landingPageType: string | null;
  hookStyle: string | null;
  hasPrice: boolean;
  hasDiscount: boolean;
  hasUrgency: boolean;
  hasSocialProof: boolean;
  hasTestimonial: boolean;
  hasBranding: boolean;
  messageAngleTags: string[];
  visualStyleTags: string[];
  featureJson: Json;
} {
  const headlineText = trimString(creative.headline);
  const bodyText = trimString(creative.primary_text) ?? trimString(creative.description);
  const ctaType = trimString(creative.cta_type);
  const textParts = uniqueStrings([
    trimString(creative.name),
    headlineText,
    trimString(creative.primary_text),
    trimString(creative.description),
  ]);
  const text = textParts.join(' ').toLowerCase();
  const primaryFormat = inferPrimaryFormat(creative);
  const offerType = inferOfferType(text, ctaType);
  const landingPageType = inferLandingPageType({
    text,
    linkUrl: trimString(creative.link_url),
    ctaType,
  });
  const hookStyle = inferHookStyle(textParts);
  const hasPrice = /(\$\s?\d|\b\d+(?:\.\d{2})?\s?(usd|dollars?|eur|gbp)\b)/.test(text);
  const hasDiscount = /\b(discount|sale|promo|deal|save\s+\$?\d+|\d+%\s*off)\b/.test(text);
  const hasUrgency = /\b(now|today|limited time|ending soon|last chance|hurry)\b/.test(text);
  const hasSocialProof = /\b(trusted|customers?|reviews?|results?|rated|best[- ]selling)\b/.test(
    text
  );
  const hasTestimonial = /\b(testimonial|review|customers? say|client(s)? say)\b/.test(text);
  const hasBranding = Boolean(
    creative.page_id ||
      creative.instagram_actor_id ||
      creative.object_story_id ||
      /\b(official|our team|our brand)\b/.test(text)
  );

  const messageAngleTags = uniqueStrings([
    hasDiscount ? 'discount' : null,
    hasPrice ? 'price-led' : null,
    hasUrgency ? 'urgency' : null,
    hasSocialProof ? 'social-proof' : null,
    hasTestimonial ? 'testimonial' : null,
    /\b(guide|ebook|checklist|tips|learn)\b/.test(text) ? 'education' : null,
    /\b(struggling|tired of|avoid|fix|problem)\b/.test(text) ? 'pain-point' : null,
    /\b(boost|grow|improve|get|save)\b/.test(text) ? 'benefit-led' : null,
    offerType === 'conversation' ? 'conversation' : null,
    offerType === 'consultation' ? 'service' : null,
    offerType === 'product_sale' ? 'product' : null,
  ]);

  const visualStyleTags = uniqueStrings([
    primaryFormat === 'video' ? 'video' : null,
    primaryFormat === 'carousel' ? 'carousel' : null,
    primaryFormat === 'dynamic' ? 'dynamic-creative' : null,
    primaryFormat === 'image' ? 'static-image' : null,
    hasBranding ? 'branded-identity' : null,
    hasTestimonial ? 'testimonial-style' : null,
    hasDiscount || hasPrice ? 'offer-card' : null,
  ]);

  const objectStorySpec = asRecord(creative.object_story_spec);
  const linkData = asRecord(objectStorySpec.link_data);
  const assetFeedSpec = asRecord(creative.asset_feed_spec);

  return {
    ctaType,
    headlineText,
    bodyText,
    primaryFormat,
    offerType,
    landingPageType,
    hookStyle,
    hasPrice,
    hasDiscount,
    hasUrgency,
    hasSocialProof,
    hasTestimonial,
    hasBranding,
    messageAngleTags,
    visualStyleTags,
    featureJson: {
      creativeType: trimString(creative.creative_type),
      linkHost: safeHost(trimString(creative.link_url)),
      childAttachmentCount: Array.isArray(linkData.child_attachments)
        ? linkData.child_attachments.length
        : 0,
      assetCounts: {
        bodies: Array.isArray(assetFeedSpec.bodies) ? assetFeedSpec.bodies.length : 0,
        titles: Array.isArray(assetFeedSpec.titles) ? assetFeedSpec.titles.length : 0,
        images: Array.isArray(assetFeedSpec.images) ? assetFeedSpec.images.length : 0,
        videos: Array.isArray(assetFeedSpec.videos) ? assetFeedSpec.videos.length : 0,
      },
      inferred: {
        primaryFormat,
        offerType,
        landingPageType,
        hookStyle,
        hasPrice,
        hasDiscount,
        hasUrgency,
        hasSocialProof,
        hasTestimonial,
        hasBranding,
        messageAngleTags,
        visualStyleTags,
      },
    } satisfies Json,
  };
}

export async function syncMetaAdCreatives(input: {
  supabase: RepositoryClient;
  businessId: string;
  platformIntegrationId: string;
  adAccounts: AdAccountRow[];
  ads: AdDimRow[];
  adsetsByExternalId: Map<string, AdsetDimRow>;
  campaignsByExternalId: Map<string, CampaignDimRow>;
  accessToken: string;
  syncedAt: string;
}) {
  const creativeInputs: Parameters<typeof upsertAdCreatives>[1] = [];
  const creativeIdsByAdAccount = buildCreativeIdsByAdAccount(input.ads);

  for (const adAccount of input.adAccounts) {
    const creativeIds = creativeIdsByAdAccount.get(adAccount.id) ?? [];
    if (creativeIds.length === 0) {
      continue;
    }

    let creatives: Awaited<ReturnType<typeof fetchMetaAdCreativeSeeds>> = [];

    try {
      creatives = await fetchMetaAdCreativeSeeds({
        accessToken: input.accessToken,
        adAccountExternalId: adAccount.external_account_id,
        creativeExternalIds: creativeIds,
      });
    } catch (error) {
      console.warn(
        `Skipping creative sync for Meta ad account ${adAccount.external_account_id}:`,
        error
      );
      continue;
    }

    creativeInputs.push(
      ...creatives.map((creative) => ({
        businessId: input.businessId,
        platformIntegrationId: input.platformIntegrationId,
        adAccountId: adAccount.id,
        platformCreativeId: creative.externalId,
        name: creative.name,
        creativeType: creative.creativeType,
        ctaType: creative.ctaType,
        primaryText: creative.primaryText,
        headline: creative.headline,
        description: creative.description,
        linkUrl: creative.linkUrl,
        imageUrl: creative.imageUrl,
        imageHash: creative.imageHash,
        thumbnailUrl: creative.thumbnailUrl,
        videoId: creative.videoId,
        pageId: creative.pageId,
        instagramActorId: creative.instagramActorId,
        objectStoryId: creative.objectStoryId,
        objectStorySpec: creative.objectStorySpec,
        assetFeedSpec: creative.assetFeedSpec,
        raw: creative.raw,
        syncedAt: input.syncedAt,
      }))
    );
  }

  if (creativeInputs.length === 0) {
    return {
      adCreatives: 0,
      creativeFeatureSnapshots: 0,
    };
  }

  const adCreatives = await upsertAdCreatives(input.supabase, creativeInputs);
  const associations = buildCreativeAssociations({
    ads: input.ads,
    adsetsByExternalId: input.adsetsByExternalId,
    campaignsByExternalId: input.campaignsByExternalId,
  });
  const snapshotDate = input.syncedAt.slice(0, 10);

  const creativeFeatureSnapshots = await upsertCreativeFeatureSnapshots(
    input.supabase,
    adCreatives.rows.map((creative) => {
      const understanding = deriveCreativeUnderstanding(creative);
      const association = associations.get(
        `${creative.ad_account_id}::${creative.platform_creative_id}`
      );

      return {
        businessId: input.businessId,
        adAccountId: creative.ad_account_id,
        creativeId: creative.id,
        adId: association ? pickSingleValue(association.adIds) : null,
        adsetId: association ? pickSingleValue(association.adsetIds) : null,
        campaignId: association ? pickSingleValue(association.campaignIds) : null,
        snapshotDate,
        ctaType: understanding.ctaType,
        headlineText: understanding.headlineText,
        bodyText: understanding.bodyText,
        primaryFormat: understanding.primaryFormat,
        offerType: understanding.offerType,
        landingPageType: understanding.landingPageType,
        hookStyle: understanding.hookStyle,
        hasPrice: understanding.hasPrice,
        hasDiscount: understanding.hasDiscount,
        hasUrgency: understanding.hasUrgency,
        hasSocialProof: understanding.hasSocialProof,
        hasTestimonial: understanding.hasTestimonial,
        hasBranding: understanding.hasBranding,
        messageAngleTags: understanding.messageAngleTags,
        visualStyleTags: understanding.visualStyleTags,
        featureJson: understanding.featureJson,
        createdAt: input.syncedAt,
      };
    })
  );

  return {
    adCreatives: adCreatives.count,
    creativeFeatureSnapshots: creativeFeatureSnapshots.count,
  };
}
