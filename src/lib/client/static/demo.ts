import { createClient } from "../supabase/browser";

export async function demoLogin() {
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
        email: "test@gmail.com", 
        password: "Test123$", 
    });

    if (error) {
        throw new Error(`Demo login failed: ${error.message}`);
    }
    return { success: true }
};

