/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Enforces React's strict mode for better debugging
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'example.com',
      },
    ],
  },
  typescript: { ignoreBuildErrors: true },

  output: 'standalone', // Ensures the app is built as a standalone Node.js server
};

export default nextConfig;
