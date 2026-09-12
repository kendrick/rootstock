import type { Rule, TagPolicy } from '@/rules/rule';

/**
 * Whether a Rule's Tasks are allowed onto the Away Card. CONTEXT.md's
 * Delegable entry is explicit about the direction this reads: the tag policy
 * narrows a Rule's own `delegable` field and can never widen it. A Rule
 * tagged `chemical` stays undelegable no matter what its own field says, but
 * a Rule that already set `delegable: false` cannot be talked back into
 * `true` by an empty or unrelated `neverDelegableTags` — there is no tag list
 * that hands a task back to the household once its author refused it. That
 * asymmetry is why this checks `rule.delegable` first and short-circuits on
 * `false`, rather than computing the tag overlap first: a tag-first shape
 * would invite someone to read "no overlap" as "delegable" and skip the
 * field the author actually set.
 *
 * Reads only `neverDelegableTags`. `safetyTags` answers a different
 * question — whether a Task is dangerous enough to sort first, which is
 * `order.ts`'s `isSafetyTask` — and mixing the two lists here would make
 * whether a task-creating Rule is delegable depend on how the plan happens
 * to be ordered.
 */
export function isDelegable(rule: Rule, tagPolicy: TagPolicy): boolean {
	if (!rule.delegable) {
		return false;
	}

	return !rule.tags.some(tag => tagPolicy.neverDelegableTags.includes(tag));
}
