/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  async rewrites() {
    const backend = process.env.BACKEND_URL || "http://127.0.0.1:8010";
    return [
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
      { source: '/docs', destination: `${backend}/docs` },
      { source: '/health', destination: `${backend}/health` },
      { source: '/agents/direct/:path*', destination: 'http://127.0.0.1:8101/:path*' },
      { source: '/agents/seo/:path*', destination: 'http://127.0.0.1:8102/:path*' },
      { source: '/agents/analytics/:path*', destination: 'http://127.0.0.1:8103/:path*' },
      { source: '/agents/crm/:path*', destination: 'http://127.0.0.1:8104/:path*' },
      { source: '/agents/parser/:path*', destination: 'http://127.0.0.1:8105/:path*' },
      { source: '/agents/telegram/:path*', destination: 'http://127.0.0.1:8106/:path*' },
    ];
  },
};

module.exports = nextConfig;
