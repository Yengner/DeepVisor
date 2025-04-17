import { google } from 'googleapis';

export const getGoogleAuthUrl = () => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`
  );

  const scopes = [
    'https://www.googleapis.com/auth/webmasters.readonly', // Google Search Console
    'https://www.googleapis.com/auth/userinfo.email', // Example: Get user's email
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
  });
};
