import type { Store } from './store';
import type { Occurrence } from '@/planner/occurrence';
import { seedOccurrences, seedPlants, seedRules, seedTagPolicy, seedYard } from '@/seed';
import { openStore } from './indexeddb-store';
import { createSeedStore } from './seed-store';

/**
 * The read-only store over the committed seed data, built once at module
 * scope rather than per call. `createSeedStore` only builds Maps over
 * `SeedData` already in hand—it reads no browser global—so nothing here
 * needs the call-time indirection {@link openBrowserStore} exists to buy.
 * Every caller wanting the seed half of the yard shares this one instance
 * rather than re-parsing the seed JSON's Maps on every render.
 */
export const seedStore: Store = createSeedStore({
	yard: seedYard,
	plants: seedPlants,
	rules: seedRules,
	occurrences: seedOccurrences,
	tagPolicy: seedTagPolicy,
});

/**
 * Opens the browser-backed {@link Store}, named for this app rather than left
 * to the caller.
 *
 * `indexedDB` is a defaulted parameter, not a module-scope read of
 * `globalThis.indexedDB`. A default parameter is evaluated at call time, and
 * `next.config.ts` sets `output: 'export'`, so `next build` prerenders every
 * route in Node, where `globalThis.indexedDB` does not exist. Reading it at
 * module scope would fail the build on import rather than the call that
 * actually needs a browser; a default argument fails only if this ever ran
 * with nothing supplied and no browser present, which a prerender that never
 * calls this function cannot do. Tests exploit the same seam, handing in a
 * `fake-indexeddb` factory instead.
 */
export async function openBrowserStore(indexedDB: IDBFactory = globalThis.indexedDB): Promise<Store> {
	return openStore({ name: 'rootstock', indexedDB });
}

/**
 * Every Occurrence the yard has, seed and browser halves merged into one
 * list.
 *
 * Returns bare `Occurrence[]`, not the enveloped `StoredRecord<Occurrence>[]`
 * a `Store.list` hands back. `planner.ts`'s `evaluatePlanInput` takes
 * `occurrences: Occurrence[]`—that is the actual consumer a merged list
 * exists to feed, and marking a task done reads history only to hand it
 * back to the Planner. The envelope's `id`/`updatedAt`/`source` are storage
 * bookkeeping the Planner has no use for, and unwrapping loses nothing: an
 * Occurrence already carries its own `source: 'seed' | 'browser'` field (see
 * `occurrenceSchema`), which is the one bit of the envelope a caller reading
 * history actually cares about.
 *
 * Reads {@link seedStore} itself rather than taking two stores as
 * parameters, because the seed half is fixed for the life of the module and
 * every call site already has exactly one `Store` to plumb through—the
 * browser one a component holds via its defaulted `store` prop.
 */
export async function listOccurrences(store: Store): Promise<Occurrence[]> {
	const [seeded, recorded] = await Promise.all([
		seedStore.list('occurrences'),
		store.list('occurrences'),
	]);
	return [...seeded, ...recorded].map(envelope => envelope.record);
}
