import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ruleSchema, tagPolicySchema } from '@/rules/rule';
import { observationSchema } from '@/weather/observation';
import { plantSchema } from '@/yard/plant';
import { asOf, observations, occurrences, plants, rules, tagPolicy, timeZone } from './fixtures';
import { occurrenceSchema } from './occurrence';
import { plan, planInputSchema } from './planner';

/*
 * The fixtures are parsed where they are authored, so re-parsing them here
 * says nothing new about the parse. It holds the fixture file to the schemas
 * the rest of the system uses: later specs read these values as the real
 * thing, and the moment a fixture is patched with a cast to make a test go
 * green, this file fails.
 *
 * The coverage assertions below do the other half of the job. Each one names a
 * case the Planner has to handle and a tidy-up would delete without noticing.
 */

const planInput = {
	asOf,
	timeZone,
	plants,
	rules,
	observations,
	occurrences,
	tagPolicy,
};

describe('the planner fixtures', () => {
	it('parse as plants', () => {
		expect(() => z.array(plantSchema).parse(plants)).not.toThrow();
	});

	it('parse as rules', () => {
		expect(() => z.array(ruleSchema).parse(rules)).not.toThrow();
	});

	it('parse as observations', () => {
		expect(() => z.array(observationSchema).parse(observations)).not.toThrow();
	});

	it('parse as occurrences', () => {
		expect(() => z.array(occurrenceSchema).parse(occurrences)).not.toThrow();
	});

	it('parse as a tag policy', () => {
		expect(() => tagPolicySchema.parse(tagPolicy)).not.toThrow();
	});

	it('hold a plant that is only planned', () => {
		expect(plants.some(plant => plant.status === 'planned')).toBe(true);
	});

	it('hold a window rule whose range crosses the year end', () => {
		const wrapping = rules.filter(rule => rule.kind === 'window').filter(rule => rule.end < rule.start);
		expect(wrapping).not.toHaveLength(0);
	});

	it('hold a cadence rule with occurrences behind it and one with none', () => {
		const cadences = rules.filter(rule => rule.kind === 'cadence');
		const withHistory = cadences.filter(rule => occurrences.some(occurrence => occurrence.ruleId === rule.id));
		expect(withHistory).not.toHaveLength(0);
		expect(withHistory.length).toBeLessThan(cadences.length);
	});

	it('hold only hourly observations, never a daily figure', () => {
		const perDay = new Map<string, number>();
		for (const observation of observations) {
			const day = observation.observedAt.slice(0, 10);
			perDay.set(day, (perDay.get(day) ?? 0) + 1);
		}
		expect([...perDay.values()].every(count => count > 1)).toBe(true);
	});

	// Compared as instants rather than by the date in the string. A Texas
	// evening on the as-of date is already tomorrow in UTC, which is why
	// `timeZone` is an input, and why a day-string comparison here would call
	// the fixture broken when it is right.
	it('run past the observed days on forecast', () => {
		const forecast = observations.filter(observation => observation.basis === 'forecast');
		const observed = observations.filter(observation => observation.basis === 'observed');
		expect(forecast).not.toHaveLength(0);

		const lastObserved = observed.map(observation => observation.observedAt).sort().at(-1) ?? '';
		expect(forecast.every(observation => observation.observedAt > lastObserved)).toBe(true);
	});

	it('hold a measured observation alongside the modeled ones for its day', () => {
		const measured = observations.filter(observation => observation.provenance === 'measured');
		expect(measured).not.toHaveLength(0);
		expect(measured.every(observation => observation.source === 'manual')).toBe(true);

		const measuredDays = new Set(measured.map(observation => observation.observedAt.slice(0, 10)));
		const modeledOnTheSameDay = observations.filter(
			observation => observation.provenance === 'modeled' && measuredDays.has(observation.observedAt.slice(0, 10)),
		);
		expect(modeledOnTheSameDay).not.toHaveLength(0);
	});
});

describe('planInputSchema', () => {
	it('accepts the assembled fixture input', () => {
		expect(() => planInputSchema.parse(planInput)).not.toThrow();
	});

	it('rejects a time zone that is not a zone name', () => {
		expect(() => planInputSchema.parse({ ...planInput, timeZone: 'Amerika/Chicago' })).toThrow();
	});

	it('rejects an unknown key', () => {
		expect(() => planInputSchema.parse({ ...planInput, weather: [] })).toThrow();
	});

	it('rejects a plan input missing its time zone', () => {
		const { timeZone: _dropped, ...withoutZone } = planInput;
		expect(() => planInputSchema.parse(withoutZone)).toThrow();
	});
});

describe('plan', () => {
	it('refuses to answer until it is implemented', () => {
		expect(() => plan(planInputSchema.parse(planInput))).toThrow('plan() is not implemented yet');
	});
});
