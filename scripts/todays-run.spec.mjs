import { describe, expect, it } from 'vitest';
import { DEFAULT_STATUS } from './generate';
import { todaysRun } from './todays-run';

// The property's zone, and the one this module exists for. Every case below is written so that a
// UTC comparison would give a different answer than the right one at least once.
const TIME_ZONE = 'America/Chicago';

// The committed placeholder, reused rather than invented: 20:06:59Z on the 14th is 15:06 local, a
// perfectly ordinary afternoon run, and it is also late enough in UTC terms to cross midnight there
// before it crosses midnight in Chicago.
const PUBLISHED_AT = '2026-09-14T20:06:59.039Z';

function published(overrides = {}) {
	return {
		attemptedAt: PUBLISHED_AT,
		ok: true,
		error: null,
		artifactGeneratedAt: PUBLISHED_AT,
		consecutiveFailures: 0,
		...overrides,
	};
}

describe('todaysRun', () => {
	it('reports a run when a successful one published on the same local day', () => {
		const result = todaysRun({
			status: published(),
			now: new Date('2026-09-14T22:00:00.000Z'),
			timeZone: TIME_ZONE,
		});

		expect(result).toEqual({ ran: true, asOf: '2026-09-14', artifactGeneratedAt: PUBLISHED_AT });
	});

	// The caller prints both values in the line it leaves in the log, and deriving either of them a
	// second time at the call site is how the message and the decision drift apart.
	it('hands back the local day and the instant it decided on', () => {
		const result = todaysRun({
			status: published(),
			now: new Date('2026-09-14T22:00:00.000Z'),
			timeZone: TIME_ZONE,
		});

		expect(result.ran && result.asOf).toBe('2026-09-14');
		expect(result.ran && result.artifactGeneratedAt).toBe(PUBLISHED_AT);
	});

	// The whole decision in one case. A failed run leaves the day open on purpose, so the second
	// machine is a free retry rather than a second box agreeing to publish nothing.
	it('leaves the day open when the last run failed, even though its stamp is today', () => {
		const result = todaysRun({
			status: published({
				ok: false,
				error: 'generation failed at the weather stage: Open-Meteo answered HTTP 503.',
				consecutiveFailures: 1,
			}),
			now: new Date('2026-09-14T22:00:00.000Z'),
			timeZone: TIME_ZONE,
		});

		expect(result).toEqual({ ran: false });
	});

	it('leaves the day open when the last success was the previous local day', () => {
		const result = todaysRun({
			status: published(),
			now: new Date('2026-09-15T18:00:00.000Z'),
			timeZone: TIME_ZONE,
		});

		expect(result).toEqual({ ran: false });
	});

	// A fresh checkout, and a status file something truncated mid-write, both arrive as this record.
	// Neither may ever skip: a box that cannot read the history has not published anything.
	it('leaves the day open for the default status', () => {
		const result = todaysRun({
			status: DEFAULT_STATUS,
			now: new Date('2026-09-14T22:00:00.000Z'),
			timeZone: TIME_ZONE,
		});

		expect(result).toEqual({ ran: false });
	});

	// The case that earns the module. In UTC these two instants are different days, so a UTC
	// comparison would call the day open and the second machine would pay for a Plan that exists.
	it('holds the day when the clock has crossed UTC midnight but not the property\'s', () => {
		const result = todaysRun({
			status: published(),
			now: new Date('2026-09-15T02:30:00.000Z'),
			timeZone: TIME_ZONE,
		});

		expect(result).toEqual({ ran: true, asOf: '2026-09-14', artifactGeneratedAt: PUBLISHED_AT });
	});

	// The mirror, and the reason the comparison is not simply "within 24 hours". A run that finished
	// an hour before local midnight has not planned the day that just started.
	it('opens the day when local midnight has passed, an hour after the last run', () => {
		const result = todaysRun({
			status: published({
				attemptedAt: '2026-09-15T04:00:00.000Z',
				artifactGeneratedAt: '2026-09-15T04:00:00.000Z',
			}),
			now: new Date('2026-09-15T05:30:00.000Z'),
			timeZone: TIME_ZONE,
		});

		expect(result).toEqual({ ran: false });
	});

	// Pins which of the two timestamps is read. `attemptedAt` moves on a failed run, so a module
	// that consulted it would let a failure close the day.
	it('reads the published stamp and not the attempt stamp', () => {
		const result = todaysRun({
			status: published({ attemptedAt: '2026-09-15T18:00:00.000Z' }),
			now: new Date('2026-09-15T18:00:01.000Z'),
			timeZone: TIME_ZONE,
		});

		expect(result).toEqual({ ran: false });
	});

	// `localDate` is pure `Intl`, so this is a regression pin rather than a live risk: the module
	// must never do hour arithmetic of its own, which is what a DST day would expose.
	it('does no hour arithmetic across the autumn clock change', () => {
		const result = todaysRun({
			status: published({
				attemptedAt: '2026-11-01T06:30:00.000Z',
				artifactGeneratedAt: '2026-11-01T06:30:00.000Z',
			}),
			now: new Date('2026-11-01T22:00:00.000Z'),
			timeZone: TIME_ZONE,
		});

		expect(result).toEqual({
			ran: true,
			asOf: '2026-11-01',
			artifactGeneratedAt: '2026-11-01T06:30:00.000Z',
		});
	});
});
