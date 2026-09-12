'use client';

import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { loadArtifact } from '@/artifact/load';
import { ArtifactGate } from '@/components/artifact-gate';
import { StalenessBanner } from '@/components/staleness-banner';

/**
 * The route itself is the client boundary because `ArtifactGate` takes a render
 * prop, and a function cannot be handed from a server component to a client
 * one. A wrapper whose only job was to hold that arrow function would buy
 * nothing, since `output: 'export'` bundles the Artifact for the browser either
 * way.
 */
export default function ThisWeekPage(): ReactElement {
	const { artifact, status } = loadArtifact();

	// The clock is read after mount and never during render. `output: 'export'`
	// prerenders this route in Node, so a `now` read while rendering would bake
	// the build machine's instant into the HTML, and the browser would contradict
	// that instant on hydration. Holding null until the effect fires keeps the
	// timestamp out of the exported file entirely. CONTEXT.md's Staleness entry
	// asks for the same thing: the age belongs to the moment someone is reading.
	const [now, setNow] = useState<Date | null>(null);
	useEffect(() => {
		// eslint-disable-next-line react/set-state-in-effect -- the prerender has to run once with no clock at all, so the extra render is the point
		setNow(new Date());
	}, []);

	return (
		<ArtifactGate artifact={artifact} status={status}>
			{validated => (
				<div className="space-y-6">
					<h1 className="text-2xl font-medium tracking-tight text-foreground">This Week</h1>

					{now && (
						<StalenessBanner
							generatedAt={validated.artifact.generatedAt}
							status={validated.status}
							now={now}
						/>
					)}

					{/* One line and no more. #12 owns what actually renders under this
					    heading, and anything added here is work it would have to undo. */}
					<p className="text-muted-foreground">
						The Plan for this week goes here, each Task beside the Citation behind it.
					</p>
				</div>
			)}
		</ArtifactGate>
	);
}
