/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const catalogHost = process.env.CATALOG_PROXY_TARGET ?? 'http://localhost:8081';
    const orderHost = process.env.ORDER_PROXY_TARGET ?? 'http://localhost:8082';
    return [
      {
        source: '/api/v1/catalog/:path*',
        destination: `${catalogHost}/api/v1/catalog/:path*`
      },
      {
        source: '/api/v1/inventory/:path*',
        destination: `${catalogHost}/api/v1/inventory/:path*`
      },
      {
        source: '/api/v1/admin/stores/:path*',
        destination: `${catalogHost}/api/v1/admin/stores/:path*`
      },
      {
        source: '/api/v1/admin/picker/:path*',
        destination: `${orderHost}/api/v1/admin/picker/:path*`
      }
    ];
  }
};

module.exports = nextConfig;
