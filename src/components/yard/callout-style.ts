import { cn } from '@/lib/utils';

/**
 * How a callout's chip is drawn, shared by the pins on the plate and the key
 * under it so the key can't show a chip the plate doesn't draw.
 *
 * Every chip is paper with an ink numeral, 16:1 whatever the photograph does
 * underneath. A solid border for a Plant in the ground, dashed for one only
 * planned: line style carries it rather than colour, because this is read on
 * a phone in daylight. Printed in reverse when the week's ticket names the
 * Plant, the mark a pressed cell takes, with a paper border so a reversed
 * chip in a band still has an edge on the dark scheme's ground. Plate colours,
 * not the theme's, because the photograph doesn't invert in dark mode.
 */
export function calloutFace({ planned, onTicket }: { planned: boolean; onTicket: boolean }): string {
	return cn(
		'grid size-6 place-items-center border-2 font-display text-callout leading-none font-extrabold tabular-nums',
		planned ? 'border-dashed' : 'border-solid',
		onTicket ? 'border-plate-paper bg-plate-ink text-plate-paper' : 'border-plate-ink bg-plate-paper text-plate-ink',
	);
}
