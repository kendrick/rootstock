import type { Artifact } from './artifact';
import type { DailyAggregate } from '@/planner/plan';
import { OBSERVATION_WINDOW_DAYS } from '@/planner/plan';
import { taskId } from '@/planner/task';

/*
 * A day in the life of the real yard, shaped for tests that need an Artifact
 * without building one by hand. Everything below is typed as `Artifact`
 * rather than inferred, so a schema change breaks the fixture at compile time
 * instead of at the first assertion that happens to touch the changed field.
 *
 * The plan carries one fired Task and one deferred Task, because those are the
 * two states the interface renders differently. A fixture holding only fired
 * work would let a broken deferral render past every test that reuses it.
 */

const ASOF = '2026-09-11';

/** Ids come from `taskId` rather than string literals: hand-written ones drift from the function the Planner and the store both key on. */
export const firedTaskId = taskId('fall-pre-emergent', 'front-lawn');
export const deferredTaskId = taskId('deep-water-fig', 'fig-1');

function shiftDate(date: string, days: number): string {
	const shifted = new Date(`${date}T00:00:00Z`);
	shifted.setUTCDate(shifted.getUTCDate() + days);
	return shifted.toISOString().slice(0, 10);
}

function soilTemperature(date: string, value: number, basis: 'observed' | 'forecast'): DailyAggregate {
	return {
		date,
		variable: 'soil-temperature',
		depthCm: 6,
		aggregate: 'mean',
		value,
		unit: 'F',
		basis,
		provenance: 'modeled',
		source: 'open-meteo',
	};
}

// A month of trailing observed days, plus the two forecast days the sparkline
// draws past today. The window is full length rather than a token three
// entries because ADR 0003 makes its length part of what the Artifact
// promises, and a fixture that shipped three days would hide a renderer that
// cannot cope with thirty.
const observationWindow: DailyAggregate[] = [
	...Array.from({ length: OBSERVATION_WINDOW_DAYS }, (_unused, index) => {
		const offset = index - (OBSERVATION_WINDOW_DAYS - 1);
		return soilTemperature(shiftDate(ASOF, offset), Number((78 - index * 0.4).toFixed(1)), 'observed');
	}),
	soilTemperature(shiftDate(ASOF, 1), 65.4, 'forecast'),
	soilTemperature(shiftDate(ASOF, 2), 64.1, 'forecast'),
];

/** An Artifact from a run where the model was reachable and narrated the Plan. */
export const narratedArtifact: Artifact = {
	version: 1,
	generatedAt: '2026-09-11T11:04:07Z',
	plan: {
		asOf: ASOF,
		tasks: [
			{
				id: firedTaskId,
				ruleId: 'fall-pre-emergent',
				plantId: 'front-lawn',
				status: 'fired',
				citation: { kind: 'window', date: ASOF },
				deferrals: [],
				annotations: [
					{ guardId: 'water-in-after-application', text: 'Water in with a quarter inch within 48 hours.' },
				],
				delegable: false,
				tags: ['lawn', 'chemical'],
				title: 'Apply fall pre-emergent to the front lawn',
			},
			{
				id: deferredTaskId,
				ruleId: 'deep-water-fig',
				plantId: 'fig-1',
				status: 'deferred',
				citation: { kind: 'cadence', lastOccurrenceId: 'deep-water-fig-2026-08-24', elapsedDays: 18 },
				deferrals: [
					{ guardId: 'rain-expected', releaseWhen: 'No day above a 50% chance of rain in the next two days' },
				],
				annotations: [],
				delegable: true,
				tags: ['watering'],
				title: 'Deep water the fig',
			},
		],
		window: observationWindow,
	},
	narration: {
		summary: 'Soil temperature has been falling for a fortnight and crossed into pre-emergent range this week. Rain is coming Sunday, so the watering can wait.',
		tasks: [
			{ taskId: firedTaskId, text: 'Put down fall pre-emergent on the front lawn, then water it in before the weekend.' },
			{ taskId: deferredTaskId, text: 'The fig is due for a deep soak, but Sunday\'s rain should cover it.' },
		],
		advisories: [
			{ text: 'The crape myrtle by the north fence is dropping leaves early. Worth a look before the next mow.' },
		],
	},
	narrated: true,
};

/**
 * The same run with the model switched off. ADR 0001 treats this as a
 * first-class output rather than a degraded one: the Tasks are identical, only
 * the prose is missing, and that property is what makes the Planner's
 * authority checkable by diffing the two.
 */
export const unnarratedArtifact: Artifact = {
	...narratedArtifact,
	generatedAt: '2026-09-11T11:04:09Z',
	narration: null,
	narrated: false,
};
