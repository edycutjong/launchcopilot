import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serve the self-contained pitch deck (public/pitch/index.html) at a clean /pitch URL.
  async rewrites() {
    return [{ source: "/pitch", destination: "/pitch/index.html" }];
  },
};

export default nextConfig;
