'use client';

import type { ReactElement } from 'react';
import { loadArtifact } from '@/artifact/load';
import { ArtifactGate } from '@/components/artifact-gate';
import { StalenessBanner } from '@/components/staleness-banner';
import { Yard } from '@/components/yard/yard';
import { seedPlants, seedRules, seedYard } from '@/seed';

/**
 * The route itself is the client boundary because `ArtifactGate` takes a render
 * prop, and a function cannot be handed from a server component to a client
 * one.
 *
 * The inventory comes from `@/seed` while the Plan comes through the gate,
 * which is not an inconsistency. The seed is the real yard (CONTEXT.md), it is
 * bundled at build time, and it is the same data the generation run planned
 * against. Only the Artifact needs parsing before anything renders, because
 * only the Artifact can be hand-edited between runs.
 */
export default function YardPage(): ReactElement {
	const { artifact, status } = loadArtifact();

	return (
		<ArtifactGate artifact={artifact} status={status}>
			{validated => (
				<div className="space-y-6">
					{/* `Yard` verbatim: `shell/nav.tsx` labels this route with the same
					    word and `tests/integration/` drives the built export by heading
					    text, so a friendlier wording here passes every unit test and
					    breaks the end-to-end run. */}
					<h1 className="text-2xl font-medium tracking-tight text-foreground">Yard</h1>

					<StalenessBanner
						generatedAt={validated.artifact.generatedAt}
						status={validated.status}
					/>

					<Yard
						yard={seedYard}
						plants={seedPlants}
						rules={seedRules}
						artifact={validated.artifact}
					/>
				</div>
			)}
		</ArtifactGate>
	);
}
