import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite loads its WASM and data files from its own package folder at runtime; don't bundle it.
  serverExternalPackages: ["@electric-sql/pglite"],
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
