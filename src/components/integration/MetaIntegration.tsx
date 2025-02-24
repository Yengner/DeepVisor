'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/utils/supabase/clients/browser';

const FacebookBusinessIntegration = () => { // Change to Meta Business Integration
  const [error, setError] = useState('');

  const handleLogin = () => {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const redirectUri = process.env.NEXT_PUBLIC_FACEBOOK_REDIRECT_URI;
    const configId = process.env.NEXT_PUBLIC_FACEBOOK_CONFIG_ID;

    try {
      const loginUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&config_id=${configId}&response_type=code&override_default_response_type=true`;

      // Redirect to Facebook OAuth login
      window.location.href = loginUrl; // Navigate directly to the login URL
    } catch {
      setError('An error occurred during login.');
    }
  };

  return (
    <div className="flex flex-col items-center ">
      <button
        onClick={handleLogin}
        className="text-[#4fa798] hover:text-[#34a08c]"
      >
        Integrate Facebook Business
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
};

interface MetaIntegrationProps {
  platformName: string;
  userId: string;
  isIntegrated: boolean;
}

const MetaIntegration: React.FC<MetaIntegrationProps> = ({ platformName, userId, isIntegrated, }) => {
  const supabase = createClient();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleUnintegrate = async () => { // Put function into a separate file
    setStatus('loading');

    try {
      const { error } = await supabase
        .from('platform_integrations')
        .delete()
        .eq('platform_name', platformName)
        .eq('user_id', userId);

      if (error) {
        console.error(`Failed to unintegrate ${platformName}:`, error);
        setStatus('error');
        alert(`Failed to unintegrate ${platformName}: ${error.message}`);
        return;
      }

      setStatus('success');
      alert(`${platformName} has been successfully unInstalled.`);
      window.location.reload(); // Refresh page to reflect changes
    } catch (err) {
      console.error(`Unexpected error unintegrating ${platformName}:`, err);
      setStatus('error');
      alert(`Unexpected error unintegrating ${platformName}.`);
    }
  };

  return (
    <div className="flex flex-col items-center">
      {isIntegrated ? (
        <div className="text-center">
          <p className="text-emerald-600 font-medium">
            {platformName.charAt(0).toUpperCase() + platformName.slice(1)} is already integrated!
          </p>
          <button
            onClick={handleUnintegrate}
            disabled={status === 'loading'}
            className={`text-red-500 hover:text-red-700 focus:ring-red-300  ${status === 'loading' ? 'opacity-50 cursor-not-allowed' : ''
              }`}
          >
            {status === 'loading' ? 'Unintegrating...' : 'Uninstall'}
          </button>
        </div>
      ) : (
        <FacebookBusinessIntegration />
      )}
    </div>
  );
};

export default MetaIntegration;