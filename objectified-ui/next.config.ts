import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Enable standalone output for Docker
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: "/ade/dashboard/repositories/:id/issues",
        destination: "/ade/dashboard/repositories/:id?tab=issues",
      },
    ];
  },
};

export default nextConfig;
