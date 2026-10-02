import type { NextConfig } from "next";

/**
 * A fully static site.
 *
 * There is no server because there is nothing for one to do. The data is already
 * published as static files on a CDN with CORS open, so the browser fetches it directly —
 * the same requests a server would have made, minus the server. `output: "export"` is
 * what makes that a deployment story rather than an intention: the build emits plain
 * files, and any static host serves them.
 *
 * It also means the build never touches the network. Nothing is fetched at build time —
 * not the market, not even the list of tickers — so the site builds identically whether
 * the archive is reachable or not, and a company listed today appears without a rebuild.
 */
const nextConfig: NextConfig = {
  output: "export",
  // Emits `symbol/index.html` rather than `symbol.html`, so a static host serving the
  // directory-style URL finds it instead of 404ing.
  trailingSlash: true,
};

export default nextConfig;
