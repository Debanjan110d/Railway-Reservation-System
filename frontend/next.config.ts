import type { NextConfig } from "next";
import os from "os";

// Detect all local IPv4 LAN addresses and allow wildcard ranges for cross-device development
function getAllowedDevOrigins(): string[] {
  const origins = new Set<string>([
    "localhost",
    "127.0.0.1",
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
    "192.168.0.106",
  ]);

  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const netList = interfaces[name];
      if (netList) {
        for (const net of netList) {
          if (net.family === "IPv4" && !net.internal) {
            origins.add(net.address);
          }
        }
      }
    }
  } catch {
    // fallback gracefully if network interfaces cannot be queried
  }

  if (process.env.ALLOWED_DEV_ORIGINS) {
    for (const item of process.env.ALLOWED_DEV_ORIGINS.split(",")) {
      if (item.trim()) origins.add(item.trim());
    }
  }

  return Array.from(origins);
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: getAllowedDevOrigins(),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
      },
    },
  },
};

export default nextConfig;
