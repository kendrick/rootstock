import type { Collection, SeedData, Store, StoredRecord } from './store';
import type { Occurrence } from '@/planner/occurrence';
import type { Rule } from '@/rules/rule';
import type { Plant, Region, Yard } from '@/yard/plant';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { COLLECTIONS, TAG_POLICY_ID } from './store';

/*
 * The conformance suite every Store implementation is held to, plus the
 * fixtures all four store specs seed from.
 *
 * It lives in a plain module rather than in `store.spec.ts` because importing
 * a spec runs it: every `describe` in the imported file executes again inside
 * the importing file, so a suite kept in a spec is reported once per
 * implementation that imports it and one failure is attributed to five files
 * at once. Nothing forces the suite into a spec, despite an earlier comment
 * here saying so. `src/validation/colocation.spec.ts` checks that every spec
 * has a subject beside it, never that every module has a spec, so a module
 * with no spec of its own is fine.
 *
 * Importing `vitest` outside a spec is safe for the same reason: `describe`
 * and `it` are only called when a spec calls `describeStoreConformance`, and
 * nothing under `src/app/` reaches this file, so it never enters the bundle.
 */

const region: Region = { name: 'Denton County, Texas', hardinessZone: '8a' };

const frontLawn: Plant = {
	id: 'front-lawn',
	name: 'Front lawn',
	kind: 'lawn',
	status: 'planted',
	tags: ['lawn'],
	position: null,
	site: 'front',
	lawn: {
		grass: 'bermuda',
		areaSqFt: 4200,
		soil: 'clay',
		irrigation: { schedule: 'Twice weekly before sunrise', source: 'asserted' },
	},
	notes: null,
};

const fig: Plant = {
	id: 'fig-1',
	name: 'Brown turkey fig',
	kind: 'plant',
	status: 'planted',
	tags: ['fruit', 'watering'],
	position: null,
	site: 'northwest corner',
	lawn: null,
	notes: null,
};

const esperanza: Plant = {
	id: 'esperanza-1',
	name: 'Esperanza',
	kind: 'container',
	status: 'planted',
	tags: ['flowering', 'watering'],
	position: null,
	site: 'back patio',
	lawn: null,
	notes: null,
};

const fallPreEmergent: Rule = {
	id: 'fall-pre-emergent',
	kind: 'window',
	name: 'Fall pre-emergent',
	region,
	source: { kind: 'extension', label: 'Texas A&M AgriLife Extension', url: 'https://agrilifeextension.tamu.edu/' },
	tags: ['lawn', 'chemical'],
	delegable: false,
	priority: 0,
	appliesTo: { plantIds: ['front-lawn'], plantTags: null, ruleTags: null },
	productLabel: { url: 'https://example.invalid/pre-emergent-label.pdf' },
	start: '09-01',
	end: '09-30',
};

const esperanzaFeeding: Rule = {
	id: 'esperanza-feeding',
	kind: 'cadence',
	name: 'Feed the esperanza',
	region,
	source: { kind: 'owner', label: 'Owner practice', url: null },
	tags: ['feeding'],
	delegable: true,
	priority: 10,
	appliesTo: { plantIds: ['esperanza-1'], plantTags: null, ruleTags: null },
	productLabel: null,
	everyDays: { min: 28, max: 42 },
	season: { start: '03-15', end: '10-05' },
	after: null,
};

const rainExpected: Rule = {
	id: 'rain-expected',
	kind: 'guard',
	name: 'Hold watering when rain is coming',
	region,
	source: { kind: 'owner', label: 'Owner practice', url: null },
	tags: ['watering'],
	delegable: true,
	priority: 100,
	appliesTo: { plantIds: null, plantTags: ['watering'], ruleTags: null },
	productLabel: null,
	condition: { kind: 'no-rain-within', days: 2, probabilityAtLeast: 50 },
	effect: 'defer',
	release: 'No day above a 50% chance of rain in the next two days',
};

