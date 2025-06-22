import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';
import React from 'react';
import { getLoggedInUser } from '@/lib/actions/user.actions';
import IntegrationClient from '@/components/integration/IntegrationClient';

const IntegrationPage = async () => {
  const supabase = await createSupabaseClient();
  
  const loggedIn = await getLoggedInUser();
  const userId = loggedIn.id;

  const { data: platforms, error: platformError } = await supabase
    .from('platform')
    .select('id, platform_name, description, full_description, strengths, weaknesses, image_url');

  if (platformError) {
    console.error('Error fetching platforms:', platformError.message);
    return <div>Failed to load platforms</div>;
  }

  // Fetch platform integrations for the user
  const { data: platformIntegrations, error: integrationError } = await supabase
    .from('platform_integrations')
    .select('platform_name, is_integrated')
    .eq('user_id', userId);

  if (integrationError) {
    console.error('Error fetching platform integrations:', integrationError.message);
    return <div>Failed to load integrations</div>;
  }

  // Map platforms and merge integration status
  const platformsWithIntegration = platforms.map((platform) => ({
    ...platform,
    isIntegrated: platformIntegrations?.find((integration) => integration.platform_name === platform.id)?.is_integrated || false,
  }));

  return <IntegrationClient platforms={platformsWithIntegration} userId={userId} />;
};

export default IntegrationPage;
