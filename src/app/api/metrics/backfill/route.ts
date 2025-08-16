// app/api/sync/meta/route.ts (example path)
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const META_BASE = "https://graph.facebook.com/v23.0";

function sbAdmin() {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
    });
}

// --- helpers --------------------------------------------------------------

function chunk<T>(arr: T[], size = 1000): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function pickAction(actions: any[] | undefined, type: string): number {
    if (!actions) return 0;
    const a = actions.find((x) => x.action_type === type);
    return a ? Number(a.value || 0) : 0;
}

// DIMs
async function metaListCampaigns(adAccountExternalId: string, accessToken: string) {
    const results: any[] = [];
    let url = `${META_BASE}/${adAccountExternalId}/campaigns?fields=id,name,status,objective,created_time,updated_time&limit=200&access_token=${accessToken}`;
    while (url) {
        const r = await fetch(url);
        if (!r.ok) throw new Error(await r.text());
        const j = await r.json();
        results.push(...(j.data ?? []));
        url = j.paging?.next ?? null;
    }
    console.log(results)
    return results;
}

async function metaListAdsets(adAccountExternalId: string, accessToken: string) {
    const results: any[] = [];
    let url = `${META_BASE}/${adAccountExternalId}/adsets?fields=id,name,status,optimization_goal,campaign_id,created_time,updated_time&limit=200&access_token=${accessToken}`;
    while (url) {
        const r = await fetch(url);
        if (!r.ok) throw new Error(await r.text());
        const j = await r.json();
        results.push(...(j.data ?? []));
        url = j.paging?.next ?? null;
    }
    return results;
}

async function metaListAds(adAccountExternalId: string, accessToken: string) {
    const results: any[] = [];
    let url = `${META_BASE}/${adAccountExternalId}/ads?fields=id,name,status,adset_id,campaign_id,created_time,updated_time,creative&limit=200&access_token=${accessToken}`;
    while (url) {
        const r = await fetch(url);
        if (!r.ok) throw new Error(await r.text());
        const j = await r.json();
        results.push(...(j.data ?? []));
        url = j.paging?.next ?? null;
    }
    return results;
}

/**
 * Pull daily insights for the account at a given level (campaign|adset|ad).
 * We add account_currency + ids explicitly and page by 30-day windows.
 */
async function metaInsightsDaily(
    adAccountExternalId: string,
    level: "campaign" | "adset" | "ad",
    accessToken: string,
    since: string, // YYYY-MM-DD
    until: string  // YYYY-MM-DD
) {
    const FIELDS = [
        "date_start",
        "date_stop",
        "account_currency",
        "campaign_id",
        "adset_id",
        "ad_id",
        "impressions",
        "clicks",
        "spend",
        "reach",
        "actions",
        "objective"
    ].join(",");

    const WINDOW_DAYS = 30;
    const res: any[] = [];

    const sinceDate = new Date(since);
    const untilDate = new Date(until);

    for (
        let start = new Date(sinceDate);
        start <= untilDate;
        start.setDate(start.getDate() + WINDOW_DAYS)
    ) {
        const end = new Date(
            Math.min(
                new Date(start).setDate(start.getDate() + WINDOW_DAYS - 1),
                untilDate.getTime()
            )
        );

        const time_range = `{"since":"${start.toISOString().slice(0, 10)}","until":"${end
            .toISOString()
            .slice(0, 10)}"}`;

        const base =
            `${META_BASE}/${adAccountExternalId}/insights` +
            `?level=${level}&time_increment=1&time_range=${encodeURIComponent(time_range)}` +
            `&fields=${encodeURIComponent(FIELDS)}` +
            `&limit=5000&access_token=${accessToken}`;

        let url: string | null = base;
        while (url) {
            const r = await fetch(url);
            if (!r.ok) throw new Error(await r.text());
            const j = await r.json();
            res.push(...(j.data ?? []));
            url = j.paging?.next ?? null;
        }
    }

    return res;
}

// --- route ------------------------------------------------------------------
type Body = {
    userId: string;                 // ideally derive from session instead of trusting the client
    adAccountId?: string;           // internal UUID from ad_accounts.id  <-- preferred
    fullBackfillDays?: number;
    vendor?: "meta" | "google" | "tiktok"; // optional filter, defaults to "meta"
};

