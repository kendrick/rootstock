import type { NextConfig } from 'next';

// Static export because the site is served by GitHub Pages, which has no Node
// runtime: no route handlers, no server actions, no middleware anywhere in this
// repo. basePath is the repo name because this is a project page rather than a
// user page, so every asset resolves under /rootstock rather than the domain
// root. Images are unoptimized for the same reason: the optimizer needs a server.
const nextConfig: NextConfig = {
	output: 'export',
	basePath: '/rootstock',
	images: { unoptimized: true },
};

export default nextConfig;
