/** The This Week group a Task sits in, named as that page names it. */
export type TicketGroup = 'Ready now' | 'Approaching' | 'Held back';

/**
 * The fragment a ticket line answers to, e.g. `ready-now-01`. This Week puts
 * it on the row and the Yard links to it, and both build it here so the link
 * can't land on a different line from the one it names.
 */
export function ticketAnchor(group: TicketGroup, ordinal: number): string {
	return `${group.toLowerCase().replace(' ', '-')}-${String(ordinal).padStart(2, '0')}`;
}
