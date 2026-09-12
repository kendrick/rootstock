import type { IDBPDatabase } from 'idb';
import type { Dump } from './dump';
import type { Collection, CollectionRecords, Store, StoredRecord } from './store';
import { wrap } from 'idb';
import { parseDump } from './dump';
import { assertMirrorsRecordId, COLLECTIONS, occurrenceAlreadyStored } from './store';

/**
 * Bump this and `upgradeneeded` runs again, which is where the object stores
 * get created. It stays at 1 because IndexedDB stores whole objects rather than
 * columns, so a new field on a `StoredRecord` needs no migration. Only adding
 * or dropping a collection would.
 */
const DATABASE_VERSION = 1;

/**
 * One object store per collection, all keyed by the envelope's own `id`.
 *
 * `keyPath: 'id'` rather than an out-of-line key, so the key a record is filed
 * under cannot drift from the `id` the record carries. The envelope already
 * promises those two agree, and an in-line key path makes the database enforce
 * it instead of leaving it to whoever calls `put`.
 *
 * Every value types as `StoredRecord<unknown>` rather than the collection's own
 * record. Callers address the five stores through a generic `C extends
 * Collection`, and a per-collection value type pushes the resolution of
 * `CollectionRecords[C]` down into `idb`'s own conditional types, where a
 * mismatch reports against a type nobody in this repo wrote. One cast per read,
 * where the collection name is still concrete, reads better and fails clearer.
 */
type StoredDatabase = Record<Collection, { key: string; value: StoredRecord<unknown> }>;

export interface OpenStoreOptions {
	/** The IndexedDB database name. One name is one database; tests hand in a unique one per case. */
	name: string;
	/**
	 * The factory to open through, injected rather than read off `globalThis`.
	 *
	 * Two things force this. A failing open has to be testable, and a test can
	 * only reach that branch by handing in a factory whose `open` fires
	 * `onerror`. And this module ships in a static export that `next build`
	 * prerenders in Node, where `globalThis.indexedDB` does not exist: a
	 * module-scope read would fail the build rather than the call, and the
	 * deploy is a long way from the line that caused it.
	 */
	indexedDB: IDBFactory;
}

/**
 * Opens the browser-backed {@link Store}, creating the database on first use.
 *
 * Every rejection out of here and out of the returned store carries an `Error`
 * with a full sentence. IndexedDB fails with a `DOMException` whose `name` is
 * the whole diagnosis and whose `message` is often empty, and this store runs
 * in a browser with nobody tailing a log, so a raw one reaching a rendered
 * error state tells the reader nothing they can act on.
 */
export async function openStore(options: OpenStoreOptions): Promise<Store> {
	const { name, indexedDB } = options;
	const db = await openDatabase(name, indexedDB);

	return {
		get: async <C extends Collection>(collection: C, id: string) =>
			withStorageError(`'${id}' could not be read from the '${collection}' collection`, async () => {
				const stored = await db.get(collection, id);
				// `undefined` is what IndexedDB returns for a key it does not hold, and
				// `null` is what the contract promises. See Store.get for why.
				return (stored ?? null) as StoredRecord<CollectionRecords[C]> | null;
			}),

		list: async <C extends Collection>(collection: C) =>
			withStorageError(`The '${collection}' collection could not be listed`, async () => {
				const stored = await db.getAll(collection);
				return stored as StoredRecord<CollectionRecords[C]>[];
			}),

		set: async <C extends Collection>(collection: C, record: StoredRecord<CollectionRecords[C]>) => {
			// Before the transaction, so a mismatched envelope never opens one. This
			// throws rather than rejecting a storage error: nothing went wrong with
			// the database, the caller handed over a record it had built wrong.
			assertMirrorsRecordId(record);

			const wrote = await withStorageError(`'${record.id}' could not be written to the '${collection}' collection`, async () => {
				const tx = db.transaction(collection, 'readwrite');
				const objectStore = tx.objectStore(collection);

				// The append-only check and the write share one transaction, so no other
				// write can slip in between them and turn a clean check into a silent
				// overwrite. Awaiting the read mid-transaction is safe: `idb` settles its
				// promise from the request's own success event, so the `put` below is
				// queued in the same tick and the transaction never goes inactive. That
				// only holds while everything awaited in here is an IndexedDB request;
				// await anything else and the transaction commits out from under it.
				//
				// The conflict comes back as a value rather than a throw, because a throw
				// here would land in `withStorageError` and be reworded as a storage
				// failure, when what happened is a domain rule doing its job.
				if (collection === 'occurrences' && await objectStore.get(record.id) !== undefined) {
					// Deliberately no `abort()`. Nothing was written, so the empty
					// transaction can commit, and aborting would reject `tx.done` with an
					// AbortError that has nobody to catch it.
					await tx.done;
					return false;
				}

				await objectStore.put(record);
				await tx.done;
				return true;
			});

			if (!wrote) {
				throw occurrenceAlreadyStored(record.id);
			}
		},

		dump: async (): Promise<Dump> =>
			withStorageError('The store could not be exported', async () => {
				// One readonly transaction across all five, so the export is a single
				// consistent moment rather than five reads a concurrent write could
				// land between.
				const tx = db.transaction(COLLECTIONS, 'readonly');
				const [yard, plants, rules, occurrences, tagPolicy] = await Promise.all([
					tx.objectStore('yard').getAll(),
					tx.objectStore('plants').getAll(),
					tx.objectStore('rules').getAll(),
					tx.objectStore('occurrences').getAll(),
					tx.objectStore('tagPolicy').getAll(),
					tx.done,
				]);

				return parseDump({
					version: 1,
					exportedAt: new Date().toISOString(),
					collections: { yard, plants, rules, occurrences, tagPolicy },
				});
			}),

		load: async (payload: unknown) => {
			// Parsed in full before a transaction exists, so an unknown version or one
			// malformed record rejects with nothing open and nothing written. See
			// Store.load: a half-applied import is worse than a refused one, because
			// the refusal is visible and the half is not.
			const restored = parseDump(payload).collections;

			await withStorageError('The store could not be restored from the payload', async () => {
				// All five collections in one transaction. A transaction per collection
				// would leave the database holding the first three when the fourth
				// failed, which is the state this method exists to avoid.
				const tx = db.transaction(COLLECTIONS, 'readwrite');
				const writes: Promise<unknown>[] = [];

				for (const collection of COLLECTIONS) {
					const objectStore = tx.objectStore(collection);
					for (const envelope of restored[collection]) {
						writes.push(objectStore.put(envelope));
					}
				}

				// Awaited together rather than one at a time: a `put` that rejects while
				// the loop is still queueing would otherwise surface as an unhandled
				// rejection, and awaiting inside the loop risks the transaction
				// auto-committing between iterations.
				await Promise.all([...writes, tx.done]);
			});
		},
	};
}

