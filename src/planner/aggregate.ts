import type { DailyAggregate } from './plan';
import type { Aggregate, Observation } from '@/weather/observation';
import { localDate } from './dates';

/**
 * One group's worth of Observations sharing a variable, depth, and local day,
 * plus the day itself. Keyed on a string rather than the triple directly
 * because a `Map` needs a comparable key, and `depthCm` being nullable means
 * the natural key isn't a primitive on its own—see `groupKey` below.
 */
interface Group {
	date: string;
	variable: Observation['variable'];
	depthCm: number | null;
	observations: Observation[];
}

/**
 * `depthCm` is `null` for a variable like precipitation that has no depth at
 * all, and `null` has to be its own group rather than collapsing into 0 or
 * into whatever depth happens to be first—two Observations at different
 * depths (or no depth) are never the same series. Template-literal joining
 * turns the nullable field into a stable string without a sentinel value that
 * could collide with a real depth.
 */
function groupKey(date: string, variable: Observation['variable'], depthCm: number | null): string {
	return `${date} ${variable} ${depthCm === null ? 'null' : depthCm}`;
}

function mean(values: number[]): number {
	return values.reduce((total, value) => total + value, 0) / values.length;
}

function reduce(values: number[], aggregate: Aggregate): number {
	switch (aggregate) {
		case 'mean':
			return mean(values);
		case 'min':
			return Math.min(...values);
		case 'max':
			return Math.max(...values);
		case 'sum':
			return values.reduce((total, value) => total + value, 0);
	}
}

/**
 * Decimal places `plan()` in `planner.ts` rounds `Plan.window` to, right
 * before it returns—not a precision this file applies.
 *
 * `toDailyAggregates` reduces to a raw value on purpose. Every Rule and
 * Guard reads its output before anything rounds, and `meetsThreshold`
 * compares that raw value against a Rule's `value` with an inclusive
 * gte/lte. Rounding here instead would settle that comparison on a
 * reading no longer exact: a raw 54.996 would round to 55.0 and fire
 * `gte 55` a day before the yard actually crossed it, which is the
 * defect #59's own notes name as the one to avoid. `Plan.window` carries
 * no such risk—nothing reads it again for a verdict—so this precision
 * applies there instead, after every Rule and Guard already has the raw
 * number.
 *
 * Soil temperature is compared against a Rule's `value` in whole
 * degrees, and precipitation probability compares in whole percentage
 * points, so a tenth is one digit more than either needs. Full float
 * precision buys nothing past that: the extra digits are what's left
 * over from dividing by twenty-four hourly readings, and they are what
 * churned `daily-run.sh`'s commit every morning.
 */
export const AGGREGATE_DECIMAL_PLACES = 1;

/**
 * Rounds `value` to `AGGREGATE_DECIMAL_PLACES`, adding decimals wherever rounding would move it onto or across one of `lines`. Returns `value` unrounded if four extra places still would.
 *
 * A raw 54.96 correctly doesn't fire `gte 55`, and a 55.0 printed beside that Rule tells the reader the line was reached. ADR 0003 says the window carries what the Rules evaluated, so the Planner emitting the window and every view printing a reading against a line round through here, and a view can't undo the Planner's care by re-rounding.
 */
export function roundKeepingSide(value: number, lines: readonly number[]): number {
	for (let places = AGGREGATE_DECIMAL_PLACES; places <= AGGREGATE_DECIMAL_PLACES + 4; places++) {
		const rounded = Number(value.toFixed(places));
		if (lines.every(line => Math.sign(value - line) === Math.sign(rounded - line))) {
			return rounded;
		}
	}

	return value;
}

/**
 * Every `Group` is seeded with the Observation that created it, so `used`
 * (a filter of a group, or the group itself) can never be empty in practice.
 * `noUncheckedIndexedAccess` can't see that invariant, though, so this makes
 * the "impossible" case an explicit throw instead of a silent `undefined`
 * leaking into the returned record.
 */
function first(observations: Observation[]): Observation {
	const [head] = observations;
	if (head === undefined) {
		throw new Error('aggregate group has no observations, which should be impossible by construction');
	}
	return head;
}

function compareDepth(left: number | null, right: number | null): number {
	if (left === right) {
		return 0;
	}
	if (left === null) {
		return 1;
	}
	if (right === null) {
		return -1;
	}
	return left - right;
}

/**
 * Reduces a run of hourly Observations to one DailyAggregate per local day,
 * per variable, per depth. The Planner is the only place this reduction
 * happens: an Observation is one reading at one moment, and folding a day's
 * worth of them into a mean, a min, or a sum is a decision that belongs to
 * whichever Rule is about to read the result, not to the weather layer that
 * produced the readings.
 *
 * `timeZone` exists because an Observation's `observedAt` is a UTC instant
 * and a Rule is written about local days—a soil reading taken at 7pm in
 * North Texas is already tomorrow in UTC, and bucketing on the instant's own
 * date would silently shift every evening reading onto the wrong day.
 */
export function toDailyAggregates(
	observations: Observation[],
	timeZone: string,
	aggregate: Aggregate,
): DailyAggregate[] {
	const groups = new Map<string, Group>();

	for (const observation of observations) {
		const date = localDate(observation.observedAt, timeZone);
		const key = groupKey(date, observation.variable, observation.depthCm);
		const existing = groups.get(key);
		if (existing === undefined) {
			groups.set(key, { date, variable: observation.variable, depthCm: observation.depthCm, observations: [observation] });
		}
		else {
			existing.observations.push(observation);
		}
	}

	const results = Array.from(groups.values()).map((group): DailyAggregate => {
		const basis = group.observations.some(observation => observation.basis === 'forecast') ? 'forecast' : 'observed';

		/*
		 * A hand-taken probe reading beats a modeled grid-cell estimate for
		 * the same day: averaging the two in would let the model's guess
		 * drag down a number someone actually measured. The filter runs
		 * after `basis` is decided, because a day that mixes an observed
		 * probe with a forecast model reading is still partly predicted
		 * regardless of which value wins below.
		 */
		const measured = group.observations.filter(observation => observation.provenance === 'measured');
		const used = measured.length > 0 ? measured : group.observations;
		const provenance = measured.length > 0 ? 'measured' : 'modeled';

		const values = used.map(observation => observation.value);
		const representative = first(used);

		return {
			date: group.date,
			variable: group.variable,
			depthCm: group.depthCm,
			aggregate,
			value: reduce(values, aggregate),
			unit: representative.unit,
			basis,
			provenance,
			source: representative.source,
		};
	});

	results.sort((left, right) => {
		if (left.date !== right.date) {
			return left.date < right.date ? -1 : 1;
		}
		if (left.variable !== right.variable) {
			return left.variable < right.variable ? -1 : 1;
		}
		return compareDepth(left.depthCm, right.depthCm);
	});

	return results;
}
