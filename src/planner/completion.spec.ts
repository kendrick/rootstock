import type { Occurrence } from './occurrence';
import type { Citation, Task } from './task';
import type { CadenceRule, WindowRule } from '@/rules/rule';
import { describe, expect, it } from 'vitest';
import { isCompleted } from './completion';
import { taskId } from './task';

/**
 * Every Rule field a real one carries except the two each test is about, the
 * same trade `window-rule.spec.ts` makes: the fixture file's Rules are shaped
 * around September 2026, and this file needs ranges and years it can pin to
 * the day.
 */
const ruleBase = {
	name: 'Fall pre-emergent on the front lawn',
	region: { name: 'Fort Worth', hardinessZone: '8b' },
	source: { kind: 'extension' as const, label: 'Texas A&M AgriLife Extension', url: null },
	tags: ['lawn'],
	delegable: true,
	priority: 10,
	appliesTo: { plantIds: ['front-lawn'], plantTags: null, ruleTags: null },
	productLabel: null,
};

function buildWindowRule(start: string, end: string): WindowRule {
	return { ...ruleBase, id: 'fall-pre-emergent', kind: 'window', start, end };
}

function buildCadenceRule(): CadenceRule {
	return {
		...ruleBase,
		id: 'fall-pre-emergent',
		kind: 'cadence',
		everyDays: { min: 28, max: 42 },
		season: null,
		after: null,
	};
}

/**
 * The Task's id is derived through `taskId` rather than written out, because
 * `taskSchema` refines on exactly that equality—a hand-typed id here would
 * be a Task no parse would accept, and completion would be proven against a
 * shape the Planner cannot produce.
 */
function buildTask(citation: Citation, overrides: Partial<Task> = {}): Task {
	const ruleId = overrides.ruleId ?? 'fall-pre-emergent';
	const plantId = overrides.plantId === undefined ? 'front-lawn' : overrides.plantId;

	return {
		id: taskId(ruleId, plantId),
		ruleId,
		plantId,
		status: 'fired',
		citation,
		deferrals: [],
		annotations: [],
		delegable: true,
		tags: ['lawn'],
		title: 'Put down fall pre-emergent on the front lawn',
		...overrides,
	};
}

/**
 * Recorded at the same instant it was completed. The backfill case—a
 * `recordedAt` days later than the `completedAt`—is deliberately absent:
 * completion reads only `completedAt`, and a fixture that varied both would
 * suggest the second one is in play.
 */
function buildOccurrence(
	completedAt: string,
	ruleId = 'fall-pre-emergent',
	plantId: string | null = 'front-lawn',
): Occurrence {
	return {
		id: `${ruleId}-${completedAt.slice(0, 10)}`,
		ruleId,
		plantId,
		completedAt,
		recordedAt: completedAt,
		source: 'browser',
	};
}

const windowCitation: Citation = { kind: 'window', date: '2026-09-11' };

