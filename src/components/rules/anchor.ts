import type { Occurrence } from '@/planner/occurrence';
import type { Rule } from '@/rules/rule';
import type { Plant } from '@/yard/plant';
import { MONTHS } from '@/planner/dates';
import { targets } from '@/planner/targets';

/**
 * The Occurrence a follow-up counts from, or null when the Rule it follows has
 * none on record for any Plant the follow-up reaches.
 *
 * Same choice as `findAnchor` in `cadence-rule.ts`, which isn't exported: the
 * anchor Rule's id, the Plant the Task would be for (null for a whole-yard
 * Rule), greatest `completedAt`, then greatest `id`. Where a follow-up reaches
 * several Plants the Planner anchors each apart, so this takes the latest of
 * them, which is the one the soonest Task would count from.
 */
export function anchorFor(rule: Rule, occurrences: readonly Occurrence[], plants: readonly Plant[]): Occurrence | null {
	if (rule.kind !== 'cadence' || rule.after === null) {
		return null;
	}
	const anchorRuleId = rule.after.ruleId;
	const reached = targets(rule, [...plants]).plants;
	const plantIds = new Set(reached === null ? [null] : reached.map(plant => plant.id));

	let anchor: Occurrence | null = null;
	for (const occurrence of occurrences) {
		if (occurrence.ruleId !== anchorRuleId || !plantIds.has(occurrence.plantId)) {
			continue;
		}
		if (
			anchor === null
			|| occurrence.completedAt > anchor.completedAt
			|| (occurrence.completedAt === anchor.completedAt && occurrence.id > anchor.id)
		) {
			anchor = occurrence;
		}
	}

	return anchor;
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
