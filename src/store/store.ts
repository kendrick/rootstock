import type { Dump } from './dump';
import type { Occurrence } from '@/planner/occurrence';
import type { Rule, TagPolicy } from '@/rules/rule';
import type { Plant, Yard } from '@/yard/plant';

/**
 * What lives in each collection, keyed by the name that collection is
 * addressed by. Every method on {@link Store} is generic over one of these
 * keys and resolves its record type through this map, which is the whole
 * reason the map exists: `get('plants', 'fig-1')` has to arrive at the call
 * site already typed as a Plant. A store that handed back a union, or worse
 * an `unknown`, would push a cast into every caller and throw away the
 * compiler's help at exactly the point where a misspelled collection name is
 * easiest to write.
 *
 * `yard` and `tagPolicy` hold one record each and are collections anyway.
 * Modelling them as singletons would mean a second pair of methods and a
 * second code path in every implementation, bought for two records that are
 * read the same way as the other three.
 */
export interface CollectionRecords {
	yard: Yard;
	plants: Plant;
	rules: Rule;
	occurrences: Occurrence;
	tagPolicy: TagPolicy;
}

/** The name of one collection: exactly the five keys of {@link SeedData}, spelled the same way. */
export type Collection = keyof CollectionRecords;

/**
 * The collection names as a value, for the code that has to walk all five:
 * a dump, a load, a conformance run. Reaching for `Object.keys` instead hands
 * back `string[]` and discards the discrimination {@link CollectionRecords}
 * exists to provide.
 */
export const COLLECTIONS = ['yard', 'plants', 'rules', 'occurrences', 'tagPolicy'] as const satisfies readonly Collection[];

/**
 * The id the single TagPolicy record is filed under.
 *
 * A StoredRecord's `id` mirrors `record.id` everywhere the record carries
 * one, and this singleton is the one case where it cannot: a TagPolicy is
 * `{ neverDelegableTags, safetyTags }` and has no id field. Adding one so the
 * store could keep its rule uniform would be storage dictating terms to a
 * frozen schema that hand-authored JSON also has to satisfy, and nobody
 * writing a tag policy by hand should have to name it. So the id is a
 * constant instead of a field, exported rather than retyped, so the seed
 * path, the browser path and a restored dump all agree on the spelling.
 */
export const TAG_POLICY_ID = 'tag-policy';

/**
 * What the store keeps around a domain record: the id it is filed under, when
 * it was last written, and where it came from.
 *
 * The envelope repeats fields some records already carry. An Occurrence has
 * its own `id`, `recordedAt` and `source`, and the duplication is on purpose:
 * those schemas are frozen and shared with the generation run, so reshaping
 * them to give the store a uniform record would drag storage concerns into
 * the domain. Three repeated fields on the outside is the cheaper trade, and
 * one code path can then list, sort and export every collection.
 *
 * `source` is the field that earns the envelope. It separates a record the
 * seed shipped from one the browser wrote, which is the distinction any
 * future re-seed turns on: seed records can be replaced wholesale, browser
 * records cannot.
 */
export interface StoredRecord<T> {
	/** Mirrors `record.id` wherever the record carries one. See {@link TAG_POLICY_ID} for the one record that cannot. */
	id: string;
	/** ISO 8601 datetime, supplied by the caller rather than invented by the store. See {@link Store.set}. */
	updatedAt: string;
	source: 'seed' | 'browser';
	record: T;
}

/**
 * Everything a store is seeded with. It is the unenveloped shape because seed
 * data is hand-authored JSON, and asking an author to wrap every record in an
 * `updatedAt` and a `source` is asking them to maintain bookkeeping the store
 * can supply on the way in. What it supplies is fixed: every record seeded
 * from here lands with `source: 'seed'`, which is what later tells a re-seed
 * which records it is allowed to replace.
 */
export interface SeedData {
	yard: Yard;
	plants: Plant[];
	rules: Rule[];
	occurrences: Occurrence[];
	tagPolicy: TagPolicy;
}

