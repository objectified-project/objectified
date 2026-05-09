import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ['objectified-importer'],
  reactCompiler: true,
  // Enable standalone output for Docker
  output: 'standalone',
};

export default nextConfig;
