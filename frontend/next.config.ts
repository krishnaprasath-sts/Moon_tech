import type { NextConfig } from "next";
import os from "node:os";

/**
 * Hosts allowed to reach the dev server's HMR socket and /_next internals.
 * Covers every private LAN range (per-segment wildcards) plus this machine's
 * current IPv4 addresses, so opening the site from a phone keeps working when
 * the Wi-Fi network (and therefore the IP) changes. Only used by `next dev`.
 */
function localDevOrigins(): string[] {
  const privateRanges = [
    "10.*.*.*",
    "192.168.*.*",
    ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
  ];
  const interfaceAddresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((addr): addr is os.NetworkInterfaceInfo => Boolean(addr) && addr!.family === "IPv4" && !addr!.internal)
    .map((addr) => addr.address);
  return Array.from(new Set(["localhost", "127.0.0.1", ...privateRanges, ...interfaceAddresses]));
}

/**
 * Baseline security headers for every route. No Content-Security-Policy is set
 * here so Google Fonts and inline styles keep working.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  // NEXT_OUTPUT=export builds a static site into ./out for Apache / Webuzo hosting
  output: process.env.NEXT_OUTPUT === "export" ? "export" : undefined,
  poweredByHeader: false,
  allowedDevOrigins: localDevOrigins(),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