/**
 * Read and write access to the five collections, plus whole-database export
 * and import.
 *
 * Every method is async, including on the implementations where nothing
 * actually waits. A synchronous store behind a synchronous interface never
 * exercises a loading state, and loading states are precisely what a real
 * backend surfaces all at once on the day somebody swaps one in. Paying for
 * them now costs an `await` per call; discovering them later costs a rewrite
 * of every component that reads from here.
 *
 * Rejections carry an `Error` whose message is a full sentence naming what
 * went wrong and ending in a period. This is a browser-side store with no
 * one watching a log, so the message is often the only trace a failure
 * leaves, and a bare `'conflict'` tells a rendered error state nothing.
 */
export interface Store {
	/**
	 * The envelope filed under `id`, or `null` when nothing is. Missing is an
	 * ordinary answer here, not an exception: the caller asking for a plant the
	 * yard no longer has is a page that needs to render an empty state, and
	 * `null` says so in a form the type system forces it to handle. `undefined`
	 * would not, since it is also what a typo returns.
	 */
	get: <C extends Collection>(collection: C, id: string) => Promise<StoredRecord<CollectionRecords[C]> | null>;

	/** Every envelope in the collection. Order is not part of the contract: callers that need one sort by a field they can name. */
	list: <C extends Collection>(collection: C) => Promise<StoredRecord<CollectionRecords[C]>[]>;

	/**
	 * Writes one fully-formed envelope, replacing any record already filed
	 * under that id.
	 *
	 * `updatedAt` and `source` come from the caller rather than being stamped
	 * here. A store that read the clock itself would make every write
	 * unreproducible in a test, and it would have to guess at `source`. Only the
	 * caller knows whether a write is a seed load or a person tapping a button.
	 *
	 * `occurrences` is the exception to replacement, and it is append-only:
	 * a `set` carrying an id the collection already holds rejects. CONTEXT.md
	 * makes an Occurrence an append-only record that work happened, and marking
	 * a task done writes a new one rather than editing an old one. A store that
	 * overwrote instead would destroy the history cadence rules read from, with
	 * no error to show for it, and nobody designed that history in the first
	 * place so nobody would miss it.
	 */
	set: <C extends Collection>(collection: C, record: StoredRecord<CollectionRecords[C]>) => Promise<void>;

	/** Every collection, enveloped, under a version stamp. See {@link Dump} for the shape and why it is versioned. */
	dump: () => Promise<Dump>;

	/**
	 * Restores a payload produced by {@link Store.dump}.
	 *
	 * The whole payload is parsed through `dumpSchema` before anything is
	 * written. An unknown `version` or a single malformed record rejects and
	 * leaves the store exactly as it was. A half-applied import is worse than a
	 * refused one, because the refusal is visible and the half is not.
	 *
	 * Records are written by id, overwriting what is there; records the payload
	 * omits are left alone. The append-only check on {@link Store.set} does not
	 * apply, because a restore that refused ids it already held could never be
	 * run twice.
	 */
	load: (payload: unknown) => Promise<void>;
}

/**
 * The rejection every implementation raises when a `set` would overwrite an
 * Occurrence.
 *
 * Shared rather than written per implementation. The three stores have to be
 * indistinguishable through the interface, and a caller that matched on this
 * message would otherwise get a different sentence depending on which one it
 * held. It had already drifted between "replacing" and "changing" before this
 * was pulled out, which is the drift a single definition ends.
 */
export function occurrenceAlreadyStored(id: string): Error {
	return new Error(`An Occurrence is already stored under '${id}', and occurrences are append-only: marking work done writes a new Occurrence rather than replacing an old one.`);
}

/**
 * Rejects an envelope filed under an id its own record disagrees with.
 *
 * `dumpSchema` already refuses a mismatched pair, but only on the way out. A
 * `set` that accepted one would take the write, answer every later `get` and
 * `list` quite happily, and then fail the next `dump` for a reason pointing at
 * the export rather than at the write that caused it. Checking here turns a
 * store that cannot be exported any more into one rejected call.
 *
 * A record with no `id` of its own passes, which is the TagPolicy singleton
 * filed under {@link TAG_POLICY_ID}.
 */
export function assertMirrorsRecordId(envelope: StoredRecord<unknown>): void {
	const recordId = (envelope.record as { id?: unknown } | null)?.id;
	if (typeof recordId === 'string' && recordId !== envelope.id) {
		throw new TypeError(`This envelope is filed under '${envelope.id}' but its record carries the id '${recordId}', and the two must match.`);
	}
}