const lastFeeding: Occurrence = {
	id: 'esperanza-feeding-2026-08-15',
	ruleId: 'esperanza-feeding',
	plantId: 'esperanza-1',
	completedAt: '2026-08-15T14:20:00Z',
	recordedAt: '2026-08-15T14:22:00Z',
	source: 'seed',
};

const lastPreEmergent: Occurrence = {
	id: 'fall-pre-emergent-2025-09-14',
	ruleId: 'fall-pre-emergent',
	plantId: 'front-lawn',
	completedAt: '2025-09-14T13:00:00Z',
	recordedAt: '2025-09-14T13:05:00Z',
	source: 'seed',
};

const homeYard: Yard = { id: 'home-yard', region, photo: null, overlays: [] };

/**
 * One small yard that still covers every shape the store has to carry: a lawn
 * and two non-lawn plants, one rule of each kind that produces work plus a
 * guard, and two occurrences so append-only has something to collide with.
 *
 * Ids reuse the real yard's vocabulary wherever an entity matches, so a
 * failure here reads the same way as a failure in the artifact fixtures
 * rather than sending a reader hunting for which `plant-2` this is.
 *
 * It lives here rather than in src/artifact/fixtures.ts on purpose: that file
 * belongs to the artifact and every ticket keeps its fixtures beside its own
 * code. All four store specs seed from this one export so a conformance
 * failure means the implementation differs, never the data.
 */
export const seedFixture: SeedData = {
	yard: homeYard,
	plants: [frontLawn, fig, esperanza],
	rules: [fallPreEmergent, esperanzaFeeding, rainExpected],
	occurrences: [lastFeeding, lastPreEmergent],
	tagPolicy: { neverDelegableTags: ['chemical'], safetyTags: ['chemical', 'sharp'] },
};

/**
 * The emptiest seed the type permits. `yard` and `tagPolicy` are single
 * records rather than arrays, so a store can never hold nothing at all. That
 * is what "fresh" means for the import tests. Its yard carries a different id,
 * so a restored dump is distinguishable from what was already there.
 */
export const emptySeedData: SeedData = {
	yard: { id: 'bare-yard', region, photo: null, overlays: [] },
	plants: [],
	rules: [],
	occurrences: [],
	tagPolicy: { neverDelegableTags: [], safetyTags: [] },
};

export interface StoreConformanceOptions {
	/** Names the implementation under test; it prefixes every reported suite. */
	name: string;
	/**
	 * Builds a store already holding `data`.
	 *
	 * The seed is an argument rather than baked in because the import tests
	 * need two stores at once: one to dump from and an empty one to restore
	 * into. A factory that only ever produced the populated fixture would make
	 * "load into a fresh store" untestable without also pinning down whether
	 * load replaces or merges, which is not the contract's business here.
	 */
	createStore: (data: SeedData) => Promise<Store>;
	/**
	 * Whether the implementation accepts writes. The seed store serves committed
	 * JSON and is read-only, so the write half is skipped rather than expected to
	 * fail. Rejecting every write is a different contract from having no write
	 * path.
	 */
	writable: boolean;
}

/** Sorts envelopes by id, so two listings compare without depending on an order the contract does not promise. */
function byId(left: { id: string }, right: { id: string }): number {
	return left.id.localeCompare(right.id);
}

/**
 * A plant no fixture holds, used to make "nothing was applied" falsifiable.
 *
 * A rejected payload built purely from a store's own dump proves nothing about
 * atomicity, because applying it writes back what was already there. This
 * record is the one thing whose presence afterwards can only mean the store
 * wrote before it finished checking.
 */
const INTRUDER: StoredRecord<Plant> = {
	id: 'intruder-1',
	updatedAt: '2026-09-12T15:04:00Z',
	source: 'browser',
	record: {
		id: 'intruder-1',
		name: 'Intruder',
		kind: 'plant',
		status: 'planted',
		tags: [],
		position: null,
		site: null,
		lawn: null,
		notes: null,
	},
};

