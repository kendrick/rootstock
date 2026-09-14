/**
 * The one focus treatment in the shell.
 *
 * Header nav links carried no ring utility and fell through to Chrome's UA
 * outline at 3.32:1, while app controls drew a strong ring of their own. That
 * gave one keyboard user two different answers to "where am I" on a single
 * page. Both import this string, so the two cannot drift apart again.
 *
 * `focus-visible` rather than `focus`: a ring that also fires on a mouse click
 * trains sighted users to ignore it, which costs the keyboard user the signal.
 * The offset colour is not set here. globals.css points
 * `--tw-ring-offset-color` at the page, because Tailwind's white default put a
 * halo around every focused control on a near-black shell.
 */
export const FOCUS_RING
	= 'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
