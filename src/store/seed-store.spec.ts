import { describe, expect, it } from 'vitest';
import { describeStoreConformance, seedFixture } from './conformance';
import { createSeedStore } from './seed-store';

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

/*
 * `dump` is the one read the conformance suite never reaches here: it sits in
 * the write half, which `writable: false` skips wholesale. A read-only store
 * can still be exported, so without this the seed store's only export path
 * would ship untested.
 */
/** The instant every seeded envelope's `updatedAt` carries, mirrored from seed-store.ts. */
const SEEDED_AT = '2026-01-01T00:00:00.000Z';

describe('seed store: dump', () => {
	it('exports every seeded record, enveloped', async () => {
		const store = createSeedStore(seedFixture);

		const payload = await store.dump();

		expect(payload.version).toBe(1);
		expect(payload.collections.plants.map(row => row.id).sort())
			.toEqual(seedFixture.plants.map(plant => plant.id).sort());
		expect(payload.collections.occurrences.map(row => row.id).sort())
			.toEqual(seedFixture.occurrences.map(occurrence => occurrence.id).sort());
		expect(payload.collections.yard[0]?.record).toEqual(seedFixture.yard);
		expect(payload.collections.tagPolicy[0]?.record).toEqual(seedFixture.tagPolicy);
		expect(payload.collections.plants.every(row => row.source === 'seed')).toBe(true);
	});

	it('reports the moment of export rather than the seeding constant', async () => {
		const store = createSeedStore(seedFixture);
		const before = Date.now();

		const payload = await store.dump();
		const { exportedAt } = payload;

		// A read-only store still gets exported at a time somebody could check
		// against. Reusing the seeded `updatedAt` here would date every export to
		// whenever the constant was written.
		expect(Date.parse(exportedAt)).toBeGreaterThanOrEqual(before - 1000);
		expect(exportedAt).not.toEqual(SEEDED_AT);
		expect(payload.collections.plants[0]?.updatedAt).toEqual(SEEDED_AT);
	});
});
