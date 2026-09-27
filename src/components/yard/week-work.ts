import type { TicketGroup } from '@/components/this-week/ticket-anchor';
import type { Task } from '@/planner/task';
import { dayOfMonth } from '@/components/this-week/citation-line';

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
 * Every Task's line in Plan order, numbered the way This Week numbers it.
 *
 * The numbering has to match This Week exactly, or "Ready now 01" on the Yard
 * names a different Task than 01 on the ticket. `this-week.tsx` numbers each
 * group from one in Plan order, so this does the same: filter by status, keep
 * the Plan's order, count from one.
 */
function numbered(tasks: readonly Task[]): Array<TicketLine & { plantId: string | null }> {
	const counters = new Map<TicketGroup, number>();

	return tasks.map((task) => {
		const group = GROUP_BY_STATUS[task.status];
		const ordinal = (counters.get(group) ?? 0) + 1;
		counters.set(group, ordinal);
		return { group, ordinal, ruleId: task.ruleId, plantId: task.plantId };
	});
}

/**
 * Plant id to the lines this week's ticket carries for it. A Task that names
 * no Plant (yard-wide work) has no row here to hang on and is left out, so
 * the plate and the list mark only the Plants the ticket names.
 */
export function ticketLines(tasks: readonly Task[]): ReadonlyMap<string, TicketLine[]> {
	const byPlant = new Map<string, TicketLine[]>();

	for (const { plantId, ...line } of numbered(tasks)) {
		if (plantId === null) {
			continue;
		}
		const lines = byPlant.get(plantId) ?? [];
		lines.push(line);
		byPlant.set(plantId, lines);
	}

	return byPlant;
}

/**
 * The lines that reach one Plant: its own, and every yard-wide one, since a
 * Rule with no plant selector reaches every Plant (`rulesFor`). The Plant's
 * sheet reads these. The plate and the list don't, or one yard-wide Task
 * would mark every Plant as named on the ticket.
 */
export function linesReaching(tasks: readonly Task[], plantId: string): TicketLine[] {
	return numbered(tasks)
		.filter(line => line.plantId === plantId || line.plantId === null)
		.map(({ group, ordinal, ruleId }) => ({ group, ordinal, ruleId }));
}

/** "Ready now 01", the way the ticket names a line. */
export function ticketLabel(line: TicketLine): string {
	return `${line.group} ${String(line.ordinal).padStart(2, '0')}`;
}

/**
 * The Yard's line above the plate, e.g. "Plan for Sep 26 · 3 lines on this
 * week's ticket, for 2 Plants". The Plan's own date, never today's, because
 * the Yard is showing that Plan and the two can differ.
 */
export function weekLine(asOf: string, lines: ReadonlyMap<string, readonly TicketLine[]>): string {
	const count = [...lines.values()].reduce((total, plantLines) => total + plantLines.length, 0);
	const head = `Plan for ${dayOfMonth(asOf)}`;
	if (count === 0) {
		return `${head} · Nothing on this week's ticket names a Plant`;
	}
	return `${head} · ${count} ${count === 1 ? 'line' : 'lines'} on this week's ticket, for ${lines.size} ${lines.size === 1 ? 'Plant' : 'Plants'}`;
}
