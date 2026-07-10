/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://127.0.0.1:8000/api/:path*' },
      { source: '/docs', destination: 'http://127.0.0.1:8000/docs' },
      { source: '/health', destination: 'http://127.0.0.1:8000/health' },
    ];
  },
};

module.exports = nextConfig;