describe('isCompleted', () => {
	describe('a window Task', () => {
		const rule = buildWindowRule('09-01', '09-30');
		const task = buildTask(windowCitation);

		it('counts work recorded after the window opened', () => {
			const occurrences = [buildOccurrence('2026-09-05T14:00:00Z')];

			expect(isCompleted(task, occurrences, '2026-09-11', rule)).toBe(true);
		});

		it('counts work recorded on the day the window opened', () => {
			const occurrences = [buildOccurrence('2026-09-01T14:00:00Z')];

			expect(isCompleted(task, occurrences, '2026-09-11', rule)).toBe(true);
		});

		it('ignores work recorded the day before the window opened', () => {
			const occurrences = [buildOccurrence('2026-08-31T14:00:00Z')];

			expect(isCompleted(task, occurrences, '2026-09-11', rule)).toBe(false);
		});

		/*
		 * The case the whole evidence-start idea exists for. A window Rule comes
		 * back every year, so last September's application is history and this
		 * September's Task is unchecked work, even though both sit inside the
		 * same 09-01 through 09-30 range.
		 */
		it('ignores last year\'s pass through the same window', () => {
			const occurrences = [buildOccurrence('2025-09-15T14:00:00Z')];

			expect(isCompleted(task, occurrences, '2026-09-11', rule)).toBe(false);
		});

		it('reads unchecked when the rule set does not carry the Rule', () => {
			const occurrences = [buildOccurrence('2026-09-05T14:00:00Z')];

			expect(isCompleted(task, occurrences, '2026-09-11', null)).toBe(false);
		});

		/*
		 * A Rule resolved to some other kind is as unresolvable as a missing one.
		 * Without this branch the window case would have to reach `rule.start` on
		 * a Rule that has none.
		 */
		it('reads unchecked when the resolved Rule is not a Window Rule', () => {
			const occurrences = [buildOccurrence('2026-09-05T14:00:00Z')];

			expect(isCompleted(task, occurrences, '2026-09-11', buildCadenceRule())).toBe(false);
		});
	});

	describe('a window Task whose range wraps the year end', () => {
		const rule = buildWindowRule('12-01', '02-28');
		const task = buildTask({ kind: 'window', date: '2027-01-15' });

		/*
		 * The January morning that breaks the naive reading. Dating the evidence
		 * to 2027-12-01 puts the window's opening eleven months in the future, and
		 * December's mulching—work this same pass through the window—reads as too
		 * old to count.
		 */
		it('counts December\'s work on a January morning', () => {
			const occurrences = [buildOccurrence('2026-12-10T14:00:00Z')];

			expect(isCompleted(task, occurrences, '2027-01-15', rule)).toBe(true);
		});

		it('ignores work recorded before the window opened in December', () => {
			const occurrences = [buildOccurrence('2026-11-20T14:00:00Z')];

			expect(isCompleted(task, occurrences, '2027-01-15', rule)).toBe(false);
		});

		/*
		 * The other side of the wrap: on a December morning the window opened days
		 * ago in the current year, so the roll-back must not fire. It would date
		 * the evidence to 2025-12-01 and hand the Task the previous pass through
		 * the window as proof.
		 */
		it('stays in the current year once asOf has reached the opening date', () => {
			const december = buildTask({ kind: 'window', date: '2026-12-15' });

			expect(isCompleted(december, [buildOccurrence('2026-12-05T14:00:00Z')], '2026-12-15', rule)).toBe(true);
			expect(isCompleted(december, [buildOccurrence('2025-12-20T14:00:00Z')], '2026-12-15', rule)).toBe(false);
		});
	});

	describe('a threshold Task', () => {
		const citation: Citation = {
			kind: 'threshold',
			variable: 'soil-temperature',
			depthCm: 6,
			aggregate: 'mean',
			from: '2026-09-08',
			to: '2026-09-11',
		};
		const task = buildTask(citation);

		it('counts work recorded since the cited run began', () => {
			expect(isCompleted(task, [buildOccurrence('2026-09-09T14:00:00Z')], '2026-09-11', null)).toBe(true);
		});

		it('counts work recorded on the first day of the cited run', () => {
			expect(isCompleted(task, [buildOccurrence('2026-09-08T14:00:00Z')], '2026-09-11', null)).toBe(true);
		});

		/*
		 * Work from before the run belongs to an earlier crossing of the same
		 * threshold. Soil temperature can settle, rise, and settle again in one
		 * autumn, and each crossing is its own job.
		 */
		it('ignores work recorded before the cited run began', () => {
			expect(isCompleted(task, [buildOccurrence('2026-09-07T14:00:00Z')], '2026-09-11', null)).toBe(false);
		});
	});

	describe('a cadence Task', () => {
		const citation: Citation = {
			kind: 'cadence',
			lastOccurrenceId: 'esperanza-feeding-2026-08-02',
			elapsedDays: 40,
		};
		const task = buildTask(citation);

		it('counts work recorded today', () => {
			expect(isCompleted(task, [buildOccurrence('2026-09-11T14:00:00Z')], '2026-09-11', null)).toBe(true);
		});

		/*
		 * Yesterday's Occurrence is the Anchor the Rule counted its interval from,
		 * so reading it as evidence would check off the very Task it produced, and
		 * a cadence job would arrive done every morning.
		 */
		it('ignores yesterday\'s work, which is what the Rule counted from', () => {
			expect(isCompleted(task, [buildOccurrence('2026-09-10T14:00:00Z')], '2026-09-11', null)).toBe(false);
		});
	});

	describe('an approaching Task', () => {
		const projection: Citation = {
			kind: 'threshold-projection',
			variable: 'soil-temperature',
			depthCm: 6,
			aggregate: 'mean',
			projectedDate: '2026-09-16',
		};

		it('is never completed, whatever the yard has recorded', () => {
			const task = buildTask(projection, { status: 'approaching' });

			expect(isCompleted(task, [buildOccurrence('2026-09-11T14:00:00Z')], '2026-09-11', null)).toBe(false);
		});

		/*
		 * `taskSchema` does not tie the status to the Citation kind—only the
		 * Planner pairs them—so each has to refuse on its own. A Task that reached
		 * here with one half of the pair would otherwise fall through to a branch
		 * that resolves a real evidence start.
		 */
		it('refuses on the status alone, without the projection citation', () => {
			const task = buildTask({ kind: 'cadence', lastOccurrenceId: null, elapsedDays: null }, {
				status: 'approaching',
			});

			expect(isCompleted(task, [buildOccurrence('2026-09-11T14:00:00Z')], '2026-09-11', null)).toBe(false);
		});

		it('refuses on the projection citation alone, without the status', () => {
			const task = buildTask(projection);

			expect(isCompleted(task, [buildOccurrence('2026-09-11T14:00:00Z')], '2026-09-11', null)).toBe(false);
		});
	});

	describe('matching an Occurrence to the Task', () => {
		const rule = buildWindowRule('09-01', '09-30');
		const task = buildTask(windowCitation);

		it('ignores an Occurrence recorded against another Rule', () => {
			const occurrences = [buildOccurrence('2026-09-05T14:00:00Z', 'winter-mulch-refresh')];

			expect(isCompleted(task, occurrences, '2026-09-11', rule)).toBe(false);
		});

		/*
		 * One Rule reaches several Plants, and each Plant's Task is its own piece
		 * of work. Mulching the fig says nothing about the pomegranate.
		 */
		it('ignores an Occurrence recorded against another Plant', () => {
			const occurrences = [buildOccurrence('2026-09-05T14:00:00Z', 'fall-pre-emergent', 'fig-1')];

			expect(isCompleted(task, occurrences, '2026-09-11', rule)).toBe(false);
		});

		it('matches a yard-wide Task against an Occurrence carrying no Plant', () => {
			const yardWide = buildTask(windowCitation, { plantId: null });
			const occurrences = [buildOccurrence('2026-09-05T14:00:00Z', 'fall-pre-emergent', null)];

			expect(isCompleted(yardWide, occurrences, '2026-09-11', rule)).toBe(true);
		});

		it('does not let a Plant-specific Occurrence complete a yard-wide Task', () => {
			const yardWide = buildTask(windowCitation, { plantId: null });
			const occurrences = [buildOccurrence('2026-09-05T14:00:00Z', 'fall-pre-emergent', 'front-lawn')];

			expect(isCompleted(yardWide, occurrences, '2026-09-11', rule)).toBe(false);
		});

		it('finds the matching Occurrence among several that do not match', () => {
			const occurrences = [
				buildOccurrence('2026-09-06T14:00:00Z', 'winter-mulch-refresh'),
				buildOccurrence('2026-09-05T14:00:00Z', 'fall-pre-emergent', 'fig-1'),
				buildOccurrence('2026-09-04T14:00:00Z'),
			];

			expect(isCompleted(task, occurrences, '2026-09-11', rule)).toBe(true);
		});

		it('reads unchecked when the yard has recorded nothing at all', () => {
			expect(isCompleted(task, [], '2026-09-11', rule)).toBe(false);
		});
	});
});
