import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async redirects() {
    return [
      {
        source: "/boss-exact/BOSS Assessment.html",
        destination: "/boss-exact/boss-assessment.html",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
