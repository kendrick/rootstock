import { describe, expect, it } from 'vitest';
import { occurrenceSchema } from '@/planner/occurrence';
import { emptySeedData } from './conformance';
import { createFakeStore } from './fake-store';
import { recordOccurrence } from './occurrence';

/**
 * Advances through a fixed list of instants, one per call. A test proving
 * that two writes get two distinct `recordedAt` values must not depend on
 * `Date.now()` moving between them. On a fast machine two real calls can
 * land in the same millisecond and produce the identical ISO string, which
 * is exactly the flake `occurrence.ts`'s doc comment calls out.
 */
function fakeClock(...isoInstants: string[]): () => Date {
	const instants = [...isoInstants];
	return () => {
		const next = instants.shift();
		if (next === undefined) {
			throw new Error('fakeClock ran out of instants: give it one per call it needs to serve.');
		}
		return new Date(next);
	};
}

/** Hands out fixed, distinct kebab-legal ids in order, standing in for `crypto.randomUUID`. */
function fakeIds(...ids: string[]): () => string {
	const values = [...ids];
	return () => {
		const next = values.shift();
		if (next === undefined) {
			throw new Error('fakeIds ran out of ids: give it one per call it needs to serve.');
		}
		return next;
	};
}

describe('recordOccurrence', () => {
	it('mints a UUID id and a recordedAt, and writes through Store.set', async () => {
		const store = createFakeStore(emptySeedData);

		const written = await recordOccurrence(store, {
			ruleId: 'fall-pre-emergent',
			plantId: null,
			completedAt: '2026-09-10T00:00:00Z',
		});

		expect(written.record.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
		expect(written.record.recordedAt).toEqual(new Date(written.record.recordedAt).toISOString());

		const stored = await store.get('occurrences', written.record.id);
		expect(stored).toEqual(written);
	});

	it('records the same work twice as two records with distinct ids and timestamps, and keeps the first unchanged', async () => {
		const store = createFakeStore(emptySeedData);
		// The clock advances between the two calls, which is what makes the
		// distinct-timestamp claim falsifiable: a function that stamped once and
		// reused the value would fail here, and could not be caught by a test
		// racing the real clock.
		const now = fakeClock('2026-09-10T08:00:00.000Z', '2026-09-10T08:00:01.000Z');
		const generateId = fakeIds('occurrence-one', 'occurrence-two');
		const input = { ruleId: 'esperanza-feeding', plantId: 'esperanza-1', completedAt: '2026-09-10T00:00:00Z' };

		const first = await recordOccurrence(store, input, { now, generateId });
		const second = await recordOccurrence(store, input, { now, generateId });

		expect(first.record.id).not.toEqual(second.record.id);
		expect(first.record.recordedAt).not.toEqual(second.record.recordedAt);
		expect(second.record.recordedAt > first.record.recordedAt, 'the later write carries the later stamp').toBe(true);

		const stillFirst = await store.get('occurrences', first.record.id);
		const stillSecond = await store.get('occurrences', second.record.id);
		expect(stillFirst).toEqual(first);
		expect(stillSecond).toEqual(second);
	});

	it('records two separate occurrences even when both land in the same instant', async () => {
		const store = createFakeStore(emptySeedData);
		// The case a real clock produces by accident on a fast machine. Two
		// recordings sharing a millisecond are still two Occurrences, because the
		// id is what separates them and it is minted per call. A store that keyed
		// on the timestamp would lose one here.
		const now = fakeClock('2026-09-10T08:00:00.000Z', '2026-09-10T08:00:00.000Z');
		const generateId = fakeIds('occurrence-one', 'occurrence-two');
		const input = { ruleId: 'esperanza-feeding', plantId: 'esperanza-1', completedAt: '2026-09-10T00:00:00Z' };

		const first = await recordOccurrence(store, input, { now, generateId });
		const second = await recordOccurrence(store, input, { now, generateId });

		expect(first.record.recordedAt).toEqual(second.record.recordedAt);
		expect(first.record.id).not.toEqual(second.record.id);
		expect((await store.list('occurrences')).map(row => row.id).sort()).toEqual(['occurrence-one', 'occurrence-two']);
	});

	it('rejects a repeat Store.set carrying an occurrence id already on file', async () => {
		const store = createFakeStore(emptySeedData);

		const written = await recordOccurrence(store, {
			ruleId: 'fall-pre-emergent',
			plantId: null,
			completedAt: '2026-09-10T00:00:00Z',
		});

		// The append-only check lives on Store.set, not in this module. Exercising
		// it here, from a record recordOccurrence itself produced, is what pins
		// down that marking work done can never mutate an existing Occurrence:
		// the only route back to that id rejects.
		await expect(store.set('occurrences', written)).rejects.toThrow();

		expect(await store.get('occurrences', written.record.id)).toEqual(written);
	});

	it('writes a record that parses against the frozen occurrenceSchema', async () => {
		const store = createFakeStore(emptySeedData);

		const written = await recordOccurrence(store, {
			ruleId: 'fall-pre-emergent',
			plantId: 'fig-1',
			completedAt: '2026-09-10T00:00:00Z',
		});

		expect(() => occurrenceSchema.parse(written.record)).not.toThrow();
		expect(written.record.source).toEqual('browser');
	});
});
