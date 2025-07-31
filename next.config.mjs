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
  webpack: (config) => {
    // Resolve ESM packages correctly
    config.experiments = { ...config.experiments, topLevelAwait: true }; // Enable ESM experiments
    return config;
  },
  // Add transpilePackages to handle ESM modules
  experimental: {
    esmExternals: 'loose', // Loosen restrictions for ESM imports
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  output: 'standalone', // Ensures the app is built as a standalone Node.js server
};

export default nextConfig;
