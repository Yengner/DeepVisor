'use client';

import { useState } from 'react';

const FacebookLogin = () => {
  const [error, setError] = useState('');

  const handleLogin = () => {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const redirectUri = process.env.NEXT_PUBLIC_FACEBOOK_REDIRECT_URI;
    const configId = process.env.NEXT_PUBLIC_FACEBOOK_CONFIG_ID;  // Your Facebook Business Login configuration ID

    // Construct the login URL with config_id instead of scope
    const loginUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&config_id=${configId}&response_type=code&override_default_response_type=true`;

    // Redirect to Facebook OAuth login
    window.open(loginUrl, '_blank');
  };

  return (
    <div>
      <button onClick={handleLogin}>Login with Facebook</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default FacebookLogin;
