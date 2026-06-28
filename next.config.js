/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Proxy routes forward bodies to EC2 (catalog, inventory, images up to 5MB)
    middlewareClientMaxBodySize: '6mb'
  }
  // API proxying is handled by src/app/api/v1/**/[[...path]]/route.ts handlers.
  // Vercel rewrites to external URLs break POST/PUT bodies (403); route handlers do not.
};

module.exports = nextConfig;
