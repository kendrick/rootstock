'use client';

import type { ReactElement } from 'react';
import type { Task } from '@/planner/task';
import Link from 'next/link';
import { safeParseArtifact } from '@/artifact/artifact';
import { loadArtifact } from '@/artifact/load';
import { citationLine } from '@/components/this-week/citation-line';
import { mechanicalRemainder, taskText } from '@/components/this-week/task-text';
import { NARRATOR_BRIEF } from '@/generation/narrator-brief';
import { FOCUS_RING } from '@/lib/focus';
import { seedPlants, seedRules, seedYard } from '@/seed';

/**
 * What this page is allowed to claim.
 *
 * Every figure and every line of work on it is read out of the committed
 * Artifact and the seed. PRODUCT.md records that this product has no customers,
 * testimonials, case studies, press, benchmarks or pricing, and that future work
 * must not invent any: it is one person's tool for one yard. So the argument is
 * made with the real thing or not at all, and the specimen below is whatever the
 * Planner actually authored this morning.
 */
function specimen(): { task: Task; ruleName: string; source: string; instruction: string | null; narrated: string | null; mechanical: string } | null {
	const parsed = safeParseArtifact(loadArtifact().artifact);

	if (!parsed.ok) {
		return null;
	}

	const task = parsed.value.plan.tasks.find(candidate => candidate.status === 'fired')
		?? parsed.value.plan.tasks[0];

	if (task === undefined) {
		return null;
	}

	const rule = seedRules.find(candidate => candidate.id === task.ruleId);
	const ruleName = rule?.name ?? task.ruleId;
	const plant = seedPlants.find(candidate => candidate.id === task.plantId);

	// The same rule the row on This Week follows: with the model on this is its
	// sentence, and with it off the row has already said the Rule's name above, so
	// only the clause the Planner added survives. Printing the whole mechanical
	// title here would say the job's name twice on the page whose argument is that
	// every word of it was derived.
	const narrated = taskText(task.title, parsed.value.narration?.tasks.find(entry => entry.taskId === task.id)?.text ?? null);
	const instruction = narrated === task.title
		? mechanicalRemainder(task.title, ruleName, plant?.name ?? null)
		: narrated;

	return {
		task,
		ruleName,
		source: rule === undefined ? 'the yard\'s own rule set' : rule.source.label,
		instruction,
		// Both renderings of the same job, so the page can show the difference the
		// model makes rather than describing it. The mechanical one is what the
		// Planner wrote into Task.title and is always there; the narrated one exists
		// only when a run had a model and it answered.
		narrated: narrated === task.title ? null : narrated,
		mechanical: task.title,
	};
}

function Callout({ number, children }: { number: number; children: React.ReactNode }): ReactElement {
	return (
		<li className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-x-1">
			<span
				aria-hidden="true"
				className="grid size-6 place-items-center border-2 border-rule font-display text-label leading-none font-extrabold tabular-nums"
			>
				{number}
			</span>
			<span className="font-mono text-detail leading-relaxed text-foreground">{children}</span>
		</li>
	);
}

