import type { Artifact, StatusRecord } from './artifact';
import type { DailyAggregate } from '@/planner/plan';
import { PLAN_WINDOW_DAYS } from '@/planner/plan';
import { taskId } from '@/planner/task';

/*
 * A day in the life of the real yard, shaped for tests that need an Artifact
 * without building one by hand. Everything below is typed as `Artifact`
 * rather than inferred, so a schema change breaks the fixture at compile time
 * instead of at the first assertion that happens to touch the changed field.
 *
 * Two Artifacts, because there are two Planner runs. `narratedArtifact` is the
 * September one: fired work, deferred work, and a delegable Task beside a
 * non-delegable twin, so a broken deferral or a renderer that ignores
 * delegability fails a test here rather than handing a neighbour a bag of
 * herbicide.
 *
 * The approaching case cannot join that Plan. Its Citation is a projection,
 * ADR 0003 makes the window the evidence behind a Citation, and the September
 * window already sits above the threshold `spring-pre-emergent` is waiting
 * for. A threshold line drawn under every point in a window says the work has
 * fired, whatever the status field claims. So `approachingArtifact` is a
 * second Plan on a spring date with its own rising window, which is what
 * ADR 0003 assumes when it puts the window on `Plan.window`. Only the run that
 * produced a Plan knows which days it read.
 */

const ASOF = '2026-09-11';
const SPRING_ASOF = '2026-03-02';

/** Ids come from `taskId` rather than string literals: hand-written ones drift from the function the Planner and the store both key on. */
export const firedTaskId = taskId('fall-pre-emergent', 'front-lawn');
export const deferredTaskId = taskId('deep-water-fig', 'fig-1');
export const approachingTaskId = taskId('spring-pre-emergent', 'front-lawn');
/** Named for the flag rather than the Rule: what it is here to prove is that `delegable` is true on a Task that is otherwise the twin of {@link firedTaskId}. */
export const delegableTaskId = taskId('last-nitrogen', 'front-lawn');

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
const windowFixture: DailyAggregate[] = [
	...Array.from({ length: PLAN_WINDOW_DAYS }, (_unused, index) => {
		const offset = index - (PLAN_WINDOW_DAYS - 1);
		return soilTemperature(shiftDate(ASOF, offset), Number((78 - index * 0.4).toFixed(1)), 'observed');
	}),
	soilTemperature(shiftDate(ASOF, 1), 65.4, 'forecast'),
	soilTemperature(shiftDate(ASOF, 2), 64.1, 'forecast'),
];

// The seed's `spring-pre-emergent` restated, because the window below has to be
// built against the same two numbers the Planner would read off the Rule.
const SPRING_THRESHOLD_F = 55;
const SPRING_CONSECUTIVE_DAYS = 3;

/*
 * The September window's mirror: same length, travelling the other way. Every
 * observed day sits below the Rule's 55F, since 44.0 climbing 0.36 a day tops
 * out at 54.4 on the as-of date. No run of observed history satisfies the Rule,
 * so the crossing lands in the forecast, which is the only place a projection
 * can point.
 *
 * Four forecast days rather than the September window's two, so the day the
 * third consecutive at-or-above reading falls on is not also the last entry in
 * the array. A derivation that can only ever return the end of the window
 * demonstrates nothing.
 */
const springWindowFixture: DailyAggregate[] = [
	...Array.from({ length: PLAN_WINDOW_DAYS }, (_unused, index) => {
		const offset = index - (PLAN_WINDOW_DAYS - 1);
		return soilTemperature(shiftDate(SPRING_ASOF, offset), Number((44 + index * 0.36).toFixed(1)), 'observed');
	}),
	soilTemperature(shiftDate(SPRING_ASOF, 1), 55.1, 'forecast'),
	soilTemperature(shiftDate(SPRING_ASOF, 2), 56.2, 'forecast'),
	soilTemperature(shiftDate(SPRING_ASOF, 3), 56.9, 'forecast'),
	soilTemperature(shiftDate(SPRING_ASOF, 4), 57.6, 'forecast'),
];

/*
 * Reads the projected day off the series rather than taking it on trust. A
 * literal date would let the numbers drift out from under the Citation and
 * still compile. ADR 0003 ships the window so a Citation is evidence somebody
 * can look at, so the Citation has to come out of the window rather than sit
 * beside it.
 *
 * The two throws are the fixture checking its own story at import time. A
 * crossing on an observed day means the Rule is already satisfied and the Task
 * is fired, not approaching; no crossing at all means there is nothing to
 * project. Either way this file fails to load instead of shipping a Citation
 * its own series does not support.
 */
