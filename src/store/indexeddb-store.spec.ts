import type { SeedData, Store, StoredRecord } from './store';
import { IDBFactory as FakeIDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { describeStoreConformance, seedFixture } from './conformance';
import { openStore } from './indexeddb-store';
import { TAG_POLICY_ID } from './store';
import 'fake-indexeddb/auto';

/*
 * `fake-indexeddb/auto` rather than injection alone. The factory this file
 * hands to `openStore` covers the one call the store makes itself, but `idb`
 * and IndexedDB reach for `IDBKeyRange`, `IDBDatabase` and their siblings off
 * the global scope internally, and nothing injected reaches those. `/auto`
 * installs them. It is the whole test environment for this file, because
 * vitest.config.ts is frozen and carries no setup file.
 *
 * eslint decides where the import sits in the block, and any position works:
 * neither `idb` nor the store reads an IndexedDB global while it is being
 * evaluated, so the globals are in place before the first test runs.
 */

/** Mirrors the version indexeddb-store.ts opens at. The failed-open test has to land a database above it. */
const DATABASE_VERSION = 1;

/**
 * One timestamp for every seeded envelope. The conformance suite checks that
 * `updatedAt` parses as ISO 8601 and pins no particular value, so reading a
 * clock here would buy nothing and cost reproducibility.
 */
const SEEDED_AT = '2026-09-11T00:00:00Z';

function envelope<T>(id: string, record: T): StoredRecord<T> {
	return { id, updatedAt: SEEDED_AT, source: 'seed', record };
}

let databaseCount = 0;

/**
 * Opens a store nothing else can see and fills it from `data`.
 *
 * Each store gets its own `IDBFactory`, because two stores from one factory
 * share a backing origin, and the round-trip test builds two at once and needs
 * the second genuinely empty. The counter in the name is belt and braces, so a
 * suite run one test at a time behaves the same as a suite run in file order.
 */
async function freshStore(data: SeedData): Promise<Store> {
	databaseCount += 1;
	const store = await openStore({ name: `rootstock-${databaseCount}`, indexedDB: new FakeIDBFactory() });

	await Promise.all([
		store.set('yard', envelope(data.yard.id, data.yard)),
		...data.plants.map(plant => store.set('plants', envelope(plant.id, plant))),
		...data.rules.map(rule => store.set('rules', envelope(rule.id, rule))),
		...data.occurrences.map(occurrence => store.set('occurrences', envelope(occurrence.id, occurrence))),
		store.set('tagPolicy', envelope(TAG_POLICY_ID, data.tagPolicy)),
	]);

	return store;
}

describeStoreConformance({
	name: 'indexeddb store',
	createStore: freshStore,
	writable: true,
});

/**
 * A payload that adds a record to two collections the malformed record is not
 * in. `yard` is applied first and `rules` after `plants`, so a surviving
 * `bare-yard` or a surviving `never-applied` is a write that escaped the single
 * transaction the contract promises.
 */
async function widePayload(store: Store): Promise<Record<string, unknown>> {
	const payload = await store.dump();
	const [firstRule] = payload.collections.rules;
	if (firstRule === undefined) {
		throw new Error('The seed fixture is expected to carry at least one rule.');
	}

	return {
		...payload,
		collections: {
			...payload.collections,
			yard: [
				...payload.collections.yard,
				envelope('bare-yard', { id: 'bare-yard', region: firstRule.record.region, photo: null, overlays: [] }),
			],
			rules: [
				...payload.collections.rules,
				envelope('never-applied', { ...firstRule.record, id: 'never-applied' }),
			],
		},
	};
}

describe('indexeddb store: load atomicity', () => {
	// Without this the refusal test below proves nothing: a payload that changes
	// nothing leaves a database unchanged whatever load does with it.
	it('applies every collection when the payload parses', async () => {
		const store = await freshStore(seedFixture);

		await store.load(await widePayload(store));

		expect((await store.list('yard')).map(row => row.id).sort()).toEqual(['bare-yard', 'home-yard']);
		expect((await store.list('rules')).map(row => row.id)).toContain('never-applied');
	});

	it('leaves a populated database exactly as it was when one record is malformed', async () => {
		const store = await freshStore(seedFixture);
		const payload = await widePayload(store);
		const collections = payload.collections as { plants: unknown[] };
		const broken = {
			...payload,
			collections: {
				...collections,
				plants: [
					...collections.plants,
					{ id: 'broken-1', updatedAt: SEEDED_AT, source: 'browser', record: { id: 'broken-1' } },
				],
			},
		};
		const before = await store.dump();

		await expect(store.load(broken)).rejects.toThrow(/\.$/);

		// Compared record for record rather than by id, because a load that wrote
		// as it parsed would have overwritten envelopes as well as added them.
		const after = await store.dump();
		expect(after.collections).toEqual(before.collections);
	});
});

/*
 * Both open tests assert on the promise `openStore` returns. An implementation
 * that let the failure escape as an unhandled rejection would leave that
 * promise unsettled, so the test fails on the timeout rather than passing
 * because nothing happened.
 */
describe('indexeddb store: a failed open', () => {
	it('rejects with a full sentence when the open request errors', async () => {
		// A factory with no database behind it, which doubles as proof that the
		// store opens through the factory it is handed. `fake-indexeddb/auto` has
		// installed a working `globalThis.indexedDB`, so a module reading the
		// global would open successfully here and this test would never reject.
		const failingFactory = {
			open: () => {
				const request = new EventTarget() as unknown as IDBOpenDBRequest;
				Object.defineProperty(request, 'error', { value: new DOMException('Storage is unavailable', 'UnknownError') });
				queueMicrotask(() => request.dispatchEvent(new Event('error')));
				return request;
			},
		} as unknown as IDBFactory;

		await expect(openStore({ name: 'rootstock-unopenable', indexedDB: failingFactory })).rejects.toThrow(
			`The 'rootstock-unopenable' database could not be opened: IndexedDB reported UnknownError, "Storage is unavailable".`,
		);
	});

	it('rejects with an Error rather than a DOMException when a newer database is already there', async () => {
		// The same failure driven by real IndexedDB machinery: a database already
		// past the version the store asks for makes the open request error with a
		// VersionError instead of resolving.
		const indexedDB = new FakeIDBFactory();
		const ahead = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open('rootstock-ahead', DATABASE_VERSION + 1);
			request.addEventListener('success', () => resolve(request.result));
			request.addEventListener('error', () => reject(request.error ?? new Error('The setup open failed.')));
		});
		ahead.close();

		const rejection: unknown = await openStore({ name: 'rootstock-ahead', indexedDB }).then(
			() => new Error('Expected the open to reject, but it resolved.'),
			(reason: unknown) => reason,
		);

		expect(rejection).toBeInstanceOf(Error);
		expect(rejection).not.toBeInstanceOf(DOMException);
		expect((rejection as Error).message).toMatch(/^The 'rootstock-ahead' database could not be opened: .+\.$/);
	});
});
