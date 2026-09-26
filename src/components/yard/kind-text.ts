import type { Plant } from '@/yard/plant';

/**
 * How a Plant's kind reads on screen.
 *
 * Two containers on the same patio look identical until this word tells them
 * apart, so it's never left to styling. Shared by the parts list, the plate's
 * callouts and the plant sheet, so no two of them describe one Plant
 * differently. CONTEXT.md is explicit that the lawn is
 * a Plant carrying lawn-specific detail rather than a record of its own kind,
 * which is why it appears here beside the others rather than as a special case.
 */
export const KIND_TEXT: Record<Plant['kind'], string> = {
	plant: 'Plant',
	container: 'Container',
	bed: 'Bed',
	lawn: 'Lawn',
};
