import { createHash } from 'node:crypto';

export const FIXTURE_TAG = 'deepvisor-beta-v1';
export const PROJECT_REF = 'gkdyyjqepzayjdpvqnja';
export const AS_OF = '2026-10-20';
export const NOW = `${AS_OF}T16:00:00.000Z`;
export const uid = (key: string) => {
  const h = createHash('sha256').update(`${FIXTURE_TAG}:${key}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
export const dayAt = (offset: number) => new Date(Date.parse(`${AS_OF}T12:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
export const businesses = ['a', 'b'].map(key => ({
  key, id: uid(`${key}:business`), organizationId: uid(`${key}:organization`),
  accountId: uid(`${key}:account`), integrationId: uid(`${key}:integration`),
  email: `deepvisor-beta-${key}@example.test`,
  name: key === 'a' ? '[SYNTHETIC] Aurora Salon & Aesthetics' : '[SYNTHETIC] Birch Beauty Studio',
}));
export const media = [
  { key: 'hair-color', title: 'COLOR YOUR DAY', subtitle: 'Salon hair color', width: 1200, height: 800, color: '#704257' },
  { key: 'facial', title: 'A FRESH START', subtitle: 'Facial treatment', width: 800, height: 1200, color: '#316c69' },
  { key: 'brows', title: 'BEAUTIFUL BROWS', subtitle: 'Eyebrow service', width: 1000, height: 1000, color: '#65528a' },
  { key: 'seasonal', title: 'AUTUMN GLOW', subtitle: 'Seasonal special · Video poster', width: 1200, height: 675, color: '#a6512f' },
  { key: 'brand', title: 'MAKE TIME FOR YOU', subtitle: 'Aurora Salon', width: 1000, height: 1000, color: '#32475b' },
  { key: 'thumbnail', title: 'A', subtitle: '', width: 64, height: 64, color: '#704257' },
];
// Native SVG test assets; no remote Meta media, photographs or customer content.
export function mediaSvg(m: typeof media[number]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${m.width}" height="${m.height}" viewBox="0 0 1000 1000"><rect width="1000" height="1000" fill="${m.color}"/><circle cx="770" cy="280" r="230" fill="#ffffff" opacity=".12"/><path d="M140 660 Q500 90 860 660" stroke="#f3cfa0" stroke-width="35" fill="none"/><text x="70" y="710" fill="white" font-family="sans-serif" font-size="62" font-weight="bold">${m.title}</text><text x="70" y="790" fill="white" font-family="sans-serif" font-size="36">${m.subtitle}</text><text x="70" y="925" fill="white" font-family="sans-serif" font-size="28">SYNTHETIC TEST AD — NOT AN OFFER</text></svg>`;
}
export type Metric = { spend: number; impressions: number; reach: number; clicks: number; inline_link_clicks: number; leads: number; messages: number; calls: number };
const additive = ['spend', 'impressions', 'clicks', 'inline_link_clicks', 'leads', 'messages', 'calls'] as const;
export const zero = (): Metric => ({ spend: 0, impressions: 0, reach: 0, clicks: 0, inline_link_clicks: 0, leads: 0, messages: 0, calls: 0 });
export function totals(rows: Metric[]): Metric {
  const t = zero();
  for (const r of rows) {
    for (const k of additive) t[k] += r[k];
    // A fixed, nested synthetic audience cohort is reused every day. This is a
    // known union for these fixtures only, never a rule for real Meta data.
    t.reach = Math.max(t.reach, r.reach);
  }
  t.spend = Math.round(t.spend * 100) / 100;
  return t;
}
export function rates(m: Metric) {
  const results = m.leads + m.messages + m.calls;
  return { ctr: m.impressions ? m.clicks / m.impressions * 100 : null,
    cpc: m.clicks ? m.spend / m.clicks : null, cpm: m.impressions ? m.spend / m.impressions * 1000 : null,
    frequency: m.reach ? m.impressions / m.reach : null, cost_per_result: results ? m.spend / results : null };
}
function split(m: Metric, index: number, count: number): Metric {
  return Object.fromEntries(Object.entries(m).map(([k, value]) => {
    const v = k === 'spend' ? Math.round(value * 100) : value;
    return [k, (Math.floor(v / count) + (index < v % count ? 1 : 0)) / (k === 'spend' ? 100 : 1)];
  })) as Metric;
}
export type Entity = { id: string; business_id: string; ad_account_id: string; platform_id: string; platform_integration_id: string; entity_level: string; external_id: string; name: string; status: string; objective: string; raw: Record<string, unknown>; campaign_id?: string; adset_id?: string; parent_id?: string; parent_external_id?: string; creative_external_id?: string; created_time: string };
export type Daily = Metric & { entity_id: string; ad_account_id: string; entity_level: string; day: string; currency_code: string; source: string };
export function generateFixture(platformId: string, mediaBase: string) {
  const entities: Entity[] = [], daily: Daily[] = [];
  const creatives: Record<string, unknown>[] = [], summaries: Record<string, unknown>[] = [], hourly: Record<string, unknown>[] = [], audience: Record<string, unknown>[] = [];
  for (const b of businesses) {
    const campaignCount = b.key === 'a' ? 3 : 1, setCount = b.key === 'a' ? 5 : 2;
    const makeEntity = (level: string, key: string, name: string, status: string): Entity => ({
      id: uid(`${b.key}:${key}`), business_id: b.id, ad_account_id: b.accountId,
      platform_id: platformId, platform_integration_id: b.integrationId, entity_level: level,
      external_id: `${FIXTURE_TAG}-${b.key}-${key}`, name: `[SYNTHETIC] ${name}`, status,
      objective: 'OUTCOME_LEADS', raw: { synthetic_fixture: FIXTURE_TAG, effective_status: status },
      created_time: `${dayAt(-89)}T12:00:00Z`,
    });
    const campaigns = Array.from({ length: campaignCount }, (_, i) => makeEntity('campaign', `campaign-${i}`, ['Hair color success', 'Facial cost increase', 'Seasonal exploration'][i], i === 0 ? 'ACTIVE' : 'PAUSED'));
    entities.push(...campaigns);
    for (let i = 0; i < setCount; i++) {
      const campaign = campaigns[Math.min(i === 0 ? 0 : i <= 2 ? 1 : 2, campaignCount - 1)];
      const set = makeEntity('adset', `adset-${i}`, ['Hair color · performing', 'Facial · deteriorating', 'Brows · zero results', 'Seasonal · sparse history', 'Brand · insufficient data'][i], i === 0 ? 'ACTIVE' : 'PAUSED');
      Object.assign(set, { campaign_id: campaign.id, parent_id: campaign.id, parent_external_id: campaign.external_id });
      entities.push(set);
      const ads = Array.from({ length: b.key === 'a' && i % 2 ? 3 : 2 }, (_, j) => {
        const ad = makeEntity('ad', `ad-${i}-${j}`, `Service ${i + 1} · variation ${j + 1}`, set.status);
        Object.assign(ad, { campaign_id: campaign.id, adset_id: set.id, parent_id: set.id, parent_external_id: set.external_id, creative_external_id: `${FIXTURE_TAG}-${b.key}-creative-${i}-${j}` });
        const missing = i === 4 && j === 0, small = i === 4 && j === 1;
        const asset = media[small ? 5 : i];
        const url = `${mediaBase}/${asset.key}.svg`;
        creatives.push({ id: uid(`${b.key}:creative-${i}-${j}`), business_id: b.id, ad_account_id: b.accountId, platform_integration_id: b.integrationId,
          platform_creative_id: ad.creative_external_id, name: ad.name, creative_type: i === 3 ? 'video' : 'image',
          headline: asset.title, primary_text: 'Synthetic beta fixture. Not a live offer.', cta_type: 'LEARN_MORE',
          image_url: missing || small || i === 3 ? null : url, thumbnail_url: missing ? null : small ? url : `${mediaBase}/thumbnail.svg`,
          video_id: i === 3 ? `${FIXTURE_TAG}-poster-only` : null,
          object_story_spec: missing ? {} : { photo_data: { url, width: asset.width, height: asset.height } },
          raw: { synthetic_fixture: FIXTURE_TAG, ...(i === 3 ? { deepvisor_video_poster: { uri: url, width: asset.width, height: asset.height } } : {}) } });
        return ad;
      });
      entities.push(...ads);
      for (let offset = -89; offset <= 0; offset++) {
        if (i === 4 && ![-2, -1].includes(offset)) continue;
        if (i === 3 && offset % 11 === 0 && offset !== 0) continue;
        let m = zero();
        if (offset < 0 && !(i > 0 && i < 4 && offset >= -2)) {
          const spend = i === 0 ? (offset >= -7 ? 60 : 42) : i === 1 ? (offset >= -14 ? 72 : 36) : i === 2 ? 24 : i === 3 ? 18 : 2;
          const results = i === 0 ? (offset >= -7 ? 12 : 6) : i === 1 ? (offset >= -7 ? 2 : offset >= -14 ? 4 : 6) : i === 2 ? 0 : i === 3 ? 3 : 0;
          m = { spend, impressions: spend * 100, reach: spend * 60, clicks: spend * 3, inline_link_clicks: spend * 2, leads: Math.ceil(results / 2), messages: Math.floor(results / 2), calls: 0 };
        }
        const row = { ...m, entity_id: set.id, ad_account_id: b.accountId, entity_level: 'adset', day: dayAt(offset), currency_code: 'USD', source: FIXTURE_TAG };
        daily.push(row);
        ads.forEach((ad, j) => daily.push({ ...row, ...split(m, j, ads.length), entity_id: ad.id, entity_level: 'ad' }));
        if (offset >= -6 && i !== 4) {
          for (let hour = 0; hour < 24; hour++) {
            const hm = split(m, hour, 24);
            hourly.push({ ...row, ...hm, hour_of_day: hour, day_of_week: new Date(`${row.day}T12:00:00Z`).getUTCDay(),
              ctr: rates(hm).ctr ?? 0, cpc: rates(hm).cpc ?? 0, cpm: rates(hm).cpm ?? 0 });
          }
        }
      }
      const from = i % 2 === 0 ? -7 : -60, to = i % 2 === 0 ? -1 : -31;
      const observed = totals(daily.filter(r => r.entity_id === set.id && r.day >= dayAt(from) && r.day <= dayAt(to)));
      const dimensions: [string, string, string[], string?, string[]?][] = [
        ['age', 'age', ['25-34', '35-44']], ['gender', 'gender', ['female', 'male']],
        ['age_gender', 'age', ['25-34', '35-44'], 'gender', ['female', 'male']],
        ['country', 'country', ['US', 'CA']], ['region', 'region', ['New York', 'New Jersey']],
        ['publisher_platform', 'publisher_platform', ['facebook', 'instagram']],
        ['platform_position', 'platform_position', ['feed', 'story']],
        ['impression_device', 'impression_device', ['iphone', 'android_smartphone']],
      ];
      for (const [kind, key, values, key2, values2] of dimensions) values.forEach((value, j) => {
        const m = split(observed, j, values.length);
        const delivery = ['publisher_platform', 'platform_position', 'impression_device'].includes(kind);
        audience.push({ ...m, ...(delivery ? { leads: 0, messages: 0, calls: 0 } : {}),
          entity_id: set.id, ad_account_id: b.accountId, entity_level: 'adset', breakdown_type: kind,
          dimension_1_key: key, dimension_1_value: value, dimension_2_key: key2 ?? '', dimension_2_value: values2?.[j] ?? '',
          ...(kind === 'publisher_platform' ? { publisher_platform: value } : {}),
          ...(kind === 'platform_position' ? { platform_position: value, publisher_platform: j ? 'instagram' : 'facebook' } : {}),
          ...(kind === 'impression_device' ? { impression_device: value } : {}),
          currency_code: 'USD', source: `${FIXTURE_TAG}:summary`, first_day: dayAt(from), last_day: dayAt(to), synced_at: NOW });
      });
    }
    for (const campaign of campaigns) {
      const children = new Set(entities.filter(e => e.entity_level === 'adset' && e.campaign_id === campaign.id).map(e => e.id));
      for (let offset = -89; offset <= 0; offset++) {
        const rows = daily.filter(r => children.has(r.entity_id) && r.day === dayAt(offset));
        if (rows.length) daily.push({ ...totals(rows), entity_id: campaign.id, ad_account_id: b.accountId, entity_level: 'campaign', day: dayAt(offset), currency_code: 'USD', source: FIXTURE_TAG });
      }
    }
  }
  for (const e of entities) {
    const rows = daily.filter(r => r.entity_id === e.id), sum = totals(rows);
    summaries.push({ ...sum, ...rates(sum), entity_id: e.id, ad_account_id: e.ad_account_id, entity_level: e.entity_level,
      first_day: rows[0]?.day, last_day: rows.at(-1)?.day, summary_source: `${FIXTURE_TAG}:known_cohort`, history_status: 'complete', synced_at: NOW });
  }
  return { entities, creatives, daily, summaries, hourly, audience };
}
