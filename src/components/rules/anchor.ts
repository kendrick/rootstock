import type { Occurrence } from '@/planner/occurrence';
import type { Rule } from '@/rules/rule';
import type { Plant } from '@/yard/plant';
import { MONTHS } from '@/planner/dates';
import { targets } from '@/planner/targets';

export interface FollowUpAnchor {
	occurrence: Occurrence;
	/** The Plant it's for, where the follow-up reaches more than one. Null otherwise. */
	plantName: string | null;
}

function later(left: Occurrence, right: Occurrence): boolean {
	return left.completedAt > right.completedAt || (left.completedAt === right.completedAt && left.id > right.id);
}

/**
 * The Occurrence the follow-up's next Task counts from, or null when the Rule
 * it follows has none on record for any Plant the follow-up reaches.
 *
 * Per Plant, the same choice as `findAnchor` in `cadence-rule.ts`, which isn't
 * exported: the anchor Rule's id, that Plant (null for a whole-yard Rule),
 * greatest `completedAt`, then greatest `id`. The Planner anchors each Plant
 * on its own record, so across Plants the earliest of those comes due first.
 * The newest across all of them would cite a date no Task counts from.
 */
export function anchorFor(rule: Rule, occurrences: readonly Occurrence[], plants: readonly Plant[]): FollowUpAnchor | null {
	if (rule.kind !== 'cadence' || rule.after === null) {
		return null;
	}
	const anchorRuleId = rule.after.ruleId;
	const reached = targets(rule, [...plants]).plants;
	const plantIds: (string | null)[] = reached === null ? [null] : reached.map(plant => plant.id);

	const latestByPlant = new Map<string | null, Occurrence>();
	for (const occurrence of occurrences) {
		if (occurrence.ruleId !== anchorRuleId || !plantIds.includes(occurrence.plantId)) {
			continue;
		}
		const current = latestByPlant.get(occurrence.plantId);
		if (current === undefined || later(occurrence, current)) {
			latestByPlant.set(occurrence.plantId, occurrence);
		}
	}

	let first: Occurrence | null = null;
	for (const occurrence of latestByPlant.values()) {
		if (first === null || later(first, occurrence)) {
			first = occurrence;
		}
	}
	if (first === null) {
		return null;
	}

	const plantName = plantIds.length > 1
		? plants.find(plant => plant.id === first.plantId)?.name ?? first.plantId
		: null;

	return { occurrence: first, plantName };
}

/**
 * "March 3, 2026". The UTC day, the slice This Week's record line and
 * `isCompleted` use. The year stays, because an anchor can be last year's.
 */
export function recordedDay(occurrence: Occurrence): string {
	const [year, month, day] = occurrence.completedAt.slice(0, 10).split('-');
	const name = month === undefined ? undefined : MONTHS[Number(month) - 1];

	return name === undefined || day === undefined ? occurrence.completedAt.slice(0, 10) : `${name} ${Number(day)}, ${year}`;
}
