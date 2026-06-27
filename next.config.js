/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const catalogHost = process.env.CATALOG_PROXY_TARGET ?? 'http://localhost:8081';
    return [
      {
        source: '/api/v1/catalog/:path*',
        destination: `${catalogHost}/api/v1/catalog/:path*`
      },
      {
        source: '/api/v1/inventory/:path*',
        destination: `${catalogHost}/api/v1/inventory/:path*`
      }
    ];
  }
};

module.exports = nextConfig;
