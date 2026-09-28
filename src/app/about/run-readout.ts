import type { Artifact, StatusRecord } from '@/artifact/artifact';
import type { CheckLabel } from '@/components/rules/waiting';
import type { DailyAggregate } from '@/planner/plan';
import type { Rule } from '@/rules/rule';
import { groupChecks, standingFor } from '@/components/rules/waiting';
import { dayOfMonth } from '@/components/this-week/citation-line';

/** One line per step of How a day runs, each read off the committed Artifact or its status record. */
export interface RunReadout {
	weather: string;
	plan: string;
	guards: string;
	narration: string;
	publish: string;
	age: string;
}

export interface ReadoutContext {
	/** The build's Rules, for the count and the Guard names. */
	rules: readonly Rule[];
	/** The build's `seedPlannedFrom`, to tell whether those Rules are the ones the run read. */
	seedFingerprint: string;
}

// UTC, labelled. The property's zone lives only in the run's env, beside the
// coordinates (docs/operations/daily-run.md), so the Pages build doesn't have
// it. Formatting in whatever zone the build box sits in would bake a time
// nobody chose into the export. UTC is one every build agrees on, and a reader
// can check it against `generatedAt` by eye.
const INSTANT = new Intl.DateTimeFormat('en-US', {
	weekday: 'short',
	month: 'short',
	day: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23',
	timeZone: 'UTC',
});

function instant(iso: string): string {
	const parts = Object.fromEntries(INSTANT.formatToParts(Date.parse(iso)).map(part => [part.type, part.value]));
	return `${parts.weekday} ${parts.month} ${parts.day}, ${parts.hour}:${parts.minute} UTC`;
}

function count(n: number, one: string, many: string): string {
	return `${n} ${n === 1 ? one : many}`;
}

function variableName(day: DailyAggregate): string {
	switch (day.variable) {
		case 'soil-temperature':
			return day.depthCm === null ? 'soil temperature' : `soil temperature at ${day.depthCm} cm`;
		case 'precipitation-probability':
			return 'rain chance';
		case 'precipitation':
			return 'rainfall';
	}
}

/**
 * Counts distinct dates. The window holds one DailyAggregate per variable per
 * day, so its length overcounts the days it covers.
 */
function weather(window: readonly DailyAggregate[]): string {
	const dates = [...new Set(window.map(day => day.date))].sort();
	const first = dates[0];
	const last = dates.at(-1);
	if (first === undefined || last === undefined) {
		return 'No readings in the Plan\'s window';
	}

	const observed = new Set(window.filter(day => day.basis === 'observed').map(day => day.date));
	const forecast = dates.filter(date => !observed.has(date)).length;
	const variables = [...new Set(window.map(variableName))];

	return `${count(dates.length, 'day', 'days')}, ${dayOfMonth(first)} – ${dayOfMonth(last)} / ${observed.size} observed, ${forecast} forecast / ${variables.join(', ')}`;
}

/**
 * The Rule count comes from the build's seed, not the Artifact, so it prints
 * only when the fingerprint says the run read that same seed (ADR 0007).
 * Otherwise the count describes today's Rules beside a Plan made from others.
 */
function plan(artifact: Artifact, context: ReadoutContext): string {
	const held = artifact.plannedFrom === context.seedFingerprint ? `${count(context.rules.length, 'Rule', 'Rules')} held / ` : '';
	const { tasks } = artifact.plan;
	if (tasks.length === 0) {
		return `${held}No Tasks written`;
	}

	const rules = new Set(tasks.map(task => task.ruleId)).size;
	const plants = new Set(tasks.flatMap(task => task.plantId === null ? [] : [task.plantId])).size;
	const reach = plants === 0 ? '' : `, for ${count(plants, 'Plant', 'Plants')}`;

	return `${held}${count(tasks.length, 'Task', 'Tasks')} from ${count(rules, 'Rule', 'Rules')}${reach}`;
}

const DID: Record<CheckLabel, string> = {
	'Deferring:': 'deferred',
	'Annotating:': 'annotated',
	'Let through unchecked:': 'let through unchecked',
	'Let through:': 'let through',
};

/**
 * Goes through `standingFor`, the Rules page's own reading of `guardChecks`,
 * so the two pages can't disagree about what a Guard did. That includes the
 * older Artifact with no verdicts, where only a mark counts and nothing is
 * called clear.
 */
function guards(artifact: Artifact, context: ReadoutContext): string {
	const { tasks } = artifact.plan;
	if (tasks.length === 0) {
		return 'No Tasks for a Guard to check';
	}

	const lines = context.rules
		.filter(rule => rule.kind === 'guard')
		.flatMap((rule) => {
			const groups = groupChecks(standingFor(rule, artifact.plan).checks);
			return groups.length === 0 ? [] : [`${rule.name}: ${groups.map(({ label, titles }) => `${DID[label]} ${titles.length}`).join(', ')}`];
		});
	if (lines.length > 0) {
		return lines.join(' / ');
	}

	return tasks.every(task => task.guardChecks !== null) ? 'No Guard reached a Task' : 'No Guard left a mark';
}

/**
 * `narrated` false covers both a Narrator that was off and one whose answer
 * was thrown away, so the line names the absence and not a cause.
 */
function narration(artifact: Artifact): string {
	if (artifact.narration === null) {
		return 'No Narration / Planner\'s wording on every Task';
	}

	const advisories = count(artifact.narration.advisories.length, 'Advisory', 'Advisories');
	const total = artifact.plan.tasks.length;
	if (total === 0) {
		return `Narrator wrote the summary only / ${advisories}`;
	}

	const planned = new Set(artifact.plan.tasks.map(task => task.id));
	const worded = artifact.narration.tasks.filter(entry => planned.has(entry.taskId)).length;

	return `Narrator wrote ${worded} of ${total} Task sentences / ${advisories}`;
}

/**
 * Status facts, not an age. An age needs the reader's clock, and this page is
 * a server component baked into a static export, so a figure computed here
 * would be the build's age forever. `StalenessBanner` already does the
 * clock-side job above the specimen, and it renders nothing on a fresh ticket,
 * which would leave this row blank most days. The status record is what the
 * banner reasons from, and it stays true however long the page sits.
 */
function age(status: StatusRecord): string {
	return `Last run ${instant(status.attemptedAt)}: ${status.ok ? 'published' : 'failed'} / ${count(status.consecutiveFailures, 'failure', 'failures')} in a row`;
}

export function runReadout(artifact: Artifact, status: StatusRecord, context: ReadoutContext): RunReadout {
	return {
		weather: weather(artifact.plan.window),
		plan: plan(artifact, context),
		guards: guards(artifact, context),
		narration: narration(artifact),
		publish: `Generated ${instant(artifact.generatedAt)}`,
		age: age(status),
	};
}
