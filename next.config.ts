import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Semua halaman aplikasi dibaca per pengguna dari database, jadi dibiarkan dinamis.
  // Browser tetap meminta /favicon.ico; arahkan ke ikon SVG.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon.svg" }];
  },
  serverExternalPackages: ["@electric-sql/pglite", "pg", "bullmq", "ioredis"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
