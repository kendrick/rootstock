/*
 * The one question a second machine has to answer before it spends anything: has today's plan
 * already been published? The owner runs `scripts/daily-run.sh` on more than one box, and each
 * generation reaches Open-Meteo and then spends a `codex exec` call, so a box that cannot tell
 * yesterday's record from today's pays for a Plan that already exists.
 *
 * Nothing here is called a guard. CONTEXT.md gives that word to a Rule that creates no work, and
 * the Artifact gate entry claims it back explicitly. This is "today's run", which is the phrasing
 * `run.ts` already uses for the same idea.
 *
 * Every input is an argument, including the clock and the zone, for the reason `run.ts` gives about
 * `now`: a module that read `Date.now()` would answer differently depending on when a spec happened
 * to run, and the day boundary is the whole subject here.
 */

import type { StatusRecord } from '../src/artifact/artifact';
import { localDate } from '../src/planner/dates';

export interface TodaysRunOptions {
	status: StatusRecord;
	now: Date;
	timeZone: string;
}

/**
 * A union rather than a boolean so the caller can report the skip without re-deriving either date.
 * `GenerationResult` narrows the same way, and the message a scheduled run leaves in its log is the
 * only place anyone will see these two values.
 */
export type TodaysRun
	= | { ran: false }
		| { ran: true; asOf: string; artifactGeneratedAt: string };

/**
 * Reads the status record rather than the Artifact's `plan.asOf`, for two reasons that both come
 * down to which file is guaranteed to be there.
 *
 * Success lives in `status.ok` and nowhere else, and only a successful run closes the day, so an
 * `asOf` check would have to open the status record anyway and would then be assembling one answer
 * out of two files a torn run could leave disagreeing.
 *
 * The other reason is the commit cadence in `daily-run.sh`. It commits `data/status.json` on every
 * run that wrote one, and commits `data/artifact.json` only when it changed. So a second machine
 * fast-forwarding onto the first machine's push is guaranteed to receive the status record and only
 * incidentally guaranteed to receive the Artifact.
 *
 * `artifactGeneratedAt` and `plan.asOf` are the same fact anyway: `run.ts` derives `asOf` from
 * `now`, stamps `generatedAt` from the same `now`, and copies that into `artifactGeneratedAt`.
 * Running `localDate` over it re-derives the Planner's own notion of today.
 *
 * `attemptedAt` is deliberately not consulted. It moves on a failed run, so keying on it would let
 * a failure close the day, which is the opposite of what a second machine is for.
 */
export function todaysRun({ status, now, timeZone }: TodaysRunOptions): TodaysRun {
	// A fresh checkout and an unreadable status file both arrive here as DEFAULT_STATUS, which is
	// `ok: false` with a null stamp. Both mean the day is open, which is the answer that runs.
	if (!status.ok || status.artifactGeneratedAt === null) {
		return { ran: false };
	}

	// Both sides go through `localDate` in the property's zone, never a UTC comparison. A run that
	// finished at 20:06 UTC on the 14th is still the 14th in America/Chicago at 02:30 UTC on the
	// 15th, and a UTC comparison would call that a new day and pay for a second Plan.
	const asOf = localDate(now.toISOString(), timeZone);
	if (localDate(status.artifactGeneratedAt, timeZone) !== asOf) {
		return { ran: false };
	}

	return { ran: true, asOf, artifactGeneratedAt: status.artifactGeneratedAt };
}
