import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingExcludes: {
    "/*": [
      "./web-data/**/*",
      "./dist-electron/**/*",
      "./.playwright-cli/**/*",
      "./playwright-report/**/*",
      "./test-results/**/*",
    ],
  },
};

export default nextConfig;
