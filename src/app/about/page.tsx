import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import type { Artifact, StatusRecord } from '@/artifact/artifact';
import type { Task } from '@/planner/task';
import type { Rule } from '@/rules/rule';
import { ChevronRight, CirclePause, Info } from 'lucide-react';
import Link from 'next/link';
import { parseStatusRecord, safeParseArtifact } from '@/artifact/artifact';
import { loadArtifact } from '@/artifact/load';
import { WORDMARK } from '@/components/shell/name';
import { StalenessBanner } from '@/components/staleness-banner';
import { citationLine, dayOfMonth } from '@/components/this-week/citation-line';
import { RECORD_DELAY_MS } from '@/components/this-week/permanence';
import { mechanicalRemainder, taskText } from '@/components/this-week/task-text';
import { NARRATOR_BRIEF } from '@/generation/narrator-brief';
import { FOCUS_RING } from '@/lib/focus';
import { seedPlants, seedRules, seedYard } from '@/seed';

/**
 * A server component, unlike the other routes, so it can name itself in the tab.
 * Nothing here reads a clock, the Store, or a hook: every figure comes from the
 * committed Artifact and the seed, which the static export bakes in either way.
 * The title matches the footer and New Here links that bring a reader here, the
 * same rule the nav follows.
 */
export const metadata: Metadata = {
	title: `How this works · ${WORDMARK}`,
};

const PLANNED = new Intl.DateTimeFormat('en-US', {
	weekday: 'long',
	month: 'long',
	day: 'numeric',
	timeZone: 'UTC',
});

const rulesById = new Map(seedRules.map(rule => [rule.id, rule]));

/**
 * What this page is allowed to claim.
 *
 * Every figure and every line of work on it is read out of the committed
 * Artifact and the seed. PRODUCT.md records that this product has no customers,
 * testimonials, case studies, press, benchmarks or pricing, and that future work
 * must not invent any: it is one person's tool for one yard. So the argument is
 * made with the real thing or not at all.
 */
function committedArtifact(): Artifact | null {
	const parsed = safeParseArtifact(loadArtifact().artifact);
	return parsed.ok ? parsed.value : null;
}

/**
 * Null on a record that won't parse, which the page treats the way `ArtifactGate`
 * does on every other route: no Task from the ticket shows. A specimen drawn
 * beside a status nobody could read would hide a failed run behind a missing
 * banner. `parseStatusRecord` throws because the run is its other caller, and a
 * run should stop on a bad record.
 */
function committedStatus(): StatusRecord | null {
	try {
		return parseStatusRecord(loadArtifact().status);
	}
	catch {
		return null;
	}
}

interface Rendered {
	task: Task;
	rule: Rule | null;
	ruleName: string;
	plantName: string | null;
	/** What the row prints under the Rule's name, exactly as This Week prints it. */
	instruction: string | null;
	/** The Narrator's sentence, or null when this run carries none for the Task. */
	narrated: string | null;
	/** What the row prints under the Rule's name with the Narrator off. */
	mechanical: string | null;
}

function rendered(task: Task, artifact: Artifact): Rendered {
	const rule = rulesById.get(task.ruleId) ?? null;
	const ruleName = rule?.name ?? task.ruleId;
	const plantName = seedPlants.find(candidate => candidate.id === task.plantId)?.name ?? null;

	// The same rule the row on This Week follows: with the Narrator on this is its
	// sentence, and with it off the row has already said the Rule's name above, so
	// only the clause the Planner added survives.
	const text = taskText(task.title, artifact.narration?.tasks.find(entry => entry.taskId === task.id)?.text ?? null);
	const mechanical = mechanicalRemainder(task.title, ruleName, plantName);
	// Against both, because a Narrator can hand back exactly the clause the row
	// prints with it off. That sentence changes nothing on This Week, and counting
	// it as the Narrator's would put the same line in both rows of the comparison.
	const narrated = text === task.title || text === mechanical ? null : text;

	return {
		task,
		rule,
		ruleName,
		plantName,
		instruction: narrated ?? mechanical,
		narrated,
		mechanical,
	};
}

/**
 * The row to annotate: fired work first, and among it a Task a Guard reached,
 * since Guards are half of what the page has to explain and a row carrying a
 * Guard's note shows one at work. Then held work, then approaching. Still a real
 * row either way; the preference only picks which one, and `Specimen` draws the
 * sign-off cell each status gets on This Week.
 */
