import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Multipart uploads include a small amount of form-data overhead.
      // The API still enforces the actual 5MB evidence-file limit.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
