"use server";
import { createClient } from "@/lib/utils/supabase/clients/browser";
import { ConnectedAccount } from "./types";



export const updateConnectedAccountsInDatabase = async ({ userId, accounts }: { userId: string; accounts: ConnectedAccount[] }) => {
    try {
        const supabase = createClient();
        if (userId) {
            await supabase
                .from('profiles')
                .update({
                    connected_accounts: accounts,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);
        }
    } catch (error) {
        console.error('Failed to update connected accounts:', error);
    }
};