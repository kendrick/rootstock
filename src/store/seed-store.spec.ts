import { describe, expect, it } from 'vitest';
import { createSeedStore } from './seed-store';
import { describeStoreConformance, seedFixture } from './store.spec';

describeStoreConformance({
	name: 'seed store',
	createStore: async data => createSeedStore(data),
	writable: false,
});

/*
 * The conformance suite skips the write half entirely when `writable` is
 * false, per its own doc comment: rejecting every write is a different
 * contract from having no write path, so proving the rejection is this
 * spec's job rather than the shared suite's.
 */
describe('seed store: writes', () => {
	it('rejects a set with a full-sentence reason', async () => {
		const store = createSeedStore(seedFixture);

		await expect(store.set('plants', {
			id: 'crape-myrtle-1',
			updatedAt: '2026-09-12T15:04:00Z',
			source: 'browser',
			record: {
				id: 'crape-myrtle-1',
				name: 'Crape myrtle',
				kind: 'plant',
				status: 'planted',
				tags: ['tree'],
				position: null,
				site: 'north fence',
				lawn: null,
				notes: null,
			},
		})).rejects.toThrow(/read-only.*\.$/s);
	});

	it('rejects a load with a full-sentence reason', async () => {
		const store = createSeedStore(seedFixture);

		await expect(store.load({})).rejects.toThrow(/read-only.*\.$/s);
	});
});
