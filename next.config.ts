import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  /**
   * The VIABUS marketing site is served verbatim from `public/` — the same
   * static HTML, CSS and vanilla-JS that was built and reviewed as a standalone
   * site, so it stays pixel-identical and needs no React port.
   *
   * `beforeFiles` runs ahead of the App Router, so `/` reaches the static home
   * page even though the dashboard routes live in the same app. The pages link
   * to each other as `quote.html`, `routes.html` and so on, which resolve
   * directly out of `public/` — these extensionless aliases are a courtesy for
   * anything typed or linked from outside.
   */
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/index.html" },
        {
          source: "/:page(about|fleet|routes|corporate|experience|quote)",
          destination: "/:page.html",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
