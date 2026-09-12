import type { StatusRecord } from './artifact';

export type StalenessBand = 'fresh' | 'stale' | 'expired';

export interface Staleness {
	band: StalenessBand;
	ageHours: number;
	consecutiveFailures: number;
}

// 36 hours covers one missed daily run without alarming a reader over it: the
// run is nightly, so a Sunday morning look at Saturday's file is routine, not
// stale. 7 days is the point a second opinion (the weather adapter, a walk
// outside) is worth more than the Artifact's own numbers.
const STALE_AT_HOURS = 36;
const EXPIRED_AFTER_HOURS = 24 * 7;

/**
 * `generatedAt` is the only fact the Artifact carries about its own age
 * (CONTEXT.md's Staleness entry); everything here is derived from it and
 * `now` on each call rather than stored, so a browser tab left open for days
 * still tells the truth on its next render. `now` is a parameter instead of
 * `new Date()` read in here so this stays pure and the banner can pin it in
 * tests and pass the same instant to every render.
 *
 * `consecutiveFailures` rides through from the status record untouched: the
 * band answers "how old is the data", the count answers "how many nights in
 * a row has the runner failed to replace it", and a banner needs both to
 * decide whether to name the runner as the problem.
 */
export function staleness(generatedAt: string, now: Date, status: StatusRecord): Staleness {
	const ageHours = (now.getTime() - Date.parse(generatedAt)) / (60 * 60 * 1000);

	const band: StalenessBand = ageHours < STALE_AT_HOURS
		? 'fresh'
		: ageHours <= EXPIRED_AFTER_HOURS
			? 'stale'
			: 'expired';

	return { band, ageHours, consecutiveFailures: status.consecutiveFailures };
}
