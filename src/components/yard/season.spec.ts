import { describe, expect, it } from 'vitest';
import { thresholdRule } from './fixtures';
import { outOfSeasonUntil } from './season';

/*
 * The spring pre-emergent's season is Feb 1 to Apr 30 in the seed. Late
 * September is outside it, and the sheet collapses the chart behind this date.
 */
describe('outOfSeasonUntil', () => {
	const spring = { ...thresholdRule, season: { start: '02-01', end: '04-30' } };

	it('names the day the season opens when the Plan falls outside it', () => {
		expect(outOfSeasonUntil('2026-09-25', spring)).toBe('Feb 1');
	});

	it('says nothing inside the season', () => {
		expect(outOfSeasonUntil('2026-03-10', spring)).toBeNull();
	});

	it('reads a season that wraps the year end', () => {
		const winter = { ...thresholdRule, season: { start: '11-15', end: '02-15' } };
		expect(outOfSeasonUntil('2026-01-10', winter)).toBeNull();
		expect(outOfSeasonUntil('2026-06-01', winter)).toBe('Nov 15');
	});

	it('says nothing for a Rule with no season', () => {
		expect(outOfSeasonUntil('2026-09-25', { ...thresholdRule, season: null })).toBeNull();
	});
});
