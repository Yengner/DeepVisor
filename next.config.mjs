/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the explicitly enabled local simulator separate from an ordinary dev server.
  distDir: process.env.NODE_ENV === 'development' &&
    process.env.DEEPVISOR_META_SIMULATION === 'gkdyyjqepzayjdpvqnja'
      ? '.next/beta-phase2'
      : '.next',

  output: 'standalone', 
};

export default nextConfig;
