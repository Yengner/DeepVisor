'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseClient } from '../utils/supabase/clients/server';

interface CreateCampaignPayload {
  user_id: string;
  name: string;
  objective: string;
  budget: number;
  start_date: string;
  end_date: string;
  platform: string;
  type: 'Manual' | 'AI Auto' | 'Semi-Auto';
}

export async function createCampaign(payload: CreateCampaignPayload) {
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase.from('campaigns').insert({
    ...payload,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select('id').single();

  if (error) throw new Error(error.message);

  // Optional: refresh campaigns table if SSR
  revalidatePath('/campaigns');

  return data.id;
}
