"use server";

import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/server/supabase/server";

/**
 * Resolves the current authenticated user's id from the server session.
 *
 * @returns The authenticated user's Supabase id.
 * @throws Never returns on unauthenticated access; redirects to `/login` instead.
 */
export async function requireUserId(): Promise<string> {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
        console.log("User not authenticated, redirecting to login.");
        redirect("/login");
    }
    return data.user.id;
}
