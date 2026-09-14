import type { Aggregate, Unit, Variable } from '@/weather/observation';

/*
 * The prose spellings of a series, in a module that imports nothing at runtime. `soil-sparkline.tsx` is a client chart, and `rule-summary.tsx` reaches `seedTagPolicy` and `isDelegable` to do its own job, so a chart reading the words off the summary would hang itself on the planner and the seed data. The other failure available here is two copies of `soil-temperature`'s prose spelling, where a fix to one copy always leaves the other wrong.
 */

/**
 * The enum values are wire spellings, not prose. A household member reads this in the yard, and `soil-temperature` beside `gte` reads as a dump of the JSON rather than as a sentence about the lawn. `rule-summary.tsx` and `citation.tsx` say the same words about the same series, so both read them from here.
 */
export const VARIABLE_TEXT: Record<Variable, string> = {
	'soil-temperature': 'soil temperature',
	'precipitation': 'rainfall',
	'precipitation-probability': 'chance of rain',
};

export const AGGREGATE_TEXT: Record<Aggregate, string> = {
	mean: 'mean',
	min: 'minimum',
	max: 'maximum',
	sum: 'total',
};

/**
 * The unit lives with the number it belongs to, so a caller passes the pair it read rather than the unit it assumed. `citation.tsx` takes `unit` off the DailyAggregate it is rendering, which is not necessarily the unit the Rule that cited it was written in.
 */
export function formatValue(value: number, unit: Unit): string {
	switch (unit) {
		case 'F':
			return `${value}°F`;
		case 'mm':
			return `${value} mm`;
		case 'percent':
			return `${value}%`;
	}
}
