/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't 308-redirect trailing-slash URLs. Meta's webhook verifier does not
  // follow redirects, so a Callback URL entered as `.../webhook/` must be served
  // directly rather than redirected.
  skipTrailingSlashRedirect: true,
  eslint: {
    // Lint is run explicitly via `npm run lint`; don't block production builds.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // Security headers on every route. NOTE: Permissions-Policy keeps camera=(self)
  // so the QR scanner keeps working; microphone/geolocation are disabled.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