function specimenTask(tasks: readonly Task[]): Task | undefined {
	const fired = tasks.filter(task => task.status === 'fired');
	return fired.find(task => task.deferrals.length > 0 || task.annotations.length > 0)
		?? fired[0]
		?? tasks.find(task => task.status === 'deferred')
		?? tasks[0];
}

/**
 * A second narrated Task for the two-ways comparison, so the Narrator's sentence
 * isn't printed twice in a row. Falls back to the specimen when it's the only
 * narrated Task on the ticket.
 */
function comparisonTask(tasks: readonly Task[], artifact: Artifact, specimen: Task): Rendered | null {
	const candidates = [...tasks.filter(task => task.id !== specimen.id), specimen];

	for (const task of candidates) {
		const row = rendered(task, artifact);
		if (row.narrated !== null) {
			return row;
		}
	}

	return null;
}

function evidenceNote(task: Task): string {
	switch (task.citation.kind) {
		case 'window':
			return 'This Rule applies while the date is inside a set window, so the line gives the day the window closes, then the day it opened.';
		case 'threshold':
			return 'The run of observed days the reading held past the Rule\'s value.';
		case 'threshold-projection':
			return 'The forecast day the reading is expected to cross the Rule\'s value. It can\'t be signed off until the reading actually does.';
		case 'cadence':
			return task.citation.elapsedDays === null
				? 'There\'s no earlier record of this work, so the Rule asks for it now.'
				: 'Days since this work was last recorded, which is past the Rule\'s interval.';
	}
}

const SUP = 'relative -top-[0.4em] ml-1 inline-block align-baseline leading-none font-display text-callout font-extrabold text-muted';

/**
 * A numbered marker on the specimen. `aria-hidden`, because each note below
 * opens with the name of the part it describes. Left audible, a screen reader
 * reads "Fall pre-emergent 1", a stray digit tied to nothing.
 */
function Marker({ n }: { n: number }): ReactElement {
	return <sup aria-hidden="true" className={SUP}>{n}</sup>;
}

/**
 * The line and its marker, with the marker held to the last word. On a phone
 * the evidence line fills its column, and a marker left free wraps onto a
 * line of its own, where it annotates nothing.
 */
function LastWordWith({ n, children }: { n: number; children: string }): ReactElement {
	const cut = children.lastIndexOf(' ') + 1;
	return (
		<>
			{children.slice(0, cut)}
			<span className="whitespace-nowrap">
				{children.slice(cut)}
				<Marker n={n} />
			</span>
		</>
	);
}

function Note({ n, part, children }: { n: number; part: string; children: ReactNode }): ReactElement {
	return (
		<li className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-x-1">
			<span
				aria-hidden="true"
				className="grid size-6 place-items-center border-2 border-rule font-display text-callout leading-none font-extrabold tabular-nums"
			>
				{n}
			</span>
			<span className="text-note text-foreground">
				<span className="block font-display text-label font-extrabold tracking-widest uppercase">{part}</span>
				{children}
			</span>
		</li>
	);
}

// Section heads take the title size, one step above the step and Rule-kind
// labels they sit over. At the heading size, a phone prints HOW A DAY RUNS
// smaller than READ THE WEATHER beneath it.
const H2 = 'scroll-mt-16 font-display text-title leading-[1.1] font-extrabold tracking-wide text-foreground uppercase';
const H3 = 'font-display text-heading font-extrabold tracking-wider text-foreground uppercase';
const LINK = `underline underline-offset-4 ${FOCUS_RING}`;
// A route name in a ruled cell stands alone rather than inside a sentence, so
// it takes the 44px target the rest of the sheet holds itself to.
const CELL_LINK = `inline-flex min-h-11 items-center ${LINK}`;

/**
 * The specimen, drawn in the Task table's own grammar: the same heads, the same
 * columns, and an empty sign-off box where This Week draws one. An annotated
 * specimen only works if the reader recognizes it on the ticket afterwards. It
 * is inert, because a box here that wrote an Occurrence would be a second way to
 * record work from a page that exists to explain it.
 */
