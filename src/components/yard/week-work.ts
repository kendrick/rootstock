import type { TicketGroup } from '@/components/this-week/ticket-anchor';
import type { Task } from '@/planner/task';

export type { TicketGroup };

export interface TicketLine {
	group: TicketGroup;
	/** The Task's line number within its group, as the ticket prints it. */
	ordinal: number;
	ruleId: string;
}

const GROUP_BY_STATUS: Record<Task['status'], TicketGroup> = {
	fired: 'Ready now',
	approaching: 'Approaching',
	deferred: 'Held back',
};

/**
 * Plant id to the lines this week's ticket carries for it.
 *
 * The numbering has to match This Week exactly, or "Ready now 01" on the Yard
 * names a different Task than 01 on the ticket. `this-week.tsx` numbers each
 * group from one in Plan order, so this does the same: filter by status, keep
 * the Plan's order, count from one. A Task that names no Plant (yard-wide
 * work) has no row here to hang on and is left out.
 */
export function ticketLines(tasks: readonly Task[]): ReadonlyMap<string, TicketLine[]> {
	const byPlant = new Map<string, TicketLine[]>();
	const counters = new Map<TicketGroup, number>();

	for (const task of tasks) {
		const group = GROUP_BY_STATUS[task.status];
		const ordinal = (counters.get(group) ?? 0) + 1;
		counters.set(group, ordinal);

		if (task.plantId === null) {
			continue;
		}

		const lines = byPlant.get(task.plantId) ?? [];
		lines.push({ group, ordinal, ruleId: task.ruleId });
		byPlant.set(task.plantId, lines);
	}

	return byPlant;
}

/** "Ready now 01", the way the ticket names a line. */
export function ticketLabel(line: TicketLine): string {
	return `${line.group} ${String(line.ordinal).padStart(2, '0')}`;
}
