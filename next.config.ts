import type { NextConfig } from "next";

/**
 * Response headers.
 *
 * Applied here rather than in `proxy.ts` so they reach static assets too, and
 * so a change to session handling can never accidentally drop them.
 */
const BASE_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    // This product never needs any of these, and a compromised dependency
    // asking for them should fail rather than prompt.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    // Only honoured over HTTPS, so it is inert in local development.
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  typedRoutes: false,

  // The version of Next in use is not the world's business.
  poweredByHeader: false,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  async headers() {
    return [
      {
        // The console and the customer's copy of a quote must never be framed:
        // both carry a session or a capability token, and both have buttons
        // worth clickjacking.
        source: "/((?!book).*)",
        headers: [
          ...BASE_HEADERS,
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      {
        // The booking form is deliberately embeddable — Settings hands the
        // operator this URL to put on their own site.
        source: "/book/:path*",
        headers: BASE_HEADERS,
      },
    ];
  },
};

export default nextConfig;