/** Every collection listed and ordered, for comparing a whole store against itself before and after. */
async function snapshot(store: Store): Promise<Record<Collection, StoredRecord<unknown>[]>> {
	const entries = await Promise.all(
		COLLECTIONS.map(async collection => [collection, [...await store.list(collection)].sort(byId)] as const),
	);
	return Object.fromEntries(entries) as Record<Collection, StoredRecord<unknown>[]>;
}

/** Captures a rejection's message, and fails loudly rather than silently passing when the promise resolves. */
async function rejectionMessage(promise: Promise<unknown>): Promise<string> {
	try {
		await promise;
	}
	catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
	throw new Error('Expected the operation to reject, but it resolved.');
}

function seededIds(data: SeedData): Record<Collection, string[]> {
	return {
		yard: [data.yard.id],
		plants: data.plants.map(plant => plant.id),
		rules: data.rules.map(rule => rule.id),
		occurrences: data.occurrences.map(occurrence => occurrence.id),
		tagPolicy: [TAG_POLICY_ID],
	};
}

/**
 * The contract every Store implementation has to satisfy, run against one of
 * them.
 *
 * It is a function rather than a file of tests because three implementations
 * exist for one interface (a fake, a seed-backed reader, and IndexedDB), and
 * the point of the interface is that a caller cannot tell the three apart.
 * Three hand-written spec files would drift the moment one implementation was
 * easier to satisfy than the others, which is the failure this guards.
 */
