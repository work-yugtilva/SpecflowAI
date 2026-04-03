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

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              `img-src 'self' data: blob: ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}`,
              `connect-src 'self' ${joinDefined([
                process.env.NEXT_PUBLIC_SUPABASE_URL,
                process.env.NEXT_PUBLIC_PIPELINE_URL,
                process.env.NEXT_PUBLIC_EXPRESS_API_URL,
                process.env.NEXT_PUBLIC_CONTEXT_API_URL,
                process.env.NEXT_PUBLIC_BACKEND_URL,
              ])} wss:`,
              "frame-ancestors 'none'",
            ].join("; "),
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
