// @vitest-environment node

/*
 * Node, not this file's jsdom default (see vitest.config.ts). jsdom already
 * supplies a `globalThis.indexedDB`, so importing browser.ts under it would
 * prove nothing about whether the import itself reached for that global —
 * every module-scope read would quietly succeed. Node is also the process
 * `next build` actually prerenders every route in, per the docblocks on
 * `openBrowserStore` and on `OpenStoreOptions.indexedDB` in
 * indexeddb-store.ts, so a module that misbehaves here is a module that
 * fails the build.
 */

import type { Store } from './store';
import type { Occurrence } from '@/planner/occurrence';
import {
	IDBCursor,
	IDBCursorWithValue,
	IDBDatabase,
	IDBFactory,
	IDBIndex,
	IDBKeyRange,
	IDBObjectStore,
	IDBOpenDBRequest,
	IDBRequest,
	IDBTransaction,
	IDBVersionChangeEvent,
} from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptySeedData } from './conformance';
import { createFakeStore } from './fake-store';
import { recordOccurrence } from './occurrence';

/**
 * A stand-in for `@/seed`'s real exports, built through `vi.hoisted` so the
 * same occurrence is visible both to the `vi.mock` factory below and to the
 * assertions in `listOccurrences`'s spec. Two things force the mock rather
 * than exercising the real seed data directly: `src/seed/occurrences.json`
 * ships empty today (the real yard has nothing recorded yet), so asserting
 * against it would prove nothing about merging and would start failing for
 * an unrelated reason the day someone records real history; and `@/seed` is
 * frozen for this task, so a fixture with a seed occurrence in it has to live
 * here rather than there.
 */
const { mockSeedOccurrence } = vi.hoisted(() => ({
	mockSeedOccurrence: {
		id: 'mock-seed-occurrence',
		ruleId: 'mock-rule',
		plantId: null,
		completedAt: '2026-01-01T00:00:00Z',
		recordedAt: '2026-01-01T00:00:00Z',
		source: 'seed',
	} satisfies Occurrence,
}));

vi.mock('@/seed', () => ({
	seedYard: { id: 'mock-yard', region: { name: 'Mock County, Texas', hardinessZone: '8a' }, photo: null, overlays: [] },
	seedPlants: [],
	seedRules: [],
	seedOccurrences: [mockSeedOccurrence],
	seedTagPolicy: { neverDelegableTags: [], safetyTags: [] },
}));

describe('browser store: module-scope safety', () => {
	afterEach(() => {
		// Configurable, so this always cleans up even though the test below
		// never triggers the getter: leaving it in place would poison every
		// later test in this file that so much as imports something which
		// reads `globalThis.indexedDB`.
		delete (globalThis as { indexedDB?: unknown }).indexedDB;
	});

	it('imports without reading globalThis.indexedDB', async () => {
		// A getter that throws stands in for the global lib.dom declares:
		// nothing under Node provides it, so any code that reads it — a
		// module-scope `openStore` call, or a bare `globalThis.indexedDB`
		// assigned to a module-scope constant — fires this the instant the
		// module body runs, before the import can resolve. A `next build`
		// prerender hits the same absence; this getter is what turns that into
		// a test failure pointing at the read, instead of a deploy failure
		// pointing at nothing in particular.
		Object.defineProperty(globalThis, 'indexedDB', {
			configurable: true,
			get(): never {
				throw new Error('browser.ts read globalThis.indexedDB while its module body ran.');
			},
		});

		await expect(import('./browser')).resolves.toBeDefined();
	});
});

describe('browser store: listOccurrences', () => {
	it('merges the seed half with whatever the passed store holds', async () => {
		const { listOccurrences } = await import('./browser');
		const browserStore = createFakeStore(emptySeedData);
		const recorded = await recordOccurrence(browserStore, {
			ruleId: 'mock-rule',
			plantId: null,
			completedAt: '2026-02-01T00:00:00Z',
		});

		const merged = await listOccurrences(browserStore);

		// Bare Occurrence[], not the envelope: see the doc comment on
		// `listOccurrences` for why. The Occurrence's own `source` field is what
		// distinguishes the two halves once the envelope is gone.
		expect(merged).toHaveLength(2);
		expect(merged).toContainEqual(mockSeedOccurrence);
		expect(merged).toContainEqual(recorded.record);
		expect(merged.find(o => o.id === mockSeedOccurrence.id)?.source).toBe('seed');
		expect(merged.find(o => o.id === recorded.id)?.source).toBe('browser');
	});
});

describe('browser store: openBrowserStore', () => {
	it('opens through the factory it is handed, and the store it returns records a write', async () => {
		// `idb`'s wrap and IndexedDB itself reach for IDBKeyRange and friends off
		// the global scope even when the factory is injected (see
		// indexeddb-store.spec.ts), so this test installs them by hand rather
		// than pulling in `fake-indexeddb/auto`: that subpath's package.json
		// export carries no `types` condition, so `tsc` cannot resolve it
		// through a dynamic `import()` (a bare side-effect `import` gets away
		// with it; a value-producing one does not). The named exports here
		// come from the package's main entry, which is typed. `indexedDB`
		// itself is deliberately left off this list — the store below only
		// ever sees it as the explicit argument below, which is the thing this
		// test is actually proving.
		Object.assign(globalThis, {
			IDBCursor,
			IDBCursorWithValue,
			IDBDatabase,
			IDBFactory,
			IDBIndex,
			IDBKeyRange,
			IDBObjectStore,
			IDBOpenDBRequest,
			IDBRequest,
			IDBTransaction,
			IDBVersionChangeEvent,
		});
		const { openBrowserStore } = await import('./browser');

		const store: Store = await openBrowserStore(new IDBFactory());
		const recorded = await recordOccurrence(store, {
			ruleId: 'mock-rule',
			plantId: null,
			completedAt: '2026-03-01T00:00:00Z',
		});

		expect((await store.get('occurrences', recorded.id))?.record).toEqual(recorded.record);
	});
});
