"use server";

import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/server/supabase/server";

export async function requireBusinessContextOrRedirect(userId: string) {
    const supabase = await createSupabaseClient();

    const { data: membership, error: mErr } = await supabase
        .from("business_memberships")
        .select("business_id, role")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

    if (mErr) redirect("/login");

    // No business yet => send to onboarding create-business flow
    if (!membership?.business_id) redirect("/onboarding");

    const { data: business, error: bErr } = await supabase
        .from("business_profiles")
        .select("id, onboarding_completed, onboarding_step")
        .eq("id", membership.business_id)
        .single();

    if (bErr || !business) redirect("/onboarding");

    if (!business.onboarding_completed) {
        redirect(`/onboarding?step=${business.onboarding_step ?? 0}`);
    }

    return {
        businessId: business.id,
        role: membership.role,
        onboarding: business,
    };
}
