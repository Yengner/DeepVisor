import { createClient } from "npm:@supabase/supabase-js@2";

export const queueClient = createClient(
    Deno.env.get("URL")!,
    Deno.env.get("SERVICE_ROLE_KEY")!,
    { db: { schema: "pgmq_public" } }
);