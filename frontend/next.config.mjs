import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import withBundleAnalyzer from "@next/bundle-analyzer";

const { processEnv } = nextEnv;

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(currentDir, "../.env");

if (fs.existsSync(rootEnvPath)) {
  processEnv(
    [{ path: ".env", contents: fs.readFileSync(rootEnvPath, "utf8") }],
    path.dirname(rootEnvPath)
  );
}

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

function joinDefined(values) {
  return values
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");
}

function toOrigin(value) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    const connectSrc = joinDefined(
      [
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_API_URL,
        process.env.NEXT_PUBLIC_PIPELINE_URL,
        process.env.NEXT_PUBLIC_EXPRESS_API_URL,
        process.env.NEXT_PUBLIC_CONTEXT_API_URL,
        process.env.NEXT_PUBLIC_BACKEND_URL,
      ].map(toOrigin)
    );

    const contentSecurityPolicy = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://fonts.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
      "font-src 'self' https://fonts.gstatic.com https://api.fontshare.com",
      "img-src 'self' data: blob: https:",
      `connect-src 'self' ${connectSrc} wss:`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default bundleAnalyzer(nextConfig);
