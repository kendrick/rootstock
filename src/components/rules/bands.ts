import type { Band, RuleStanding } from './waiting';

export interface BandHeading {
	band: Band;
	label: string;
	note: string;
}

/**
 * The band headings, in the order a reader asks for them.
 *
 * Each says what the band means rather than naming a state, because "waiting"
 * alone leaves a reader guessing whether the yard is broken or simply out of
 * season.
 */
export const BANDS: readonly BandHeading[] = [
	{ band: 'fired', label: 'Fired this week', note: 'These produced work on the current Plan.' },
	{ band: 'approaching', label: 'Approaching', note: 'The Planner expects these to be satisfied. A forecast can be revised, so nothing here has fired.' },
	{ band: 'waiting', label: 'Waiting', note: 'Out of season, waiting on a reading, or not yet due. Every one of them is still in the rule set.' },
	{ band: 'guard', label: 'Guards', note: 'These create no work. Each one can defer or annotate work another Rule asked for, and names every Task it reached this week.' },
];

/** The id a band's heading carries, which the band index links to. */
export function bandAnchor(band: Band): string {
	return `band-${band}`;
}

/**
 * The bands with a Rule in them, in page order. The list and the index both
 * read this, so the index can't offer a jump to a band the page didn't draw.
 */
export function drawnBands(ranked: readonly RuleStanding[]): BandHeading[] {
	return BANDS.filter(({ band }) => ranked.some(standing => standing.band === band));
}
