import type { Collection, CollectionRecords, SeedData, Store, StoredRecord } from './store';
import { parseDump } from './dump';
import { TAG_POLICY_ID } from './store';

/**
 * The timestamp every seeded envelope carries.
 *
 * The store contract leaves `updatedAt` to the caller rather than stamping it
 * itself, precisely so a seed load does not have to call `new Date()` and make
 * every read of this store depend on when the process happened to start. Seed
 * data ships as committed JSON with no real edit time of its own, so one fixed
 * instant stands in for "as of this build" without pretending to more
 * precision than that.
 */
const SEEDED_AT = '2026-01-01T00:00:00.000Z';

function envelope<T>(id: string, record: T): StoredRecord<T> {
	return { id, updatedAt: SEEDED_AT, source: 'seed', record };
}

/**
 * A read-only {@link Store} over data the caller already has in hand.
 *
 * `data` arrives as an argument rather than being read from disk or imported
 * from the module that owns the seed JSON. Authoring that JSON and shaping
 * this store are separate concerns that changed at different times, and
 * keeping the dependency pointed this way means neither has to wait on the
 * other. Wiring the two together is one call site, not a coupling baked in
 * here.
 *
 * Every write rejects. This store fronts committed JSON the running page has
 * no way to persist a change back to, so accepting a write would let a caller
 * believe an edit survived a reload when nothing wrote it anywhere.
 */
export function createSeedStore(data: SeedData): Store {
	const tables: Record<Collection, Map<string, StoredRecord<unknown>>> = {
		yard: new Map([[data.yard.id, envelope(data.yard.id, data.yard)]]),
		plants: new Map(data.plants.map(plant => [plant.id, envelope(plant.id, plant)])),
		rules: new Map(data.rules.map(rule => [rule.id, envelope(rule.id, rule)])),
		occurrences: new Map(data.occurrences.map(occurrence => [occurrence.id, envelope(occurrence.id, occurrence)])),
		tagPolicy: new Map([[TAG_POLICY_ID, envelope(TAG_POLICY_ID, data.tagPolicy)]]),
	};

	return {
		get: async <C extends Collection>(collection: C, id: string) =>
			(tables[collection].get(id) ?? null) as StoredRecord<CollectionRecords[C]> | null,

		list: async <C extends Collection>(collection: C) =>
			[...tables[collection].values()] as StoredRecord<CollectionRecords[C]>[],

		set: async () => {
			throw new Error('The seed store is read-only and cannot record a write; reach for the IndexedDB-backed store instead.');
		},

		// `parseDump` and not `dumpSchema.parse`: the interface promises every
		// rejection carries a full sentence, and a bare `.parse` throws a ZodError
		// whose message is a JSON issue dump. All three stores fail the same way.
		dump: async () => parseDump({
			version: 1,
			// The real moment, unlike the seeded `updatedAt` above. `exportedAt` says
			// when the export was taken, and a read-only store still gets exported at
			// a time somebody could check against; reusing the seed constant here
			// would report a January provenance for a file written in September.
			exportedAt: new Date().toISOString(),
			collections: {
				yard: [...tables.yard.values()],
				plants: [...tables.plants.values()],
				rules: [...tables.rules.values()],
				occurrences: [...tables.occurrences.values()],
				tagPolicy: [...tables.tagPolicy.values()],
			},
		}),

		load: async () => {
			throw new Error('The seed store is read-only and cannot load a dump; reach for the IndexedDB-backed store instead.');
		},
	};
}
