import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Google Places API 사진 URL 허용 (next/image 최적화 사용 시 필요)
    remotePatterns: [
      { protocol: "https", hostname: "maps.googleapis.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "streetviewpixels-pa.googleapis.com" },
    ],
  },
};

export default nextConfig;
