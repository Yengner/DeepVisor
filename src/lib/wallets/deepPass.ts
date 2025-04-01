import { createSupabaseClient } from "../utils/supabase/clients/server";

export async function getApplePasses({ userId }: {userId: string}) {
    const supabase = await createSupabaseClient();
    const storage = supabase.storage;

    const filePath = ""
    const { data } = await storage
        .from("passes")
        .eq("userId")
}