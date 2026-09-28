import type { TicketGroup } from '@/components/this-week/ticket-anchor';
import type { Task } from '@/planner/task';
import { ticketAnchor } from '@/components/this-week/ticket-anchor';
import { withBasePath } from '@/lib/base-path';

/** One of a fired Rule's lines on This Week, named and addressed the way the ticket numbers it. */
export interface RuleTicketLine {
	/** "Ready now 01", as the ticket prints it. */
	label: string;
	href: string;
	plantId: string | null;
}

// Only fired and deferred work sits in the Fired band. Approaching work has its
// own band and its own group, and this page doesn't link it.
const GROUP_BY_STATUS: Partial<Record<Task['status'], TicketGroup>> = {
	fired: 'Ready now',
	deferred: 'Held back',
};

/**
 * The ticket lines one Rule's Tasks sit on, in Plan order.
 *
 * `this-week.tsx` numbers each group from one over the Plan's Tasks filtered by
 * status, so this counts the same way over the whole Plan and only then keeps
 * the Rule's own. Counting over the Rule's Tasks alone would call its first
 * line 01 wherever it sat on the ticket.
 */
export function ticketLinesFor(ruleId: string, tasks: readonly Task[]): RuleTicketLine[] {
	const counters = new Map<TicketGroup, number>();

	return tasks.flatMap((task) => {
		const group = GROUP_BY_STATUS[task.status];
		if (group === undefined) {
			return [];
		}
		const ordinal = (counters.get(group) ?? 0) + 1;
		counters.set(group, ordinal);
		if (task.ruleId !== ruleId) {
			return [];
		}
		return [{
			label: `${group} ${String(ordinal).padStart(2, '0')}`,
			href: withBasePath(`/#${ticketAnchor(group, ordinal)}`),
			plantId: task.plantId,
		}];
	});
}
