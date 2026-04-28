import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Google Places API 사진 URL
      { protocol: "https", hostname: "maps.googleapis.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "streetviewpixels-pa.googleapis.com" },
      // Cloudflare R2 퍼블릭 버킷 — 프로덕션 이미지 업로드 저장소
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "*.pub.cloudflare.com" },
      // Pexels CDN — 도시 대표 이미지
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
};

export default nextConfig;
