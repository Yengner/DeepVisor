"use server";

import { redirect } from "next/navigation";
import { createSupabaseClient } from "../../supabase/server";
import { Database, ok } from "@/lib/shared";
import { fromSupabaseAuthError } from "../../supabase/authError";
import { requireUserId } from "@/lib/server/actions/user/session";

// ===== USER DATA  =====

type UserRow = Database['public']['Tables']['users']['Row'];

async function requireUserRow(userId: string): Promise<UserRow> {
    const supabase = await createSupabaseClient();

    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

    if (error || !data) redirect("/login");
    return data;
}

export async function getLoggedInUserOrRedirect() {
    const userId = await requireUserId();
    return requireUserRow(userId);
}
