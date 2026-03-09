"use server";

import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/server/supabase/server";

export async function requireUserId(): Promise<string> {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
        console.log("User not authenticated, redirecting to login.");
        redirect("/login");
    }
    return data.user.id;
}
