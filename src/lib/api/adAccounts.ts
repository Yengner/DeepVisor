'use server';

import { createSupabaseClient } from "../utils/supabase/clients/server";

const supabase = createSupabaseClient();
const userId = '6d9a0842-3887-43a0-8909-16589f8eae2a'; // Replace with actual logic to get the user ID

export const fetchAdAccounts = async (platform: string): Promise<{
    adAccounts: Array<{ ad_account_id: string }>;
    hasAdAccounts: boolean;
  }> => {
    const { data, error } = await supabase
      .from('ad_accounts')
      .select('ad_account_id')
      .eq('user_id', userId)
      .eq('platform', platform);
  
    if (error) {
      console.error('Error fetching ad accounts:', error.message);
      throw new Error('Error fetching ad accounts');
    }
  
    return {
      adAccounts: data || [],
      hasAdAccounts: !!data?.length,
    };
  };