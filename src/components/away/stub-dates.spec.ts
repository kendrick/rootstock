import type { Task } from '@/planner/task';
import type { WindowRule } from '@/rules/rule';
import { describe, expect, it } from 'vitest';
import { seedRules } from '@/seed';
import { byWhen, shortDay, ticketNumber } from './stub-dates';

/*
 * Every expected string here was read off a printed calendar, not computed.
 * A spec that derived "Thu" with the same Date arithmetic as the code would
 * pass on the code's own mistakes.
 */

const lastNitrogen = seedRules.find(rule => rule.id === 'last-nitrogen');
if (lastNitrogen?.kind !== 'window') {
	throw new Error('seed rule \'last-nitrogen\' is missing or no longer a Window Rule: this spec reads its 09-01 → 10-01 range');
}

/** A wrapping window no seed Rule has yet, built off a real one so every other field stays valid. */
const winterMulch: WindowRule = { ...lastNitrogen, id: 'winter-mulch-refresh', start: '12-01', end: '02-28' };
const leapEnd: WindowRule = { ...lastNitrogen, id: 'leap-end', start: '02-01', end: '02-29' };

function windowTask(ruleId: string, asOf: string): Task {
	return {
		id: `${ruleId}@front-lawn`,
		ruleId,
		plantId: 'front-lawn',
		status: 'fired',
		citation: { kind: 'window', date: asOf },
		deferrals: [],
		annotations: [],
		delegable: true,
		tags: [],
		title: 'A window Task',
		guardChecks: null,
	};
}

const cadenceTask: Task = {
	...windowTask('esperanza-feeding', '2026-09-28'),
	citation: { kind: 'cadence', lastOccurrenceId: null, elapsedDays: null },
};

describe('byWhen', () => {
	it('gives a Window Task its window\'s last day', () => {
		expect(byWhen(windowTask('last-nitrogen', '2026-09-28'), lastNitrogen, '2026-09-28')).toBe('By Thu Oct 1');
	});

	it('closes a wrapping window next year when it is read before New Year', () => {
		expect(byWhen(windowTask('winter-mulch-refresh', '2026-12-15'), winterMulch, '2026-12-15')).toBe('By Sun Feb 28');
	});

	it('closes a wrapping window this year when it is read after New Year', () => {
		expect(byWhen(windowTask('winter-mulch-refresh', '2027-01-10'), winterMulch, '2027-01-10')).toBe('By Sun Feb 28');
		expect(byWhen(windowTask('winter-mulch-refresh', '2026-01-10'), winterMulch, '2026-01-10')).toBe('By Sat Feb 28');
	});

	it('never promises a Feb 29 a common year lacks', () => {
		expect(byWhen(windowTask('leap-end', '2027-02-10'), leapEnd, '2027-02-10')).toBe('By Sun Feb 28');
		expect(byWhen(windowTask('leap-end', '2028-02-10'), leapEnd, '2028-02-10')).toBe('By Tue Feb 29');
	});

	it('says "This week" for Cadence work, which has no last day', () => {
		expect(byWhen(cadenceTask, seedRules.find(rule => rule.id === 'esperanza-feeding') ?? null, '2026-09-28')).toBe('This week');
	});

	it('falls back to "This week" when the Rule is gone', () => {
		expect(byWhen(windowTask('last-nitrogen', '2026-09-28'), null, '2026-09-28')).toBe('This week');
	});
});

describe('shortDay', () => {
	it('spells a Plan date the way the heading prints it', () => {
		expect(shortDay('2026-09-28')).toBe('Sep 28');
		expect(shortDay('2026-10-01')).toBe('Oct 1');
	});
});

describe('ticketNumber', () => {
	it('numbers the Plan\'s day of the year, padded to three digits', () => {
		expect(ticketNumber('2026-09-28')).toBe('No. 2026-271');
		expect(ticketNumber('2026-01-05')).toBe('No. 2026-005');
		expect(ticketNumber('2028-12-31')).toBe('No. 2028-366');
	});
});
