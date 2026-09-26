import type { DailyAggregate, Plan } from '@/planner/plan';
import type { Task } from '@/planner/task';
import type { Rule } from '@/rules/rule';
import { describe, expect, it } from 'vitest';
import { taskId } from '@/planner/task';
import { seedRules } from '@/seed';
import { standingFor } from './waiting';

function seedRule(id: string): Rule {
	const rule = seedRules.find(candidate => candidate.id === id);
	if (rule === undefined) {
		throw new Error(`seedRules has no rule '${id}'`);
	}
	return rule;
}

function firedTask(ruleId: string, overrides: Partial<Task> = {}): Task {
	return {
		id: taskId(ruleId, null),
		ruleId,
		plantId: null,
		status: 'fired',
		citation: { kind: 'window', date: '2026-09-26' },
		deferrals: [],
		annotations: [],
		delegable: false,
		tags: [],
		title: 'A fired Task',
		...overrides,
	};
}

function soilReading(date: string, value: number): DailyAggregate {
	return {
		date,
		variable: 'soil-temperature',
		depthCm: 6,
		aggregate: 'mean',
		value,
		unit: 'F',
		basis: 'observed',
		provenance: 'modeled',
		source: 'open-meteo',
	};
}

function plan(asOf: string, tasks: Task[] = [], window: DailyAggregate[] = []): Plan {
	return { asOf, tasks, window };
}

// The status line says the one thing the band above it can't: when the Rule
// next changes. The band already says whether it fired.
describe('standingFor, fired', () => {
	it('gives a fired Window Rule the day its window closes', () => {
		const standing = standingFor(seedRule('last-nitrogen'), plan('2026-09-26', [firedTask('last-nitrogen')]));

		expect(standing.band).toBe('fired');
		expect(standing.waitingOn).toBe('Window closes October 1');
	});

	it('gives a fired seasonal Cadence Rule the day its season closes', () => {
		const standing = standingFor(seedRule('esperanza-feeding'), plan('2026-09-26', [firedTask('esperanza-feeding')]));

		expect(standing.waitingOn).toBe('Season closes October 7');
	});
});

describe('standingFor, waiting', () => {
	// A Threshold Rule's season is when its reading counts at all, so out of
	// season the reading beside the value is noise that looks like a missed firing.
	it('gives an out-of-season Threshold Rule its opening day rather than a reading', () => {
		const standing = standingFor(seedRule('spring-pre-emergent'), plan('2026-09-26', [], [soilReading('2026-09-25', 88.79583333333335)]));

		expect(standing.waitingOn).toBe('Opens February 1');
	});

	// ADR 0005: a directed Rule fires on a Crossing, so a reading already above
	// the value is not the condition met. The line names the Crossing.
	it('names the Crossing a directed Threshold Rule needs, in season', () => {
		const standing = standingFor(seedRule('spring-pre-emergent'), plan('2026-03-10', [], [soilReading('2026-03-09', 58.24999)]));

		expect(standing.waitingOn).toBe('Last read 58.2°F; needs a rise through 55°F');
	});

	it('rounds a reading to one decimal', () => {
		const standing = standingFor(seedRule('spring-pre-emergent'), plan('2026-03-10', [], [soilReading('2026-03-09', 48.04)]));

		expect(standing.waitingOn).toBe('Last read 48°F; needs a rise through 55°F');
	});

	it('gives an out-of-season Cadence Rule its opening day', () => {
		const standing = standingFor(seedRule('fig-spring-nitrogen'), plan('2026-09-26'));

		expect(standing.waitingOn).toBe('Opens March 1');
	});

	it('says an in-season Cadence Rule is not due, with its interval', () => {
		const standing = standingFor(seedRule('fig-spring-nitrogen'), plan('2026-04-10'));

		expect(standing.waitingOn).toBe('Every 28–35 days; not due this week');
	});
});

// ADR 0002 gives a Guard two effects. The line follows the effect, because an
// annotating Guard holds nothing back and saying it does is a false claim.
describe('standingFor, guards', () => {
	const deferringGuard = seedRule('rain-expected');
	const annotatingGuard = seedRule('water-in-after-application');

	it('says a deferring Guard is holding nothing when no Task names it', () => {
		expect(standingFor(deferringGuard, plan('2026-09-26')).waitingOn).toBe('Holding nothing this week');
	});

	// A reader checking the Guard's claim needs the Task it touched, by the
	// title the Planner gave it.
	it('names the Task a deferring Guard is holding', () => {
		const held = firedTask('fall-pre-emergent', { status: 'deferred', title: 'Fall pre-emergent (Front lawn)', deferrals: [{ guardId: deferringGuard.id, releaseWhen: 'Later' }] });

		expect(standingFor(deferringGuard, plan('2026-09-26', [held])).waitingOn).toBe('Holding Fall pre-emergent (Front lawn)');
	});

	it('names every Task an annotating Guard is marking, never holding', () => {
		const lawn = firedTask('fall-pre-emergent', { title: 'Fall pre-emergent (Front lawn)', annotations: [{ guardId: annotatingGuard.id, text: 'Water it in' }] });
		const fig = firedTask('last-nitrogen', { title: 'Last nitrogen (Fig)', annotations: [{ guardId: annotatingGuard.id, text: 'Water it in' }] });

		expect(standingFor(annotatingGuard, plan('2026-09-26', [lawn, fig])).waitingOn).toBe('Marking Fall pre-emergent (Front lawn) and Last nitrogen (Fig)');
		expect(standingFor(annotatingGuard, plan('2026-09-26')).waitingOn).toBe('Marking nothing this week');
	});
});
