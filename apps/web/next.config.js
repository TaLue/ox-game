/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' is for Docker only — remove when deploying to Vercel
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' } : {}),
  transpilePackages: ['@ox/shared'],
  async rewrites() {
    const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000';
    return [
      { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
    ];
  },
};

module.exports = nextConfig;