export function describeStoreConformance(options: StoreConformanceOptions): void {
	const { name, createStore, writable } = options;
	const expectedIds = seededIds(seedFixture);

	describe(`${name}: reads`, () => {
		it('returns the envelope filed under an id it holds', async () => {
			const store = await createStore(seedFixture);

			const stored = await store.get('plants', 'fig-1');

			expect(stored?.id).toBe('fig-1');
			expect(stored?.record.name).toBe('Brown turkey fig');
		});

		it('returns null for an id it does not hold', async () => {
			const store = await createStore(seedFixture);

			expect(await store.get('plants', 'never-planted')).toBeNull();
		});

		it('files the single tag policy under the constant id', async () => {
			const store = await createStore(seedFixture);

			const stored = await store.get('tagPolicy', TAG_POLICY_ID);

			expect(stored?.record.neverDelegableTags).toEqual(['chemical']);
		});

		for (const collection of COLLECTIONS) {
			it(`lists every seeded record in ${collection}`, async () => {
				const store = await createStore(seedFixture);

				const ids = (await store.list(collection)).map(row => row.id);

				expect(ids.slice().sort()).toEqual(expectedIds[collection].slice().sort());
			});

			it(`keeps the envelope fields intact on ${collection}`, async () => {
				const store = await createStore(seedFixture);

				for (const row of await store.list(collection)) {
					expect(z.iso.datetime().safeParse(row.updatedAt).success, `${row.id} needs an ISO updatedAt`).toBe(true);
					expect(row.source, `${row.id} came from the seed`).toBe('seed');
					const recordId = (row.record as { id?: unknown }).id;
					if (typeof recordId === 'string') {
						expect(row.id, 'the envelope id mirrors record.id').toBe(recordId);
					}
				}
			});
		}
	});

	describe.skipIf(!writable)(`${name}: writes`, () => {
		it('reads back a record it has just written', async () => {
			const store = await createStore(seedFixture);
			const crapeMyrtle: StoredRecord<Plant> = {
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
			};

			await store.set('plants', crapeMyrtle);

			expect(await store.get('plants', 'crape-myrtle-1')).toEqual(crapeMyrtle);
		});

		it('refuses a second occurrence under an id it already holds, and keeps the first', async () => {
			const store = await createStore(seedFixture);
			const duplicate: StoredRecord<Occurrence> = {
				id: lastFeeding.id,
				updatedAt: '2026-09-12T15:04:00Z',
				source: 'browser',
				record: { ...lastFeeding, completedAt: '2026-09-12T15:00:00Z', recordedAt: '2026-09-12T15:04:00Z', source: 'browser' },
			};

			const message = await rejectionMessage(store.set('occurrences', duplicate));

			expect(message).toContain(lastFeeding.id);
			expect(message, 'the message reads as a sentence').toMatch(/\.$/);
			const kept = await store.get('occurrences', lastFeeding.id);
			expect(kept?.record.completedAt).toBe(lastFeeding.completedAt);
		});

		it('refuses an envelope whose id disagrees with its record', async () => {
			const store = await createStore(seedFixture);
			const mismatched = { ...INTRUDER, id: 'filed-elsewhere' };

			// Caught at the write rather than at the next export. Accepting this
			// leaves a store that reads back fine and can never be dumped again,
			// and the error then names the export instead of the call that broke it.
			await expect(store.set('plants', mismatched)).rejects.toThrow(/must match/);
			expect(await store.get('plants', 'filed-elsewhere')).toBeNull();
		});

		it('restores its own dump twice, because load is not bound by append-only', async () => {
			const store = await createStore(seedFixture);
			const payload = await store.dump();

			// The occurrences in this payload are already on file, so a `load` that
			// went through the append-only path would reject the second restore and
			// leave importing a backup a one-shot operation. See Store.load.
			await expect(store.load(payload)).resolves.toBeUndefined();
			await expect(store.load(payload)).resolves.toBeUndefined();

			expect((await store.list('occurrences')).map(row => row.id).sort())
				.toEqual(seedFixture.occurrences.map(occurrence => occurrence.id).sort());
		});

		it('round-trips a dump into a fresh store with every record intact', async () => {
			const source = await createStore(seedFixture);
			const payload = await source.dump();
			const target = await createStore(emptySeedData);

			await target.load(payload);

			// Whole envelopes rather than ids alone. An id-only check passes against
			// a load that wrote stubs, which is the loss this test is named for.
			//
			// Each payload record is looked up rather than the two listings being
			// compared outright, because `load` merges: the target keeps the records
			// its own seed gave it, so `list` legitimately returns more than the
			// payload carried. See Store.load.
			for (const collection of COLLECTIONS) {
				const restored = new Map((await target.list(collection)).map(row => [row.id, row]));

				for (const envelope of payload.collections[collection]) {
					expect(restored.get(envelope.id), `${collection} lost or altered ${envelope.id}`).toEqual(envelope);
				}
			}
		});

		it('refuses a payload whose version it does not know, and applies none of it', async () => {
			const store = await createStore(seedFixture);
			const before = await snapshot(store);

			// The payload carries a record the store does not already hold, so a
			// store that applied it before checking `version` is detectable. Feeding
			// back the store's own dump would not be: applying it would rewrite the
			// same bytes and every assertion below would still pass.
			const payload = await store.dump();
			const message = await rejectionMessage(store.load({
				...payload,
				version: 2,
				collections: { ...payload.collections, plants: [...payload.collections.plants, INTRUDER] },
			}));

			expect(message).toContain('version');
			expect(message, 'the message reads as a sentence').toMatch(/\.$/);
			expect(await store.get('plants', INTRUDER.id), 'the refused payload was applied anyway').toBeNull();
			expect(await snapshot(store)).toEqual(before);
		});

		it('refuses a payload holding one malformed record, and writes none of it', async () => {
			const payload = await (await createStore(seedFixture)).dump();
			const target = await createStore(emptySeedData);
			const before = await snapshot(target);
			const broken = {
				...payload,
				collections: {
					...payload.collections,
					plants: [
						...payload.collections.plants,
						{ id: 'broken-1', updatedAt: '2026-09-12T15:04:00Z', source: 'browser', record: { id: 'broken-1' } },
					],
				},
			};

			const message = await rejectionMessage(target.load(broken));

			expect(message, 'the message reads as a sentence').toMatch(/\.$/);
			// The whole store, not one collection. Naming a single collection means
			// picking one a write-as-you-parse store would have reached before the
			// bad record, and `COLLECTIONS` order decides that: `yard` and `plants`
			// both land before the broken plant is met, `rules` and everything after
			// it never do. An assertion on a later collection passes for the exact
			// bug it is named for.
			expect(await snapshot(target), 'part of the refused payload was applied').toEqual(before);
		});
	});
}