function projectedCrossing(window: DailyAggregate[]): DailyAggregate {
	let run = 0;
	for (const day of window) {
		run = day.value >= SPRING_THRESHOLD_F ? run + 1 : 0;
		if (run === SPRING_CONSECUTIVE_DAYS) {
			if (day.basis !== 'forecast') {
				throw new Error(`spring window holds ${SPRING_THRESHOLD_F}F through observed day ${day.date}: that Task is fired, not approaching`);
			}
			return day;
		}
	}
	throw new Error(`spring window never holds ${SPRING_THRESHOLD_F}F for ${SPRING_CONSECUTIVE_DAYS} days running: there is no projection to cite`);
}

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
			/*
			 * The delegable twin of the pre-emergent Task above: same Plant, same
			 * `fired` status, same window Citation, opposite `delegable`. A
			 * renderer that drops the flag and puts every fired Task on the Away
			 * Card fails a test here instead of handing a neighbour a bag of
			 * herbicide.
			 */
			{
				id: delegableTaskId,
				ruleId: 'last-nitrogen',
				plantId: 'front-lawn',
				status: 'fired',
				citation: { kind: 'window', date: ASOF },
				deferrals: [],
				annotations: [],
				delegable: true,
				tags: ['lawn', 'fertilizer', 'nitrogen'],
				title: 'Put down the last nitrogen of the year on the front lawn',
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
		window: windowFixture,
	},
	narration: {
		summary: 'Soil temperature has been falling for a fortnight and crossed into pre-emergent range this week. Rain is coming Sunday, so the watering can wait.',
		/*
		 * Two entries for three Tasks. ADR 0001 lets Narration select and omit,
		 * and the nitrogen Task is the one left out deliberately. It is the
		 * delegable one, so dropping its prose is what makes the Away Card fall
		 * back to the Planner's mechanical `title`. ADR 0001 calls that fallback a
		 * real deliverable, and a fixture that narrated every Task would leave
		 * nothing exercising it.
		 */
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

/**
 * The spring run, which is where {@link approachingTaskId} belongs.
 * `spring-pre-emergent` is in season on this date, the window climbs toward the
 * threshold rather than away from it, and the projected day is a forecast day a
 * reader can find in that window.
 */
export const approachingArtifact: Artifact = {
	version: 1,
	generatedAt: '2026-03-02T11:04:12Z',
	plan: {
		asOf: SPRING_ASOF,
		tasks: [
			{
				id: approachingTaskId,
				ruleId: 'spring-pre-emergent',
				plantId: 'front-lawn',
				status: 'approaching',
				citation: {
					kind: 'threshold-projection',
					variable: 'soil-temperature',
					depthCm: 6,
					aggregate: 'mean',
					projectedDate: projectedCrossing(springWindowFixture).date,
				},
				deferrals: [],
				annotations: [],
				delegable: false,
				tags: ['lawn', 'herbicide', 'chemical'],
				title: 'Apply spring pre-emergent to the front lawn',
			},
		],
		window: springWindowFixture,
	},
	/*
	 * No narration here. ADR 0001's diff property needs the narrated and
	 * unnarrated Artifacts to share one Plan, and the September pair above
	 * already does that job. Prose on this Artifact would only hand every test
	 * that reaches for the projection a second thing to control for.
	 */
	narration: null,
	narrated: false,
};

/** The record beside a run that published. `artifactGeneratedAt` is read off the Artifact rather than retyped, so the pair cannot drift apart when either timestamp is edited. */
export const okStatus: StatusRecord = {
	attemptedAt: '2026-09-11T11:04:11Z',
	ok: true,
	error: null,
	artifactGeneratedAt: unnarratedArtifact.generatedAt,
	consecutiveFailures: 0,
};

/**
 * Three nights of failure in a row, which is the case the count exists for: the
 * site can say the last three runs failed instead of only that the data is old,
 * and only the first of those tells a reader to go look at the box.
 *
 * `artifactGeneratedAt` still names the last Artifact that did publish. A failed
 * run does not erase the file the site is serving, and a null here would make
 * the interface render "no data" over an Artifact that is sitting right there.
 */
export const failingStatus: StatusRecord = {
	attemptedAt: '2026-09-14T11:03:58Z',
	ok: false,
	error: 'open-meteo: 503 Service Unavailable after 3 attempts',
	artifactGeneratedAt: unnarratedArtifact.generatedAt,
	consecutiveFailures: 3,
};
