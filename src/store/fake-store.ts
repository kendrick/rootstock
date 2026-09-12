import type { Dump } from './dump';
import type { Collection, CollectionRecords, SeedData, Store, StoredRecord } from './store';
import { dumpSchema, parseDump } from './dump';
import { COLLECTIONS, occurrenceAlreadyStored, TAG_POLICY_ID } from './store';

/**
 * Stamped on every envelope this factory seeds, in place of `new Date()`.
 *
 * `store.spec.ts`'s conformance suite only checks that a seeded envelope's
 * `updatedAt` parses as ISO 8601, not what it says, so the clock is free to
 * pick anything here. But a fake that read the real clock while seeding
 * would make its own dump non-reproducible: two stores built from the same
 * `SeedData` in the same test run would disagree on every seeded
 * `updatedAt`, and a dump/load round trip taken a millisecond apart would
 * never compare equal. A constant costs nothing a caller can observe and
 * buys back reproducibility a hand-rolled fake exists to have.
 */
const SEEDED_AT = '2020-01-01T00:00:00Z';

function seededEnvelope<T>(id: string, record: T): StoredRecord<T> {
	return { id, updatedAt: SEEDED_AT, source: 'seed', record };
}

/**
 * The five collections as plain `Map`s, envelope in and envelope out.
 *
 * `unknown` rather than a union of the five record types: a `Map` typed to a
 * union would let a plant slip into the rules table at the type level, and
 * the actual guarantee—that `tables.plants` only ever holds
 * `StoredRecord<Plant>`—comes from every access into this structure going
 * through the generic `Collection`-keyed methods below, never from the
 * declared type of the map itself.
 */
type Tables = Record<Collection, Map<string, StoredRecord<unknown>>>;

function seedTables(data: SeedData): Tables {
	return {
		yard: new Map([[data.yard.id, seededEnvelope(data.yard.id, data.yard)]]),
		plants: new Map(data.plants.map(plant => [plant.id, seededEnvelope(plant.id, plant)])),
		rules: new Map(data.rules.map(rule => [rule.id, seededEnvelope(rule.id, rule)])),
		occurrences: new Map(data.occurrences.map(occurrence => [occurrence.id, seededEnvelope(occurrence.id, occurrence)])),
		tagPolicy: new Map([[TAG_POLICY_ID, seededEnvelope(TAG_POLICY_ID, data.tagPolicy)]]),
	};
}

function toDump(tables: Tables): Dump {
	// Round-tripped through `dumpSchema` rather than assembled as a bare object
	// literal typed `Dump`. A hand-typed literal would trust the compiler that
	// every envelope sitting in `tables` still matches its schema, but nothing
	// re-checks that after a `set`. This is the one place left where a bug
	// upstream would otherwise surface as a silently wrong dump instead of a
	// thrown error naming the field that drifted.
	return dumpSchema.parse({
		version: 1,
		exportedAt: new Date().toISOString(),
		collections: {
			yard: [...tables.yard.values()],
			plants: [...tables.plants.values()],
			rules: [...tables.rules.values()],
			occurrences: [...tables.occurrences.values()],
			tagPolicy: [...tables.tagPolicy.values()],
		},
	});
}

/**
 * An in-memory `Store`, seeded once at creation and gone when the process
 * exits.
 *
 * This is the fake other modules write their tests against, standing in for
 * `indexeddb-store.ts` the way `seed-store.ts` stands in for the
 * committed-JSON path: no `indexedDB` global, no fake-timers dance around a
 * database's own async machinery, just a `Map` a test can seed exactly the
 * way it wants and inspect synchronously between awaits. Every method is
 * still `async`, matching {@link Store}, so a test written against the fake
 * exercises the same `await`-shaped call sites it will use against the real
 * adapter.
 *
 * A factory rather than a class: nothing here needs inheritance or a second
 * constructor path, and the rest of the codebase builds things this way (see
 * `dumpSchema`, `parseDump`). Each call opens a fresh closure over its own
 * `Tables`, so two stores built from the same `SeedData` never share state.
 * `fake-store.spec.ts` pins that down, because it is exactly the kind of
 * thing a later refactor could break by hoisting the tables out of the
 * function by accident.
 */
export function createFakeStore(data: SeedData): Store {
	const tables = seedTables(data);

	return {
		get: async <C extends Collection>(collection: C, id: string) =>
			(tables[collection].get(id) ?? null) as StoredRecord<CollectionRecords[C]> | null,

		list: async <C extends Collection>(collection: C) =>
			[...tables[collection].values()] as StoredRecord<CollectionRecords[C]>[],

		set: async <C extends Collection>(collection: C, record: StoredRecord<CollectionRecords[C]>) => {
			// The one place the five collections are not uniform: an Occurrence is
			// append-only (CONTEXT.md), so a `set` that would replace one instead
			// rejects and leaves the record already filed untouched. See
			// `Store.set`'s doc comment for why overwriting silently would be worse
			// than refusing.
			if (collection === 'occurrences' && tables.occurrences.has(record.id)) {
				throw occurrenceAlreadyStored(record.id);
			}
			tables[collection].set(record.id, record as StoredRecord<unknown>);
		},

		dump: async () => toDump(tables),

		load: async (payload: unknown) => {
			// `parseDump` walks the whole payload before this line returns anything,
			// so a malformed record throws here, before a single `Map.set` below has
			// run: `Store.load`'s "leaves the store exactly as it was" is bought by
			// validating everything up front rather than by any rollback logic.
			const restored = parseDump(payload).collections;
			for (const collection of COLLECTIONS) {
				for (const envelope of restored[collection]) {
					tables[collection].set(envelope.id, envelope as StoredRecord<unknown>);
				}
			}
		},
	};
}
