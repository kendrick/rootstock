import type { ReactElement } from 'react';
import { loadArtifact } from '@/artifact/load';
import { AwayCard } from '@/components/away/away-card';

/**
 * The Away Card, at a path only someone who was told it can reach. The slug
 * comes from the build environment for the same reason the coordinates do
 * (docs/adr/0004-coordinates-never-enter-the-repository.md). The repository is
 * public, so a committed slug is a published one, and a published slug is a
 * card anyone can find.
 *
 * Unlike the other routes, this one is a server component, because a client
 * component may not export `generateStaticParams`. That is why `ArtifactGate`
 * sits inside `AwayCard` rather than here—the gate takes a render prop, and a
 * function cannot cross from a server component into a client one.
 *
 * Nothing but the page's own exports belongs in this file. `next build`
 * typechecks a page module against the exports it expects, and an extra named
 * export fails that check, so the helper below stays module-local.
 */

/**
 * `output: 'export'` leaves no server behind to build a segment on demand, so
 * every slug the build did not know about has to 404 rather than be generated
 * when someone asks for it. Flip this to true and the slug stops being secret,
 * because every guess would render the card.
 */
export const dynamicParams = false;

/**
 * An absent variable and a blank one are the same failure, which is how
 * `requireVariable` in src/weather/location.ts already treats them. The message
 * names the variable because ADR 0004 asks the build to say which one is
 * missing rather than default to somewhere plausible. Here the plausible
 * default would be a guessable URL, which is the one thing this route exists to
 * avoid.
 *
 * The read happens inside `generateStaticParams` and not at module scope. A
 * read on import is a side effect the spec would have to reset modules to
 * control, and it buys nothing, since `next build` calls the function and the
 * build fails either way.
 */
function requireAwaySlug(): string {
	const raw = process.env.ROOTSTOCK_AWAY_SLUG;
	if (raw === undefined || raw.trim() === '') {
		throw new Error(`ROOTSTOCK_AWAY_SLUG is not set. The build environment is the only place the Away Card's slug exists (see docs/adr/0004-coordinates-never-enter-the-repository.md); set it before building.`);
	}

	return raw;
}

export function generateStaticParams(): { slug: string }[] {
	return [{ slug: requireAwaySlug() }];
}

/**
 * The slug reaches nothing below this line, and the page never reads its own
 * params. The variable is deliberately not `NEXT_PUBLIC_`, so the one value
 * worth keeping unpublished stays out of the JavaScript every visitor of every
 * route downloads.
 */
export default function AwayPage(): ReactElement {
	const { artifact, status } = loadArtifact();

	return <AwayCard artifact={artifact} status={status} />;
}
