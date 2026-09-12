import type { Collection } from './store';
import { describe, expect, it } from 'vitest';
import { COLLECTIONS } from './store';

describe('collection names', () => {
	// The five names are a value as well as a type, and only this catches the
	// day someone adds a sixth to the type map and not to the array.
	it('lists every key of the collection map', () => {
		const map: Record<Collection, true> = { yard: true, plants: true, rules: true, occurrences: true, tagPolicy: true };

		expect(COLLECTIONS.slice().sort()).toEqual(Object.keys(map).sort());
	});
});
