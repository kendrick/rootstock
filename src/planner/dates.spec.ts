import { describe, expect, it } from 'vitest';
import { daysBetween, isWithinMonthDayRange, localDate, MONTHS } from './dates';

describe('isWithinMonthDayRange', () => {
	it('matches a date inside a non-wrapping range', () => {
		expect(isWithinMonthDayRange('2026-06-15', '06-01', '06-30')).toBe(true);
	});

	it('rejects a date outside a non-wrapping range', () => {
		expect(isWithinMonthDayRange('2026-07-01', '06-01', '06-30')).toBe(false);
	});

	it('includes both boundary dates of a non-wrapping range', () => {
		expect(isWithinMonthDayRange('2026-06-01', '06-01', '06-30')).toBe(true);
		expect(isWithinMonthDayRange('2026-06-30', '06-01', '06-30')).toBe(true);
	});

	it('matches a date after the year-end wrap', () => {
		// Fall pre-emergent style range: 11-15 through 02-15, wrapping New Year's.
		expect(isWithinMonthDayRange('2026-12-25', '11-15', '02-15')).toBe(true);
	});

	it('matches a date before the year-end wrap', () => {
		expect(isWithinMonthDayRange('2027-01-10', '11-15', '02-15')).toBe(true);
	});

	it('rejects a date in the gap of a wrapping range', () => {
		expect(isWithinMonthDayRange('2026-06-01', '11-15', '02-15')).toBe(false);
	});

	it('includes both boundary dates of a wrapping range', () => {
		expect(isWithinMonthDayRange('2026-11-15', '11-15', '02-15')).toBe(true);
		expect(isWithinMonthDayRange('2027-02-15', '11-15', '02-15')).toBe(true);
	});
});

describe('localDate', () => {
	it('resolves to the previous day when UTC and local disagree', () => {
		// 02:00Z is 20:00 the prior day in America/Chicago (UTC-6 in January).
		expect(localDate('2026-01-01T02:00:00Z', 'America/Chicago')).toBe('2025-12-31');
	});

	it('resolves the same day when UTC and local agree', () => {
		expect(localDate('2026-09-11T18:00:00Z', 'America/Chicago')).toBe('2026-09-11');
	});

	it('resolves correctly on the US spring-forward day', () => {
		// 2026-03-08 is the day America/Chicago jumps from CST to CDT at 2am
		// local. An afternoon instant should land on the same calendar day
		// regardless of which offset Intl applies underneath.
		expect(localDate('2026-03-08T18:00:00Z', 'America/Chicago')).toBe('2026-03-08');
	});
});

describe('daysBetween', () => {
	it('returns the exact whole-day count across the spring-forward boundary', () => {
		// The local day of 2026-03-08 is only 23 hours long, but daysBetween
		// works off UTC midnights of the calendar dates themselves, so the
		// short local day never has a chance to shave the answer down.
		expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
	});

	it('returns a negative count when to precedes from', () => {
		expect(daysBetween('2026-03-09', '2026-03-07')).toBe(-2);
	});

	it('returns zero for the same date', () => {
		expect(daysBetween('2026-09-11', '2026-09-11')).toBe(0);
	});
});

describe('the MONTHS table', () => {
	it('has one entry per calendar month', () => {
		expect(MONTHS).toHaveLength(12);
	});

	it('lines up with a one-based MM string via Number(mm) - 1', () => {
		expect(MONTHS[Number('09') - 1]).toBe('September');
	});
});
