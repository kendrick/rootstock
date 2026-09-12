import type { StatusRecord } from './artifact';
import { describe, expect, it } from 'vitest';
import { staleness } from './staleness';

const HOUR_MS = 60 * 60 * 1000;
const NOW = new Date('2026-09-12T00:00:00Z');

/** Builds a `generatedAt` that is exactly `hours` before `NOW`, so every test states its distance from the boundary rather than a pair of absolute timestamps a reader has to subtract. */
function hoursAgo(hours: number): string {
	return new Date(NOW.getTime() - hours * HOUR_MS).toISOString();
}

function status(consecutiveFailures: number): StatusRecord {
	return {
		attemptedAt: NOW.toISOString(),
		ok: true,
		error: null,
		artifactGeneratedAt: NOW.toISOString(),
		consecutiveFailures,
	};
}

describe('staleness', () => {
	// Contract 3 draws the fresh/stale line at 36 hours, with fresh on the near
	// side. Both sides are asserted, because a band function that only ever
	// checked the near side would pass just as happily if the line had silently
	// moved to 35 or 37.
	it('is fresh just under 36 hours', () => {
		expect(staleness(hoursAgo(36 - 1 / 3600), NOW, status(0)).band).toBe('fresh');
	});

	it('is stale at exactly 36 hours', () => {
		expect(staleness(hoursAgo(36), NOW, status(0)).band).toBe('stale');
	});

	// The stale/expired line sits at 7 days, and "expired past 7 days" puts the
	// boundary instant itself in the stale band, not the expired one — the
	// exact-168-hours case below is what pins that reading down.
	it('is still stale at exactly 7 days', () => {
		expect(staleness(hoursAgo(24 * 7), NOW, status(0)).band).toBe('stale');
	});

	it('is expired just past 7 days', () => {
		expect(staleness(hoursAgo(24 * 7 + 1 / 3600), NOW, status(0)).band).toBe('expired');
	});

	it('is fresh for a just-generated artifact', () => {
		expect(staleness(NOW.toISOString(), NOW, status(0)).band).toBe('fresh');
	});

	it('reports ageHours as the elapsed time between generatedAt and now', () => {
		expect(staleness(hoursAgo(10), NOW, status(0)).ageHours).toBeCloseTo(10);
	});

	// consecutiveFailures is carried through, not recomputed — the Store owns
	// the count (per artifact.ts), and this function only reports it alongside
	// the age so a banner can read both from one place.
	it('passes consecutiveFailures through from the status record untouched', () => {
		expect(staleness(hoursAgo(1), NOW, status(4)).consecutiveFailures).toBe(4);
	});
});
