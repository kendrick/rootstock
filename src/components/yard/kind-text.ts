import type { Plant } from '@/yard/plant';

/**
 * How a Plant's kind reads on screen.
 *
 * Shared by the parts list and the plate's callouts so the two never drift into
 * describing the same Plant differently. CONTEXT.md is explicit that the lawn is
 * a Plant carrying lawn-specific detail rather than a record of its own kind,
 * which is why it appears here beside the others rather than as a special case.
 */
export const KIND_TEXT: Record<Plant['kind'], string> = {
	plant: 'Plant',
	container: 'Container',
	bed: 'Bed',
	lawn: 'Lawn',
};
