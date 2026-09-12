import type { Occurrence } from '@/planner/occurrence';
import type { Rule, TagPolicy } from '@/rules/rule';
import type { Plant, Yard } from '@/yard/plant';
import { z } from 'zod';
import { occurrenceSchema } from '@/planner/occurrence';
import { ruleSchema, tagPolicySchema } from '@/rules/rule';
import { parseWith } from '@/validation/parse';
import { plantSchema, yardSchema } from '@/yard/plant';
import occurrencesJson from './occurrences.json';
import plantsJson from './plants.json';
import rulesJson from './rules.json';
import tagPolicyJson from './tag-policy.json';
import yardJson from './yard.json';

/**
 * The seed files are the only inventory, rule set, and tag policy this repo
 * ships, so a typo in one of them is not a test failure somebody can shrug
 * off — it is the data the Planner would run on. Parsing them through the
 * frozen schemas at module scope, rather than lazily on first use, means a
 * malformed file throws the moment anything imports this module instead of
 * surfacing as a confusing failure deep inside the Planner or a build script.
 *
 * `plants.json`, `rules.json`, and `occurrences.json` each hold a JSON array
 * of one seed record, so parsing them needs `z.array` of the single-record
 * schema the owning module exports. Composing that here is not an edit to
 * the frozen schema — `plantSchema` still describes exactly one Plant — it is
 * just the shape the file itself is in.
 */
export const seedYard: Yard = parseWith(yardSchema, 'yard.json')(yardJson);
export const seedPlants: Plant[] = parseWith(z.array(plantSchema), 'plants.json')(plantsJson);
export const seedRules: Rule[] = parseWith(z.array(ruleSchema), 'rules.json')(rulesJson);
export const seedOccurrences: Occurrence[] = parseWith(z.array(occurrenceSchema), 'occurrences.json')(occurrencesJson);
export const seedTagPolicy: TagPolicy = parseWith(tagPolicySchema, 'tag-policy.json')(tagPolicyJson);

/**
 * Each of `plantSchema`, `ruleSchema`, and `occurrenceSchema` only enforces
 * that ids are shaped like a kebab id — none of them can see the other two
 * lists to check against. A plant and a rule sharing an id would still parse
 * cleanly on their own, and would only surface as a bug the day something
 * looks a record up by bare id and gets the wrong kind of thing back. This
 * walks all three id spaces together because the schemas cannot.
 */
export function findDuplicateIds(plants: Plant[], rules: Rule[], occurrences: Occurrence[]): string[] {
	const seen = new Set<string>();
	const duplicates = new Set<string>();
	for (const id of [...plants.map(p => p.id), ...rules.map(r => r.id), ...occurrences.map(o => o.id)]) {
		if (seen.has(id)) {
			duplicates.add(id);
		}
		seen.add(id);
	}
	return [...duplicates];
}

/**
 * `appliesToSchema`, `cadenceRuleSchema`, and `occurrenceSchema` each store an
 * id as a plain kebab-string, by design (occurrence.ts is explicit that it
 * stays dependency-free rather than importing Rule or Plant). That means
 * nothing at parse time can tell a real reference from a typo — a
 * `plantIds` entry, an `after.ruleId`, or an Occurrence's `ruleId`/`plantId`
 * all resolve only by looking them up against the other seed lists, which is
 * what this does.
 */
export function findUnresolvedReferences(plants: Plant[], rules: Rule[], occurrences: Occurrence[]): string[] {
	const plantIds = new Set(plants.map(p => p.id));
	const ruleIds = new Set(rules.map(r => r.id));
	const problems: string[] = [];

	for (const rule of rules) {
		for (const plantId of rule.appliesTo.plantIds ?? []) {
			if (!plantIds.has(plantId)) {
				problems.push(`rule '${rule.id}' appliesTo.plantIds names unknown plant '${plantId}'`);
			}
		}
		if (rule.kind === 'cadence' && rule.after !== null && !ruleIds.has(rule.after.ruleId)) {
			problems.push(`rule '${rule.id}' after.ruleId names unknown rule '${rule.after.ruleId}'`);
		}
	}

	for (const occurrence of occurrences) {
		if (!ruleIds.has(occurrence.ruleId)) {
			problems.push(`occurrence '${occurrence.id}' ruleId names unknown rule '${occurrence.ruleId}'`);
		}
		if (occurrence.plantId !== null && !plantIds.has(occurrence.plantId)) {
			problems.push(`occurrence '${occurrence.id}' plantId names unknown plant '${occurrence.plantId}'`);
		}
	}

	return problems;
}

/**
 * ADR 0003 fixes the window as a budget the Rules must fit inside, not a
 * ceiling the Rules get clipped to: "the fix is to widen the window rather
 * than to shorten the Rule." It also names the gap left open — nothing
 * detects a Rule that already reaches past the window it ships with. This is
 * that detector: a Threshold Rule's `consecutiveDays` and a `no-rain-within`
 * Guard's `days` both read backward from today, and either one exceeding
 * `windowDays` would ask the Planner to cite a day the Artifact never
 * carried.
 */
export function findRulesPastWindow(rules: Rule[], windowDays: number): string[] {
	const problems: string[] = [];
	for (const rule of rules) {
		if (rule.kind === 'threshold' && rule.consecutiveDays > windowDays) {
			problems.push(`threshold rule '${rule.id}' needs ${rule.consecutiveDays} consecutive days, past the ${windowDays}-day window`);
		}
		if (rule.kind === 'guard' && rule.condition.kind === 'no-rain-within' && rule.condition.days > windowDays) {
			problems.push(`guard rule '${rule.id}' no-rain-within needs ${rule.condition.days} days, past the ${windowDays}-day window`);
		}
	}
	return problems;
}

// Requires the digits to sit directly after `:`, `,`, or `[` (only whitespace
// between) and directly before `,`, `]`, or `}` — the positions a bare JSON
// numeric literal can occupy. A decimal buried inside a quoted string (a URL,
// a product label name) sits behind a `"` instead, which this never matches.
const LONG_DECIMAL = /(?<=[:,[]\s*)-?\d+\.\d{3,}(?=\s*[,\]}])/g;

const COORDINATE_KEY = /lat|lon|lng|coord/i;

/**
 * ADR 0004 keeps exact coordinates out of the repository entirely; the seed
 * data records a city and a hardiness zone instead. `no-coordinates.spec.ts`
 * already walks the generated JSON Schema for a field shaped like a
 * coordinate, but a schema walk cannot see a value — a `notes` field typed
 * `string` could still hold "32.7357, -97.1081" and pass every schema check
 * there is. Reading the committed file as text, rather than the values Zod
 * parsed out of it, is what makes this catch what the schema walk cannot: a
 * decimal precise enough to be a coordinate, wherever in the file it landed.
 */
export function findLongDecimals(json: string): string[] {
	return json.match(LONG_DECIMAL) ?? [];
}

/** Same reasoning as {@link findLongDecimals}, for a key name instead of a value. */
export function findCoordinateKeys(json: string): string[] {
	const keys: string[] = [];
	for (const match of json.matchAll(/"([^"]+)"\s*:/g)) {
		const key = match[1];
		if (key !== undefined && COORDINATE_KEY.test(key)) {
			keys.push(key);
		}
	}
	return keys;
}
