import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Directory that contains this `next.config` file (the repo root). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * Turbopack walks up for lockfiles; a `package-lock.json` in a parent folder
 * (e.g. `$HOME`) makes Next pick the wrong root and every App Router page 404s in dev.
 * Pin the workspace to this repo explicitly.
 *
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#root-directory
 */
const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
