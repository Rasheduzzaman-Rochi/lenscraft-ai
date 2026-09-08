import type { NextConfig } from "next";

function supabaseStoragePattern() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!configuredUrl) return [];

  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return [];
    return [{
      protocol: url.protocol === "https:" ? "https" as const : "http" as const,
      hostname: url.hostname,
      port: url.port,
      pathname: "/storage/v1/object/public/lenscraft-media/**",
    }];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    remotePatterns: supabaseStoragePattern(),
  },
};

export default nextConfig;