export default function AboutPage(): ReactElement {
	const found = specimen();

	return (
		<div className="space-y-10">
			{/*
			 * The claim, stated once and at the top. It is the one thing a reader
			 * cannot work out by looking at the plan, and the only thing here a
			 * neighbouring app could not truthfully copy.
			 */}
			<section className="space-y-4">
				<h1 className="max-w-[18ch] font-display text-display leading-[0.95] font-extrabold tracking-tight text-foreground uppercase">
					Nothing here was invented
				</h1>

				<p className="max-w-prose font-mono text-body leading-relaxed text-foreground">
					{`rootstock plans one yard in ${seedYard.region.name}. Every morning it reads the weather, checks the yard's rules against it, and writes a work ticket for the week. Every job on that ticket names the rule that asked for it and the dated reading that fired it.`}
				</p>
			</section>

			{found !== null && (
				<section aria-labelledby="specimen-heading" className="space-y-4 border-t-2 border-rule pt-6">
					<h2 id="specimen-heading" className="font-display text-label font-bold tracking-widest text-muted uppercase">
						This morning's ticket, annotated
					</h2>

					{/* The specimen is a real row from the committed Artifact, rendered in
					    the same grammar the plan uses, with its parts numbered. Showing the
					    actual thing is the argument; describing it would be a claim. */}
					<div className="border-2 border-rule">
						<div
							aria-hidden="true"
							className="grid grid-cols-[3.25rem_minmax(0,1fr)_6.5rem] border-b-2 border-rule font-display text-label font-bold tracking-widest uppercase"
						>
							<span className="border-r-2 border-rule px-2 py-1.5 text-center">Task</span>
							<span className="px-3 py-1.5">Target</span>
							<span className="border-l-2 border-rule px-2 py-1.5 text-center">Sign off</span>
						</div>

						<div className="grid grid-cols-[3.25rem_minmax(0,1fr)_6.5rem] items-stretch">
							<span className="flex items-start justify-center border-r-2 border-rule px-2 py-3 font-display text-title leading-none font-extrabold">
								01
							</span>

							<span className="flex flex-col gap-1 px-3 py-3">
								<span className="font-display text-title leading-none font-bold tracking-wide uppercase">
									{found.ruleName}
									<sup className="ml-1 align-super font-mono text-label text-accent">1</sup>
								</span>
								{found.instruction !== null && (
									<span className="font-mono text-detail leading-relaxed">{found.instruction}</span>
								)}
								<span className="font-mono text-evidence tracking-tight text-accent uppercase">
									{citationLine(found.task.citation)}
									<sup className="ml-1 align-super">2</sup>
								</span>
							</span>

							<span className="relative flex items-center justify-center border-l-2 border-rule p-2">
								<span className="font-display text-label tracking-widest text-muted uppercase">
									Sign off
									<sup className="ml-1 align-super text-accent">3</sup>
								</span>
							</span>
						</div>
					</div>

					<ol className="space-y-3">
						<Callout number={1}>
							{`A rule the yard holds, written down before today and sourced to ${found.source}. Rules are data, not code, and the same rule set is on the `}
							<Link href="/rules" className={`underline underline-offset-4 ${FOCUS_RING}`}>rules page</Link>
							{' in full.'}
						</Callout>
						<Callout number={2}>
							The dated evidence that fired it. A window the date fell inside, a run of readings that held, or an interval that elapsed. It is on the line, always, never behind a link.
						</Callout>
						<Callout number={3}>
							Signed by hand when the work is done. The record is append-only: there is no undo, and the page says so rather than pretending otherwise.
						</Callout>
					</ol>
				</section>
			)}

			<section aria-labelledby="machine-heading" className="space-y-4 border-t-2 border-rule pt-6">
				<h2 id="machine-heading" className="font-display text-label font-bold tracking-widest text-muted uppercase">
					What the model is allowed to do
				</h2>

				<p className="max-w-prose font-mono text-body leading-relaxed text-foreground">
					A pure function writes the tickets. It reads the inventory, the rules, the weather and the history, and returns the week's work. The weather comes from Open-Meteo over plain HTTP; no model is involved in fetching it, and none is involved in deciding what the yard needs.
				</p>

				{/* Two columns, because the boundary is the product and a paragraph
				    describing a limit reads as reassurance. A table reads as a
				    specification. */}
				<div className="grid border-2 border-rule sm:grid-cols-2">
					<div className="border-b-2 border-rule p-4 sm:border-r-2 sm:border-b-0">
						<h3 className="font-display text-label font-bold tracking-widest text-foreground uppercase">May</h3>
						<ul className="mt-2 space-y-1 font-mono text-detail leading-relaxed text-foreground">
							<li>Choose which tasks to mention</li>
							<li>Put them in an order</li>
							<li>Write the sentence each one is described in</li>
							<li>Add an observation of its own, marked as carrying no citation</li>
						</ul>
					</div>

					<div className="p-4">
						<h3 className="font-display text-label font-bold tracking-widest text-accent uppercase">May not</h3>
						<ul className="mt-2 space-y-1 font-mono text-detail leading-relaxed text-foreground">
							<li>Add a task</li>
							<li>Remove one</li>
							<li>Change a date</li>
							<li>Name a rule the plan does not hold</li>
						</ul>
					</div>
				</div>

				<p className="max-w-prose font-mono text-body leading-relaxed text-foreground">
					That last one is checked rather than trusted. Every sentence the model returns is matched against the jobs the planner authored, and prose naming anything else is thrown away whole. The run then publishes the terse sentences the planner had already written, records that it did, and stays green. Losing the writing is not worth a wrong line.
				</p>

				{/* The prompt itself. NARRATOR_BRIEF is the same constant
				    scripts/codex-narrator.ts sends, so the page cannot drift into a
				    flattering paraphrase of what the model was asked. */}
				<div className="space-y-3">
					<h3 className="font-display text-label font-bold tracking-widest text-muted uppercase">
						What it is told, word for word
					</h3>

					<blockquote className="space-y-3 border-2 border-rule p-4 font-mono text-detail leading-relaxed text-foreground">
						{NARRATOR_BRIEF.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
					</blockquote>

					<p className="max-w-prose font-mono text-detail leading-relaxed text-muted">
						That, the finished plan as JSON, and nothing else. The call runs once against a pinned model, in a sandbox that can read but not write. It keeps no memory of the run before it.
					</p>
				</div>

				{found !== null && found.narrated !== null && (
					<div className="space-y-3">
						<h3 className="font-display text-label font-bold tracking-widest text-muted uppercase">
							The same job, written both ways
						</h3>

						<dl className="border-2 border-rule">
							<div className="grid border-b-2 border-rule sm:grid-cols-[9rem_minmax(0,1fr)]">
								<dt className="border-b-2 border-rule px-3 py-2 font-display text-label font-bold tracking-widest text-muted uppercase sm:border-r-2 sm:border-b-0">
									Model on
								</dt>
								<dd className="px-3 py-2 font-mono text-detail leading-relaxed">{found.narrated}</dd>
							</div>
							<div className="grid sm:grid-cols-[9rem_minmax(0,1fr)]">
								<dt className="border-b-2 border-rule px-3 py-2 font-display text-label font-bold tracking-widest text-muted uppercase sm:border-r-2 sm:border-b-0">
									Model off
								</dt>
								<dd className="px-3 py-2 font-mono text-detail leading-relaxed">{found.mechanical}</dd>
							</div>
						</dl>

						<p className="max-w-prose font-mono text-detail leading-relaxed text-muted">
							Same job, same date, same rule, same reading. Only the wording moved. Switch the model off and compare the output yourself.
						</p>
					</div>
				)}
			</section>

			<section aria-labelledby="scope-heading" className="space-y-4 border-t-2 border-rule pt-6">
				<h2 id="scope-heading" className="font-display text-label font-bold tracking-widest text-muted uppercase">
					What this is not
				</h2>

				<p className="max-w-prose font-mono text-body leading-relaxed text-foreground">
					It is one household's tool for one property, published because the pages it builds are static and there is nothing to hide. There is no account to make and nothing to buy. If you are reading this because somebody handed you a link, the work they need is on
					{' '}
					<Link href="/" className={`underline underline-offset-4 ${FOCUS_RING}`}>this week's ticket</Link>
					.
				</p>
			</section>
		</div>
	);
}