export async function POST(req: NextRequest) {
    console.log("🚀 Starting metrics backfill process");

    const { userId, adAccountId, fullBackfillDays = 120, vendor = "meta" } = await req.json() as Body;
    console.log("📥 Request params:", { userId, adAccountId, fullBackfillDays, vendor });

    if (!userId) {
        console.error("❌ Missing userId in request");
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const sb = sbAdmin();
    console.log("✅ Supabase admin client initialized");

    // Build a filtered query
    let q = sb
        .from("ad_accounts")
        .select(`
        id,
        external_account_id,
        vendor,
        timezone,
        platform_integrations ( access_token )
      `)
        .eq("user_id", userId)
        .eq("vendor", vendor);

    if (adAccountId) {
        console.log("🎯 Filtering by specific adAccountId:", adAccountId);
        q = q.eq("id", adAccountId);
    }

    console.log("🔍 Querying ad accounts from database...");
    const { data: adAccounts, error: accErr } = await q;

    if (accErr) {
        console.error("❌ Database error fetching ad accounts:", accErr);
        return NextResponse.json({ error: accErr.message }, { status: 500 });
    }

    console.log("📊 Found ad accounts:", adAccounts?.length || 0);
    if (adAccounts?.length) {
        console.log("📋 Ad accounts details:", adAccounts.map(acc => ({
            id: acc.id,
            external_id: acc.external_account_id,
            vendor: acc.vendor,
            has_token: !!acc.platform_integrations[0]?.access_token
        })));
    }

    if (!adAccounts?.length) {
        console.warn("⚠️ No matching ad accounts found");
        return NextResponse.json({
            ok: true,
            message: "No matching ad account found for this user.",
            filter: { userId, adAccountId, vendor }
        });
    }

    const summary: any[] = [];

    for (const acct of adAccounts) {
        console.log(`\n🏢 Processing account: ${acct.external_account_id} (${acct.vendor})`);

        if (acct.vendor !== "meta") {
            console.log("⏭️ Skipping non-meta account");
            summary.push({ external_account_id: acct.external_account_id, vendor: acct.vendor, skipped: true });
            continue;
        }

        const accessToken = acct.platform_integrations?.access_token;
        if (!accessToken) {
            console.error("❌ Missing access token for account:", acct.external_account_id);
            summary.push({ external_account_id: acct.external_account_id, error: "Missing access token" });
            continue;
        }
        console.log("🔑 Access token found, length:", accessToken.length);

        try {
            console.log("📡 Fetching DIMs (campaigns, adsets, ads)...");
            const [campaigns, adsets, ads] = await Promise.all([
                metaListCampaigns(acct.external_account_id, accessToken),
                metaListAdsets(acct.external_account_id, accessToken),
                metaListAds(acct.external_account_id, accessToken),
            ]);

            console.log("📈 DIMs fetched:", {
                campaigns: campaigns.length,
                adsets: adsets.length,
                ads: ads.length
            });

            // Campaign dims upsert
            if (campaigns.length) {
                console.log("💾 Upserting campaign dims...");
                for (const batch of chunk(campaigns, 1000)) {
                    console.log(`  📦 Processing campaign batch: ${batch.length} items`);
                    const { error } = await sb.from("campaign_dims").upsert(
                        batch.map((c: any) => ({
                            vendor: "meta",
                            ad_account_id: acct.id,
                            external_id: c.id,
                            name: c.name,
                            objective: c.objective,
                            status: c.status,
                            created_time: c.created_time ? new Date(c.created_time).toISOString() : null,
                            updated_time: c.updated_time ? new Date(c.updated_time).toISOString() : null,
                            raw: c,
                        })),
                        { onConflict: "vendor ,external_id" }
                    );
                    if (error) {
                        console.error("❌ Campaign dims upsert error:", error);
                        throw error;
                    }
                }
                console.log("✅ Campaign dims upserted successfully");
            }

            // Adset dims upsert
            if (adsets.length) {
                console.log("💾 Upserting adset dims...");
                for (const batch of chunk(adsets, 1000)) {
                    console.log(`  📦 Processing adset batch: ${batch.length} items`);
                    const { error } = await sb.from("adset_dims").upsert(
                        batch.map((s: any) => ({
                            vendor: "meta",
                            ad_account_id: acct.id,
                            external_id: s.id,
                            campaign_external_id: s.campaign_id,
                            name: s.name,
                            optimization_goal: s.optimization_goal,
                            status: s.status,
                            created_time: s.created_time ? new Date(s.created_time).toISOString() : null,
                            updated_time: s.updated_time ? new Date(s.updated_time).toISOString() : null,
                            raw: s,
                        })),
                        { onConflict: "vendor ,external_id" }
                    );
                    if (error) {
                        console.error("❌ Adset dims upsert error:", error);
                        throw error;
                    }
                }
                console.log("✅ Adset dims upserted successfully");
            }

            // Ad dims upsert
            if (ads.length) {
                console.log("💾 Upserting ad dims...");
                for (const batch of chunk(ads, 1000)) {
                    console.log(`  📦 Processing ad batch: ${batch.length} items`);
                    const { error } = await sb.from("ad_dims").upsert(
                        batch.map((a: any) => ({
                            vendor: "meta",
                            ad_account_id: acct.id,
                            external_id: a.id,
                            adset_external_id: a.adset_id,
                            name: a.name,
                            status: a.status,
                            creative_id: a.creative?.id ?? null,
                            created_time: a.created_time ? new Date(a.created_time).toISOString() : null,
                            updated_time: a.updated_time ? new Date(a.updated_time).toISOString() : null,
                            raw: a,
                        })),
                        { onConflict: "vendor ,external_id" }
                    );
                    if (error) {
                        console.error("❌ Ad dims upsert error:", error);
                        throw error;
                    }
                }
                console.log("✅ Ad dims upserted successfully");
            }

            // Calculate backfill window
            const until = new Date();
            const since = new Date();
            since.setDate(until.getDate() - Number(fullBackfillDays));
            const SINCE = since.toISOString().slice(0, 10);
            const UNTIL = until.toISOString().slice(0, 10);

            console.log("📅 Backfill window:", { since: SINCE, until: UNTIL, days: fullBackfillDays });

            // Fetch daily insights
            console.log("📊 Fetching daily insights...");
            const [campDaily, setDaily, adDaily] = await Promise.all([
                metaInsightsDaily(acct.external_account_id, "campaign", accessToken, SINCE, UNTIL),
                metaInsightsDaily(acct.external_account_id, "adset", accessToken, SINCE, UNTIL),
                metaInsightsDaily(acct.external_account_id, "ad", accessToken, SINCE, UNTIL),
            ]);

            console.log("📈 Daily insights fetched:", {
                campaign_days: campDaily.length,
                adset_days: setDaily.length,
                ad_days: adDaily.length
            });

            // Upsert campaign performance
            if (campDaily.length) {
                console.log("💾 Upserting campaign performance data...");
                for (const batch of chunk(campDaily, 1000)) {
                    console.log(`  📦 Processing campaign performance batch: ${batch.length} items`);
                    const rows = batch.map((r: any) => ({
                        vendor: "meta",
                        ad_account_id: acct.id,
                        entity_external_id: r.campaign_id,
                        day: r.date_start,
                        spend: Number(r.spend || 0),
                        impressions: Number(r.impressions || 0),
                        clicks: Number(r.clicks || 0),
                        leads: pickAction(r.actions, "onsite_conversion.lead_grouped"),
                        messages: pickAction(r.actions, "onsite_conversion.total_messaging_connection"),
                        calls: pickAction(r.actions, "onsite_conversion.phone_call"),
                        inline_link_clicks: pickAction(r.actions, "link_click"),
                        reach: Number(r.reach || 0),
                        currency_code: r.account_currency || null,
                        objective: r.objective || null,
                        status: null,
                        source: "api",
                    }));
                    const { error } = await sb
                        .from("campaigns_performance_daily")
                        .upsert(rows, { onConflict: "vendor,ad_account_id,entity_external_id,day" });
                    if (error) {
                        console.error("❌ Campaign performance upsert error:", error);
                        throw error;
                    }
                }
                console.log("✅ Campaign performance data upserted successfully");
            }

            // Upsert adset performance
            if (setDaily.length) {
                console.log("💾 Upserting adset performance data...");
                for (const batch of chunk(setDaily, 1000)) {
                    console.log(`  📦 Processing adset performance batch: ${batch.length} items`);
                    const rows = batch.map((r: any) => ({
                        vendor: "meta",
                        ad_account_id: acct.id,
                        entity_external_id: r.adset_id,
                        campaign_external_id: r.campaign_id,
                        day: r.date_start,
                        spend: Number(r.spend || 0),
                        impressions: Number(r.impressions || 0),
                        clicks: Number(r.clicks || 0),
                        leads: pickAction(r.actions, "onsite_conversion.lead_grouped"),
                        messages: pickAction(r.actions, "onsite_conversion.total_messaging_connection"),
                        calls: pickAction(r.actions, "onsite_conversion.phone_call"),
                        inline_link_clicks: pickAction(r.actions, "link_click"),
                        reach: Number(r.reach || 0),
                        currency_code: r.account_currency || null,
                        objective: r.objective || null,
                        status: null,
                        source: "api",
                    }));
                    const { error } = await sb
                        .from("adsets_performance_daily")
                        .upsert(rows, { onConflict: "vendor,ad_account_id,entity_external_id,day" });
                    if (error) {
                        console.error("❌ Adset performance upsert error:", error);
                        throw error;
                    }
                }
                console.log("✅ Adset performance data upserted successfully");
            }

            // Upsert ad performance
            if (adDaily.length) {
                console.log("💾 Upserting ad performance data...");
                for (const batch of chunk(adDaily, 1000)) {
                    console.log(`  📦 Processing ad performance batch: ${batch.length} items`);
                    const rows = batch.map((r: any) => ({
                        vendor: "meta",
                        ad_account_id: acct.id,
                        entity_external_id: r.ad_id,
                        adset_external_id: r.adset_id,
                        campaign_external_id: r.campaign_id,
                        day: r.date_start,
                        spend: Number(r.spend || 0),
                        impressions: Number(r.impressions || 0),
                        clicks: Number(r.clicks || 0),
                        leads: pickAction(r.actions, "onsite_conversion.lead_grouped"),
                        messages: pickAction(r.actions, "onsite_conversion.total_messaging_connection"),
                        calls: pickAction(r.actions, "onsite_conversion.phone_call"),
                        inline_link_clicks: pickAction(r.actions, "link_click"),
                        reach: Number(r.reach || 0),
                        currency_code: r.account_currency || null,
                        objective: r.objective || null,
                        status: null,
                        source: "api",
                    }));
                    const { error } = await sb
                        .from("ads_performance_daily")
                        .upsert(rows, { onConflict: "vendor,ad_account_id,entity_external_id,day" });
                    if (error) {
                        console.error("❌ Ad performance upsert error:", error);
                        throw error;
                    }
                }
                console.log("✅ Ad performance data upserted successfully");
            }

            // Update last synced timestamp
            console.log("🕒 Updating last_synced timestamp...");
            await sb.from("ad_accounts").update({ last_synced: new Date().toISOString() }).eq("id", acct.id);

            const accountSummary = {
                external_account_id: acct.external_account_id,
                vendor: "meta",
                campaigns_dims: campaigns.length,
                adsets_dims: adsets.length,
                ads_dims: ads.length,
                campaign_days: campDaily.length,
                adset_days: setDaily.length,
                ad_days: adDaily.length,
                window: { since: SINCE, until: UNTIL },
            };

            console.log("✅ Account processing completed:", accountSummary);
            summary.push(accountSummary);

        } catch (e: any) {
            console.error("❌ Error processing account:", acct.external_account_id, e?.message || e);
            console.error("Stack trace:", e?.stack);
            summary.push({ external_account_id: acct.external_account_id, error: e?.message || "meta_sync_failed" });
        }
    }

    console.log("🎉 Metrics backfill process completed");
    console.log("📋 Final summary:", summary);
    return NextResponse.json({ ok: true, summary });
}
