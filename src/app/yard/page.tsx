'use client';

import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { loadArtifact } from '@/artifact/load';
import { ArtifactGate } from '@/components/artifact-gate';
import { StalenessBanner } from '@/components/staleness-banner';

/**
 * A placeholder route that still validates its data and still reports its age,
 * because the shell makes both promises on every route, including the ones
 * nobody has filled in yet. #13 replaces the line below, not the wiring around
 * it.
 *
 * The route itself is the client boundary because `ArtifactGate` takes a render
 * prop, and a function cannot be handed from a server component to a client one.
 */
export default function YardPage(): ReactElement {
	const { artifact, status } = loadArtifact();

	// Read after mount, never during render. `output: 'export'` prerenders this
	// route in Node, so a clock read at render time would bake the build
	// machine's instant into the HTML for the browser to contradict on hydration.
	const [now, setNow] = useState<Date | null>(null);
	useEffect(() => {
		// eslint-disable-next-line react/set-state-in-effect -- the prerender has to run once with no clock at all, so the extra render is the point
		setNow(new Date());
	}, []);

	return (
		<ArtifactGate artifact={artifact} status={status}>
			{validated => (
				<div className="space-y-6">
					<h1 className="text-2xl font-medium tracking-tight text-foreground">Yard</h1>

					{now && (
						<StalenessBanner
							generatedAt={validated.artifact.generatedAt}
							status={validated.status}
							now={now}
						/>
					)}

					<p className="text-muted-foreground">
						Every Plant in the yard goes here, each with the Rules that reach it.
					</p>
				</div>
			)}
		</ArtifactGate>
	);
}
