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
} else {
  process.env.__NEXT_PROCESSED_ENV = "true";
}

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
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
