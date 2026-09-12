import { describe, expect, it } from 'vitest';
import { describeStoreConformance, emptySeedData, seedFixture } from './conformance';
import { createFakeStore } from './fake-store';

describeStoreConformance({
	name: 'fake store',
	createStore: async data => createFakeStore(data),
	writable: true,
});

describe('fake store: implementation-specific behavior', () => {
	// The conformance suite never builds two stores from the same SeedData and
	// then writes to one, so it cannot catch a factory that hoists its tables
	// out of the closure by accident, a mistake that would make every test
	// file importing this fake share state through whichever test happened to
	// run first. A `Map` declared inside `createFakeStore` can't leak this way,
	// but the property is worth pinning down explicitly rather than trusting a
	// reading of the source.
	it('keeps two stores built from the same seed independent', async () => {
		const first = createFakeStore(seedFixture);
		const second = createFakeStore(seedFixture);

		await first.set('plants', {
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
		});

		expect(await first.get('plants', 'crape-myrtle-1')).not.toBeNull();
		expect(await second.get('plants', 'crape-myrtle-1')).toBeNull();
	});

	// `store.spec.ts` only asserts that a seeded `updatedAt` parses as ISO
	// 8601, not what value it holds, since the interface never promises one.
	// This fake specifically promises a fixed stamp instead of `new Date()`
	// (see SEEDED_AT in fake-store.ts) precisely so a dump taken from a
	// freshly-seeded store is reproducible; this test is what would fail if
	// that constant were ever swapped back out for a real clock read.
	it('seeds every record with the same fixed updatedAt, run to run', async () => {
		const firstDump = await createFakeStore(seedFixture).dump();
		const secondDump = await createFakeStore(seedFixture).dump();

		const seededTimestamps = (dump: typeof firstDump) =>
			Object.values(dump.collections)
				.flat()
				.map(envelope => envelope.updatedAt);

		expect(new Set(seededTimestamps(firstDump)).size).toBe(1);
		expect(seededTimestamps(firstDump)).toEqual(seededTimestamps(secondDump));
	});

	// Not covered by the conformance suite's round-trip test, which only loads
	// into a store started from `emptySeedData`. A restore that clobbered
	// collections the payload didn't mention would still pass that test, so
	// this checks the other half of `Store.load`'s contract: "records the
	// payload omits are left alone."
	it('leaves records untouched when load restores a payload that omits them', async () => {
		const store = createFakeStore(seedFixture);
		const emptyDump = await createFakeStore(emptySeedData).dump();

		await store.load({ ...emptyDump, collections: { ...emptyDump.collections, plants: [] } });

		expect(await store.get('plants', 'fig-1')).not.toBeNull();
	});
});
