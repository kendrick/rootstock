import type { SeedData } from '@/store/store';
import { seedOccurrences, seedPlants, seedRules, seedTagPolicy } from '@/seed';

/** What the Planner reads besides the weather: the records a push can change. */
export type PlanInputs = Pick<SeedData, 'rules' | 'plants' | 'occurrences' | 'tagPolicy'>;

/**
 * A fingerprint of the records a Plan was made from, stored on the Artifact
 * as `plannedFrom` (ADR 0007).
 *
 * The site is built on every push, from whatever the seed holds then, but the
 * Plan is only remade by the daily run. Comparing this against the build's own
 * seed is how a page finds out it's showing today's Rules beside a Plan made
 * from other ones.
 *
 * FNV-1a over the JSON, run twice with different offsets for 64 bits. It
 * detects change and nothing more: collisions don't matter against a threat
 * that's an honest edit, and the browser bundle gets no crypto dependency. The
 * JSON is stable because both sides serialize records parsed by the same
 * schemas, which fix the key order.
 */
export function plannedFrom(inputs: PlanInputs): string {
	const text = JSON.stringify([inputs.rules, inputs.plants, inputs.occurrences, inputs.tagPolicy]);
	return fnv1a(text, 0x811C9DC5) + fnv1a(text, 0x01000193);
}

function fnv1a(text: string, offset: number): string {
	let hash = offset >>> 0;
	for (let index = 0; index < text.length; index++) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(16).padStart(8, '0');
}

/** The fingerprint of the seed this build was made from. */
export const seedPlannedFrom = plannedFrom({ rules: seedRules, plants: seedPlants, occurrences: seedOccurrences, tagPolicy: seedTagPolicy });
