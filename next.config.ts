import type { NextConfig } from 'next';
import { BASE_PATH } from './src/lib/base-path';

// Static export because the site is served by GitHub Pages, which has no Node
// runtime: no route handlers, no server actions, no middleware anywhere in this
// repo. basePath is the repo name because this is a project page rather than a
// user page, so every asset resolves under /rootstock rather than the domain
// root. Images are unoptimized for the same reason: the optimizer needs a server.
//
// basePath comes from src/lib/base-path.ts rather than a literal here, because
// next/image does not prefix basePath onto a plain string src on its own
// (bundled docs, Images section): a component has to prefix it by hand, and a
// second literal here is a second place for that value to drift from what
// yard-photo.tsx actually reads.
const nextConfig: NextConfig = {
	output: 'export',
	basePath: BASE_PATH,
	images: { unoptimized: true },
};

export default nextConfig;
