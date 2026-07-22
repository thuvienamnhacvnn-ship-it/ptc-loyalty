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
};

export default nextConfig;
