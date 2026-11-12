/**
 * ROUTRACK — Configuración de Producción para Next.js en Vercel (TASK-028)
 * Archivo: web-admin/next.config.mjs
 * Runtime: Next.js 14+ (App Router)
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // Optimización de producción y compatibilidad con Vercel Free Tier ($0 USD)
  eslint: {
    // La verificación estricta de tipos se ejecuta con tsc --noEmit en CI
    ignoreDuringBuilds: true,
  },
  typescript: {
    // La verificación estricta de tipos se ejecuta con tsc --noEmit en CI
    ignoreBuildErrors: false,
  },

  // Cabeceras HTTP de Seguridad Estricta (docs/SECURITY.md)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), browsing-topics=()",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
      {
        // Caché inmutable para activos estáticos en CDN global de Vercel
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

