import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build mandiri untuk image Docker (deploy/ + Dockerfile). Tidak memengaruhi `next dev`.
  output: "standalone",
  experimental: {
    // Upload gambar admin (maks 2 MB per file, beberapa file per form).
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
