/**
 * The one place the deployed base path is spelled out. `next.config.ts` reads
 * it for `basePath`, and any component that builds a URL `next/image` and
 * `next/link` won't prefix on its own reads it too, so the two can never
 * silently disagree the way `yard-photo.tsx` and `/yard.jpg` once did.
 */
export const BASE_PATH = '/rootstock';

/**
 * `next/image` prefixes `basePath` onto a static import automatically but not
 * onto a plain string `src`, and the bundled docs (`basePath.md`, Images
 * section) say so outright. A seed path like `/yard.jpg` has to go through
 * this before it reaches an `<Image>`, or it resolves against the domain
 * root instead of `/rootstock`.
 */
export function withBasePath(path: string): string {
	return `${BASE_PATH}${path}`;
}