/**
 * Opens the database and hands back `idb`'s wrapper around it.
 *
 * `idb`'s own `openDB` is not usable here: it reads `indexedDB` off the global
 * scope, which is exactly what {@link OpenStoreOptions.indexedDB} exists to
 * avoid. So the open is hand-rolled, and only the connection it produces goes
 * to `wrap`. That is the part of `idb` this module wants anyway: promise-shaped
 * requests and a `tx.done` to await.
 *
 * Listeners rather than `onerror`/`onsuccess` assignment, so nothing this
 * function attaches can clobber a handler someone else set on the same request.
 */
async function openDatabase(name: string, indexedDB: IDBFactory): Promise<IDBPDatabase<StoredDatabase>> {
	let request: IDBOpenDBRequest;
	try {
		// `open` throws rather than firing an error event when the origin has no
		// storage at all: a sandboxed iframe, or Firefox in private browsing.
		request = indexedDB.open(name, DATABASE_VERSION);
	}
	catch (cause) {
		throw failure(`The '${name}' database could not be opened`, cause);
	}

	return new Promise<IDBPDatabase<StoredDatabase>>((resolve, reject) => {
		request.addEventListener('upgradeneeded', () => {
			const db = request.result;
			for (const collection of COLLECTIONS) {
				if (!db.objectStoreNames.contains(collection)) {
					db.createObjectStore(collection, { keyPath: 'id' });
				}
			}
		});

		request.addEventListener('success', () => {
			resolve(wrap(request.result) as unknown as IDBPDatabase<StoredDatabase>);
		});

		request.addEventListener('error', () => {
			reject(failure(`The '${name}' database could not be opened`, request.error));
		});
	});
}

/**
 * Runs one storage operation and rewrites whatever it throws as a full-sentence
 * `Error`.
 *
 * Wrapping rather than rethrowing, because IndexedDB's `DOMException` is
 * already an `Error` and so slips through any `instanceof` check a caller might
 * write. The original travels on `cause`, which keeps the stack for a debugger
 * without putting `AbortError` in front of a person.
 */
async function withStorageError<T>(what: string, operation: () => Promise<T>): Promise<T> {
	try {
		return await operation();
	}
	catch (cause) {
		throw failure(what, cause);
	}
}

function failure(what: string, cause: unknown): Error {
	// Some DOMException messages end in a period and some do not, so any trailing
	// one comes off before this adds its own. Otherwise half the messages the
	// contract asks to end in a period end in two.
	const detail = describeCause(cause).replace(/\.+$/, '');
	return new Error(`${what}: ${detail}.`, { cause });
}

function describeCause(cause: unknown): string {
	if (cause instanceof DOMException) {
		// `name` carries the actual diagnosis (QuotaExceededError, VersionError),
		// and `message` is frequently empty, so the name leads.
		return cause.message.length > 0 ? `IndexedDB reported ${cause.name}, "${cause.message}"` : `IndexedDB reported ${cause.name}`;
	}
	if (cause instanceof Error && cause.message.length > 0) {
		return cause.message;
	}
	if (cause === null || cause === undefined) {
		return 'the browser gave no reason';
	}
	return String(cause);
}
