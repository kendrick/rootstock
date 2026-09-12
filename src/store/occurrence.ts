import type { Store, StoredRecord } from './store';
import type { Occurrence } from '@/planner/occurrence';

/**
 * What a caller supplies to record that work happened. `ruleId` and
 * `plantId` are the same pair a Task is identified by (see `taskId` in
 * `@/planner/task`), which is the connection a Cadence Rule later reads back
 * through. `completedAt` is the caller's account of when the work happened;
 * it is kept separate from the write-time stamp below because the two differ
 * whenever somebody backfills a day they forgot to log.
 */
export interface RecordOccurrenceInput {
	ruleId: string;
	plantId: string | null;
	completedAt: string;
}

/**
 * The clock and id source `recordOccurrence` reads from, both overridable.
 *
 * A test proving that recording the same work twice yields two distinct
 * `recordedAt` values cannot drive a bare `new Date()`: two calls inside the
 * same millisecond produce the identical ISO string, so the test would pass
 * on most runs and fail, unreproducibly, on a fast machine. Taking the clock
 * as an argument lets a test advance it explicitly instead of racing the
 * system clock. `generateId` is overridable for the same reason a test would
 * want a predictable id rather than a fresh UUID every run.
 */
export interface RecordOccurrenceOptions {
	now?: () => Date;
	generateId?: () => string;
}

/**
 * Records that work happened, writing a brand-new Occurrence through
 * `Store.set`.
 *
 * This never reads an existing record before writing, because there is
 * nothing to reconcile: CONTEXT.md makes an Occurrence append-only, and a
 * Cadence Rule measures from whichever matching record is most recent, so an
 * overwritten history is a wrong plan with nothing left to show for it.
 * `Store.set` enforces the same rule from the other side and rejects a
 * repeat id, which is what makes a minted UUID safe here: the id
 * only has to be fresh, never stable, so there is nothing to look up first.
 *
 * `source` is `'browser'` on both the Occurrence and its envelope, because
 * this function is only ever called by a person tapping something in the
 * running app. The seed path writes its own occurrences directly into
 * `SeedData` and never comes through here.
 */
export async function recordOccurrence(
	store: Store,
	input: RecordOccurrenceInput,
	options: RecordOccurrenceOptions = {},
): Promise<StoredRecord<Occurrence>> {
	const now = options.now ?? (() => new Date());
	const generateId = options.generateId ?? (() => crypto.randomUUID());

	const id = generateId();
	const recordedAt = now().toISOString();

	const occurrence: Occurrence = {
		id,
		ruleId: input.ruleId,
		plantId: input.plantId,
		completedAt: input.completedAt,
		recordedAt,
		source: 'browser',
	};

	const envelope: StoredRecord<Occurrence> = {
		id,
		updatedAt: recordedAt,
		source: 'browser',
		record: occurrence,
	};

	await store.set('occurrences', envelope);

	return envelope;
}