function Specimen({ row, artifact }: { row: Rendered; artifact: Artifact }): ReactElement {
	const { task, rule } = row;
	const guardNotes = [
		...task.deferrals.map(deferral => ({ guardId: deferral.guardId, text: deferral.releaseWhen, holds: true })),
		...task.annotations.map(annotation => ({ guardId: annotation.guardId, text: annotation.text, holds: false })),
	];
	const firstGuard = guardNotes[0];
	const guardName = firstGuard === undefined ? null : rulesById.get(firstGuard.guardId)?.name ?? firstGuard.guardId;

	let n = 0;
	const at = {
		rule: ++n,
		plant: row.plantName === null ? null : ++n,
		delegable: task.delegable ? null : ++n,
		instruction: row.instruction === null ? null : ++n,
		evidence: ++n,
		signOff: ++n,
		guard: firstGuard === undefined ? null : ++n,
		drawer: ++n,
	};

	return (
		<>
			<div className="border-2 border-rule">
				<div
					aria-hidden="true"
					className="grid grid-cols-[2.5rem_minmax(0,1fr)_6.5rem] border-b-2 border-rule font-display text-label font-extrabold tracking-widest uppercase sm:grid-cols-[3.25rem_minmax(0,1fr)_6.5rem]"
				>
					<span className="border-r-2 border-rule px-2 py-1.5 text-center">No.</span>
					<span className="px-3 py-1.5">Task</span>
					<span className="border-l-2 border-rule px-2 py-1.5 text-center">Sign off</span>
				</div>

				<div className="grid grid-cols-[2.5rem_minmax(0,1fr)_6.5rem] items-stretch text-body text-foreground sm:grid-cols-[3.25rem_minmax(0,1fr)_6.5rem]">
					<span className={`flex items-start justify-center border-r-2 border-rule px-2 py-3 font-display text-title leading-none font-extrabold ${task.status === 'approaching' ? 'text-muted' : ''}`}>
						01
					</span>

					<span className="flex min-w-0 flex-col gap-1 px-2 py-3 sm:px-3">
						<span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
							<span className="font-display text-title leading-[1.1] font-extrabold tracking-wide wrap-anywhere uppercase">
								{row.ruleName}
								<Marker n={at.rule} />
							</span>
							{row.plantName !== null && (
								<span className="font-display font-semibold text-label tracking-widest text-muted uppercase">
									{row.plantName}
									{at.plant !== null && <Marker n={at.plant} />}
								</span>
							)}
							{!task.delegable && (
								<span className="whitespace-nowrap">
									<span className="border border-foreground px-1 font-display text-label font-extrabold tracking-widest text-foreground uppercase">
										Not delegable
									</span>
									{at.delegable !== null && <Marker n={at.delegable} />}
								</span>
							)}
						</span>
						{row.instruction !== null && at.instruction !== null && (
							<span className="min-w-0">
								<LastWordWith n={at.instruction}>{row.instruction}</LastWordWith>
							</span>
						)}
						<span className="font-mono text-evidence tracking-tight text-foreground uppercase">
							<LastWordWith n={at.evidence}>{citationLine(task.citation, rule)}</LastWordWith>
						</span>
					</span>

					{task.status === 'approaching'
						? (
								<span className="flex flex-col items-center justify-center gap-1 border-l-2 border-rule p-2 text-center font-display text-label font-extrabold tracking-widest text-muted uppercase">
									<span>
										Not yet
										<Marker n={at.signOff} />
									</span>
									{task.citation.kind === 'threshold-projection' && (
										<span className="font-mono text-evidence tracking-tight">{`About ${dayOfMonth(task.citation.projectedDate)}`}</span>
									)}
								</span>
							)
						: (
								<span className="flex flex-col items-center justify-center gap-1.5 border-l-2 border-rule p-2">
									{task.status === 'deferred' && (
										<span className="border-2 border-foreground px-1.5 py-0.5 font-display text-label font-extrabold tracking-widest text-foreground uppercase">
											Held
										</span>
									)}
									<span aria-hidden="true" className="size-8 border-2 border-foreground" />
									<span className="font-display font-semibold text-label tracking-widest text-foreground uppercase">
										Sign off
										<Marker n={at.signOff} />
									</span>
								</span>
							)}
				</div>

				{guardNotes.length > 0 && (
					<div className="space-y-1.5 px-3 pb-2.5">
						{guardNotes.map((note, index) => (
							// The same two shapes This Week prints under a row: a Deferral names
							// the Guard and what releases it, an Annotation the Guard and its note.
							<p key={`${note.guardId}:${note.text}`} className="flex items-start gap-2 text-note text-muted">
								{note.holds
									? <CirclePause aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
									: <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
								<span className="min-w-0 max-w-prose">
									{note.holds
										? (
												<>
													{'Held back by '}
													<span className="font-medium text-foreground">{rulesById.get(note.guardId)?.name ?? note.guardId}</span>
													<span className="block">
														{'Releases when: '}
														<span className="text-foreground">{note.text}</span>
													</span>
												</>
											)
										: (
												<>
													<span className="font-medium text-foreground">{rulesById.get(note.guardId)?.name ?? note.guardId}</span>
													{': '}
													<span className="text-foreground">{note.text}</span>
												</>
											)}
									{index === 0 && at.guard !== null && <Marker n={at.guard} />}
								</span>
							</p>
						))}
					</div>
				)}

				{/* Inert, like the box. On This Week this is the `<details>` every row
				    ends in, and it's the path a skeptic takes to check a Task, so the
				    specimen draws it rather than leaving it for the reader to find. */}
				<div className="flex min-h-11 items-center gap-2 border-t border-border px-3 py-2 text-note">
					<ChevronRight aria-hidden="true" className="size-4 shrink-0 text-foreground" />
					<span className="min-w-0 flex-1">
						<span className="font-medium text-foreground">Rule and evidence</span>
						<span className="text-muted-foreground">{` · ${row.ruleName}`}</span>
						<Marker n={at.drawer} />
					</span>
				</div>
			</div>

			<ol aria-label="What each part of the row is" className="space-y-3">
				<Note n={at.rule} part="Rule">
					{`The Rule that asked for this work. It was written down in advance, sourced to ${rule?.source.label ?? 'the yard\'s own rule set'}, and every Rule the yard holds is on the `}
					<Link href="/rules" className={LINK}>Rules page</Link>
					.
				</Note>
				{at.plant !== null && (
					<Note n={at.plant} part="Plant">
						The Plant this Task is for. A Rule can reach several Plants, and each one gets a Task of its own.
					</Note>
				)}
				{at.delegable !== null && (
					<Note n={at.delegable} part="Not delegable">
						The rest of the household may not do this work, so it stays off the Away Card. The Rule decides that when it&apos;s written, and the yard&apos;s tag policy can only narrow it. A Rule tagged chemical is never delegable, whatever it says.
					</Note>
				)}
				{at.instruction !== null && (
					<Note n={at.instruction} part="Instruction">
						{row.narrated === null
							? 'What to do, in the Planner\'s own words.'
							: 'What to do, in the Narrator\'s words. The Narrator chooses wording and nothing else; the section below lists what it may change.'}
					</Note>
				)}
				<Note n={at.evidence} part="Evidence">
					{`${evidenceNote(task)} It prints on every row, and nothing on the page can fold it away.`}
				</Note>
				{task.status === 'approaching'
					? (
							<Note n={at.signOff} part="Not yet">
								This is approaching work: the forecast says the reading will cross the Rule&apos;s value, and it hasn&apos;t yet. There&apos;s no box to sign off until it does, and the cell gives the day the forecast expects.
							</Note>
						)
					: (
							<Note n={at.signOff} part="Sign off">
								{`${task.status === 'deferred' ? 'A Guard is holding this Task back, so the box sits under a HELD mark. The box still works, because a Deferral is advice. ' : ''}Tap the box on This Week when the work is done. A second tap within ${RECORD_DELAY_MS / 1000} seconds cancels; after that the record stays. It's saved in this browser only, so it doesn't change the published ticket or tell anyone else. Tomorrow's plan can't see it either, because the Planner reads the record of work the owner keeps in the repository. A Task can come back until the owner records it there.`}
							</Note>
						)}
				{at.guard !== null && firstGuard !== undefined && (
					<Note n={at.guard} part="Guard">
						{firstGuard.holds
							? `${guardName} is a Guard, and it's holding this Task back until the condition it names is met. The Task stays on the ticket while it waits.`
							: `${guardName} is a Guard, and this is its note on the Task. A Guard creates no work of its own and can't remove a Task. The note prints from the Plan whether or not the Narrator's sentence repeats it.`}
					</Note>
				)}
				<Note n={at.drawer} part="Rule and evidence">
					On This Week this strip is a drawer. Opening it shows the Rule&apos;s source and the values it checks, along with the dated readings behind this Task.
				</Note>
			</ol>

			<p className="max-w-prose text-note text-muted">
				{`From the ticket planned ${PLANNED.format(new Date(`${artifact.plan.asOf}T00:00:00Z`))}.`}
			</p>
		</>
	);
}

/**
 * The day in order. Numbered because the order is the information: each step
 * reads only what the one before it produced, and a reader checking a claim
 * needs to know which step could have made it.
 */
const DAY: readonly { step: string; body: ReactNode }[] = [
	{
		step: 'Read the weather',
		body: 'At 06:00 a scheduled job on the owner\'s computer fetches the yard\'s recent and forecast weather and soil readings from Open-Meteo. The yard\'s exact location lives on that computer and goes out only in that request. It never enters the code or this site.',
	},
	{
		step: 'Plan the week',
		body: 'The Planner checks every Rule against those readings, the list of Plants, and the record of work the owner keeps in the repository. For each Rule that applies, it writes one Task per Plant the Rule reaches, and it sets the order they appear in. It\'s ordinary code with no language model in it, and nothing else in the system can create a Task.',
	},
	{
		step: 'Apply the Guards',
		body: 'A Guard is a Rule that creates no work. It looks over the Tasks the Planner wrote and can hold one back, saying what would release it, or add a note to it. No Guard can delete a Task, so held-back work stays on the ticket, marked.',
	},
	{
		step: 'Write it up',
		body: 'The Narrator, a language model, gets the finished Plan and writes a short summary of the week and a plain sentence for each Task. If it fails, or answers about a Task that isn\'t in the Plan, the ticket goes out in the Planner\'s own shorter wording instead.',
	},
	{
		step: 'Publish',
		body: 'The run saves the result as one file, the Artifact, commits it to the project\'s repository, and pushes. Pushing is what deploys it, because GitHub Pages rebuilds this site from the repository. The site is static pages, so nothing runs on a server and your browser never calls a model.',
	},
	{
		step: 'Show its age',
		body: 'Every page that shows the ticket, this one included, works out how old the Artifact is when you open it. It warns you once the Artifact is more than 36 hours old. If a run fails, the last good ticket stays up and the page says the run failed.',
	},
];

const KINDS: readonly { kind: string; fires: string }[] = [
	{ kind: 'Window', fires: 'Applies while the date is inside a set range, like a fall pre-emergent window.' },
	{ kind: 'Threshold', fires: 'Applies once an observed reading, like soil temperature, has held past a value for enough days in a row. A forecast can\'t set one off; forecast work shows as Approaching until the reading arrives.' },
	{ kind: 'Cadence', fires: 'Applies when enough time has passed since the work was last recorded, or when it never has been.' },
	{ kind: 'Guard', fires: 'Creates no work. Holds a Task back or adds a note to it.' },
];

const DL_ROW = 'grid border-b-2 border-rule last:border-b-0 sm:grid-cols-[9rem_minmax(0,1fr)]';
const DT = 'flex items-center border-b-2 border-rule px-3 py-2 font-display text-label font-extrabold tracking-widest text-foreground uppercase sm:border-r-2 sm:border-b-0';

function Ruled({ rows }: { rows: readonly { key: string; term: ReactNode; detail: ReactNode }[] }): ReactElement {
	return (
		<dl className="border-2 border-rule">
			{rows.map(row => (
				<div key={row.key} className={DL_ROW}>
					<dt className={DT}>{row.term}</dt>
					<dd className="px-3 py-2 text-note text-foreground">{row.detail}</dd>
				</div>
			))}
		</dl>
	);
}

function ComparedHead({ row }: { row: Rendered }): ReactElement {
	return (
		<span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
			<span className="font-display text-heading font-extrabold tracking-wider uppercase">{row.ruleName}</span>
			{row.plantName !== null && (
				<span className="font-display font-semibold text-label tracking-widest text-muted uppercase">{row.plantName}</span>
			)}
		</span>
	);
}

const CONTENTS = [
	{ href: '#day', label: 'How a day runs' },
	{ href: '#specimen', label: 'Nothing here was invented' },
	{ href: '#site', label: 'Using the site' },
	{ href: '#narrator', label: 'What the Narrator may do' },
] as const;

export default function AboutPage(): ReactElement {
	const artifact = committedArtifact();
	const status = committedStatus();
	const readable = artifact !== null && status !== null ? artifact : null;
	const specimen = readable === null ? undefined : specimenTask(readable.plan.tasks);
	const row = readable === null || specimen === undefined ? null : rendered(specimen, readable);
	const compared = readable === null || specimen === undefined ? null : comparisonTask(readable.plan.tasks, readable, specimen);

	return (
		<div className="space-y-10">
			{/*
			 * What the site is, before any claim about it. "Nothing here was invented"
			 * answers a question a cold reader hasn't asked yet, so it heads the
			 * specimen instead, where the page proves it.
			 */}
			<section className="space-y-4">
				<h1 className="font-display text-display leading-[0.95] font-extrabold tracking-tight text-foreground uppercase">
					How this works
				</h1>

				<p className="max-w-prose text-body text-foreground">
					{`${WORDMARK} is a weekly work ticket for one yard in ${seedYard.region.name}. Every morning it reads the weather, checks the yard's Rules against it, and lists what the yard needs this week. Each Task on the list names the Rule that asked for it and the evidence behind it, so you can check why it's there.`}
				</p>

				<p className="max-w-prose text-body text-foreground">
					It&apos;s built for the household that looks after this yard. The owner works from
					{' '}
					<Link href="/" className={LINK}>This Week</Link>
					, and the rest of the household gets a printable Away Card listing only the work they may do. If the owner gave you an Away Card, that card is your list. There&apos;s no account to make and nothing to buy.
				</p>

				{/* Sticky from sm, where the four links fit one row. On a phone they wrap
				    to two, and a bar that tall would sit over the work being read. */}
				<nav aria-label="On this page" className="border-y-2 border-rule bg-background sm:sticky sm:top-0 sm:z-10">
					<ul className="flex flex-wrap gap-x-6">
						{CONTENTS.map(({ href, label }) => (
							<li key={href}>
								<a
									href={href}
									className={`inline-flex min-h-11 items-center font-display text-label font-extrabold tracking-widest text-foreground uppercase underline underline-offset-4 ${FOCUS_RING}`}
								>
									{label}
								</a>
							</li>
						))}
					</ul>
				</nav>
			</section>

			<section aria-labelledby="words" className="space-y-4">
				<h2 id="words" className={H2}>The words this page uses</h2>
				<Ruled
					rows={[
						{ key: 'task', term: 'Task', detail: 'One piece of work, from exactly one Rule, carrying the evidence that set that Rule off. Only the Planner can create one.' },
						{ key: 'rule', term: 'Rule', detail: 'Something the yard needs and the condition that calls for it, written down in advance with the source it came from.' },
						{ key: 'plan', term: 'Plan', detail: 'Every Task the Planner produced for one date. The ticket is how the site prints the Plan.' },
						{ key: 'artifact', term: 'Artifact', detail: 'The one file each morning\'s run publishes. It holds the Plan, the readings behind it, and whether the Narrator wrote the wording.' },
					]}
				/>
			</section>

			<section aria-labelledby="day" className="space-y-4 border-t-2 border-rule pt-6">
				<h2 id="day" className={H2}>How a day runs</h2>

				<ol className="border-2 border-rule">
					{DAY.map(({ step, body }, index) => (
						<li
							key={step}
							className="grid grid-cols-[2.5rem_minmax(0,1fr)] border-t-2 border-rule first:border-t-0 sm:grid-cols-[3.25rem_minmax(0,1fr)]"
						>
							<span aria-hidden="true" className="flex items-start justify-center border-r-2 border-rule px-2 py-3 font-display text-title leading-none font-extrabold tabular-nums">
								{String(index + 1).padStart(2, '0')}
							</span>
							<span className="flex min-w-0 flex-col gap-1 px-2 py-3 sm:px-3">
								<span className="font-display text-heading font-extrabold tracking-wider uppercase">{step}</span>
								<span className="max-w-prose text-note text-foreground">{body}</span>
							</span>
						</li>
					))}
				</ol>

				<h3 className={H3}>Four kinds of Rule</h3>
				<p className="max-w-prose text-note text-foreground">
					Rules are stored as data. Each carries the source it came from and whether the household may do its work, which the tag policy can narrow but never widen. Three kinds ask for work, and the evidence line on a Task depends on which one did.
				</p>
				<Ruled rows={KINDS.map(({ kind, fires }) => ({ key: kind, term: kind, detail: fires }))} />
			</section>

			<section aria-labelledby="specimen" className="space-y-4 border-t-2 border-rule pt-6">
				<h2 id="specimen" className={H2}>Nothing here was invented</h2>

				{readable === null
					? (
							<p className="max-w-prose text-body text-foreground">
								The current ticket couldn&apos;t be read, so there&apos;s no Task to show here.
								{' '}
								<Link href="/" className={LINK}>This Week</Link>
								{' '}
								says what went wrong.
							</p>
						)
					: (
							<>
								{status !== null && <StalenessBanner generatedAt={readable.generatedAt} status={status} />}
								{row === null
									? (
											// A Plan with no Tasks is a normal answer, a quiet week, and
											// the unreadable-ticket sentence above would send the reader
											// looking for an error that doesn't exist.
											<p className="max-w-prose text-body text-foreground">
												The current ticket has no Tasks, so there&apos;s no row to annotate. No Rule found anything for the yard to do this week, and the
												{' '}
												<Link href="/rules" className={LINK}>Rules page</Link>
												{' '}
												says what each one is waiting for.
											</p>
										)
									: (
											<>
												<p className="max-w-prose text-body text-foreground">
													Here is one real Task from the current ticket, drawn the way This Week draws it, with each part numbered.
												</p>
												<Specimen row={row} artifact={readable} />
											</>
										)}
							</>
						)}
			</section>

			<section aria-labelledby="site" className="space-y-4 border-t-2 border-rule pt-6">
				<h2 id="site" className={H2}>Using the site</h2>

				<Ruled
					rows={[
						{
							key: 'this-week',
							term: <Link href="/" className={CELL_LINK}>This Week</Link>,
							detail: 'The ticket itself. Work that\'s due now comes first, each Task with its Rule, its evidence, and a box to sign it off. Forecast work sits under Approaching, and weather worth knowing that no Rule produced sits apart under Also observed. The margin counts the week\'s Tasks and how many are still open in this browser. The number in the sheet\'s head is the date you\'re reading it, as the year and the day of the year. It isn\'t the day the ticket was planned, which the ticket gives separately.',
						},
						{
							key: 'yard',
							term: <Link href="/yard" className={CELL_LINK}>Yard</Link>,
							detail: 'A photo of the property with a numbered mark on each Plant that has a place on it, keyed to a list of every Plant. Open a Plant to see which Rules reach it and what it has on this week\'s ticket.',
						},
						{
							key: 'rules',
							term: <Link href="/rules" className={CELL_LINK}>Rules</Link>,
							detail: 'Every Rule the yard holds, grouped by whether it asked for work this week, is approaching, is waiting, or is a Guard, with what each one is waiting for and where it came from.',
						},
						{
							key: 'away-card',
							term: 'Away Card',
							detail: 'A printable list of only the Tasks the rest of the household may do. It counts the Tasks it leaves off without naming them. Its address isn\'t published anywhere on the site, so the owner hands out the link.',
						},
					]}
				/>
			</section>

			<section aria-labelledby="narrator" className="space-y-4 border-t-2 border-rule pt-6">
				<h2 id="narrator" className={H2}>What the Narrator may do</h2>

				<p className="max-w-prose text-body text-foreground">
					The Narrator is a language model. It gets the finished Plan and sends back wording, and wording is all it can change.
				</p>

				{/* Two columns, because the boundary is the product and a paragraph
				    describing a limit reads as reassurance. A table reads as a
				    specification. */}
				<div className="grid border-2 border-rule sm:grid-cols-2">
					<div className="border-b-2 border-rule p-4 sm:border-r-2 sm:border-b-0">
						<h3 className={H3}>May</h3>
						<ul className="mt-2 space-y-1 text-note text-foreground">
							<li>Write a short summary of the week, shown on This Week above the Tasks</li>
							<li>Write one sentence for each Task</li>
							<li>Skip a Task. It still shows, in the Planner&apos;s wording.</li>
							<li>Add an Advisory, something it noticed that no Rule produced. This Week shows it apart, under Also observed, marked as citing nothing.</li>
						</ul>
					</div>

					<div className="p-4">
						<h3 className={H3}>May not</h3>
						<ul className="mt-2 space-y-1 text-note text-foreground">
							<li>Add a Task</li>
							<li>Remove a Task</li>
							<li>Change a date</li>
							<li>Change a Task&apos;s Rule or its evidence</li>
							<li>Change the order. The Planner sets it.</li>
						</ul>
					</div>
				</div>

				{/*
				 * Says what `validateNarration` checks and no more: Task ids, not
				 * sentences. A reader who opens narrator.ts and finds the page claiming
				 * more has caught it overclaiming on the one point it asks to be
				 * trusted on.
				 */}
				<p className="max-w-prose text-body text-foreground">
					Most of that holds because the Narrator&apos;s answer has nowhere to put a date, a Rule or evidence, so the ticket prints those from the Plan. It points at Tasks by the IDs the Planner gave them. If any ID isn&apos;t in the Plan, the run throws the whole Narration away and publishes the Planner&apos;s wording instead. The Artifact records that, and the run still counts as a success. Losing the writing is not worth a wrong line.
				</p>
				<p className="max-w-prose text-body text-foreground">
					No code checks what a sentence says. That&apos;s why every row still shows its Rule and evidence, straight from the Plan, beside the Narrator&apos;s words.
				</p>

				{/*
				 * The prompt itself, folded, because it's the proof for the reader who
				 * doubts the table and noise for everyone else. NARRATOR_BRIEF is the
				 * same constant scripts/codex-narrator.ts sends, so the page cannot
				 * drift into a flattering paraphrase of what the model was asked.
				 */}
				<details className="group border-2 border-rule">
					<summary className={`flex min-h-11 list-none items-center gap-2 px-4 py-2 font-display text-label font-extrabold tracking-widest text-foreground uppercase [&::-webkit-details-marker]:hidden ${FOCUS_RING}`}>
						<ChevronRight aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-90" />
						The exact instruction it&apos;s given
					</summary>
					<div className="space-y-3 border-t-2 border-rule p-4">
						<blockquote className="max-w-[65ch] space-y-3 font-mono text-evidence leading-relaxed text-foreground">
							{NARRATOR_BRIEF.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
						</blockquote>
						<p className="max-w-prose text-note text-muted">
							Its prompt is that instruction, the finished Plan as JSON, and the shape its answer has to take. The tool that runs the model adds its own standing instructions on top. It runs once a day on a fixed model, in a sandbox that can read files but not change them, and keeps no memory between runs.
						</p>
					</div>
				</details>

				{/* Whether the Narrator ran comes from the Artifact's own record. A
				    narrated ticket can still offer no Task to compare, when the
				    Narrator skipped every Task or kept the Planner's wording. */}
				{readable !== null && (compared === null
					? (
							<p className="max-w-prose text-note text-muted">
								{readable.narrated
									? 'The current ticket carries the Narrator\'s wording, but none of its sentences differs from the Planner\'s, so there\'s no Task to show both ways.'
									: 'The current ticket went out without the Narrator, so every row shows the Planner\'s own wording.'}
							</p>
						)
					: (
							<div className="space-y-3">
								<h3 className={H3}>The same Task, written two ways</h3>
								{/* Each side printed the way a row prints it: the Rule and Plant
								    as the row's head, then the line under it. With the Narrator
								    off that line is only what the Planner added to the Rule's
								    name, and often there's nothing. */}
								<dl className="border-2 border-rule">
									<div className={DL_ROW}>
										<dt className={DT}>Narrator on</dt>
										<dd className="flex flex-col gap-1 px-3 py-2">
											<ComparedHead row={compared} />
											<span className="text-body">{compared.narrated}</span>
										</dd>
									</div>
									<div className={DL_ROW}>
										<dt className={DT}>Narrator off</dt>
										<dd className="flex flex-col gap-1 px-3 py-2">
											<ComparedHead row={compared} />
											{compared.mechanical === null
												? <span className="text-note text-muted">The row has no line under the Rule&apos;s name, because the Planner added nothing to it.</span>
												: <span className="text-body">{compared.mechanical}</span>}
										</dd>
									</div>
								</dl>
								<p className="max-w-prose text-note text-muted">
									The Task, date, Rule and evidence are the same, and only the wording differs. The Artifact records which of the two the ticket carries, and the current one carries the Narrator&apos;s.
								</p>
							</div>
						))}
			</section>
		</div>
	);
}
