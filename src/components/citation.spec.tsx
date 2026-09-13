import type { DailyAggregate } from '@/planner/plan';
import type { Citation, Task } from '@/planner/task';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CitationDisclosure } from '@/components/citation';
import {
	combinedNarratedArtifact,
	rulesById,
	rulesByIdMissingDeepWaterFig,
} from '@/components/this-week/fixtures';

/**
 * The Tasks come out of the fixture Artifact rather than being retyped, so a
 * Citation shape that changes upstream fails here by name instead of quietly
 * rendering against a stale copy of itself.
 */
function fixtureTask(id: string): Task {
	const task = combinedNarratedArtifact.plan.tasks.find(candidate => candidate.id === id);
	if (task === undefined) {
		throw new Error(`the this-week fixture Artifact no longer carries a Task with id '${id}'`);
	}
	return task;
}

const windowTask = fixtureTask('fall-pre-emergent@front-lawn');
const cadenceTask = fixtureTask('deep-water-fig@fig-1');
const projectionTask = fixtureTask('spring-pre-emergent@front-lawn');

/**
 * Every Citation in `src/artifact/fixtures.ts` is a window, a cadence, or a
 * projection. The September run fired on dates and the spring run had not
 * crossed the threshold yet, so nothing in the tree carries a satisfied
 * threshold run. Authored against `spring-pre-emergent`'s own variable, depth
 * and aggregate, so what renders is a run that Rule could really have produced
 * rather than a shape invented to reach a branch.
 */
const thresholdCitation: Citation = {
	kind: 'threshold',
	variable: 'soil-temperature',
	depthCm: 6,
	aggregate: 'mean',
	from: '2026-03-12',
	to: '2026-03-14',
};

/** The depthless side of the same branch. Rainfall is measured at no depth. */
const rainfallCitation: Citation = {
	kind: 'threshold',
	variable: 'precipitation',
	depthCm: null,
	aggregate: 'sum',
	from: '2026-03-12',
	to: '2026-03-14',
};

/**
 * A satisfied run cut out of the window the fixture Artifact already ships,
 * rather than a series authored here. ADR 0003 puts the readings on
 * `Plan.window` so a Citation is evidence somebody can look at, and a Citation
 * pointing at days no window holds would prove the opposite. Three days because
 * that is what `spring-pre-emergent` asks for.
 */
function citedRun(): DailyAggregate[] {
	const observed = combinedNarratedArtifact.plan.window
		.filter(day => day.variable === 'soil-temperature' && day.basis === 'observed')
		.slice(-3);

	if (observed.length !== 3) {
		throw new Error('the this-week fixture window no longer carries three observed soil-temperature days: there is no run to cite');
	}
	return observed;
}

const citedDays = citedRun();

/** The same three days as a Citation, every field read off the aggregates so the two cannot drift apart. */
const windowedCitation: Citation = {
	kind: 'threshold',
	variable: 'soil-temperature',
	depthCm: citedDays[0]?.depthCm ?? null,
	aggregate: citedDays[0]?.aggregate ?? 'mean',
	from: citedDays[0]?.date ?? '',
	to: citedDays[2]?.date ?? '',
};

function ruleFor(task: Task) {
	return rulesById.get(task.ruleId) ?? null;
}

/**
 * Reads one evidence row by its term. Querying the text directly finds two
 * elements, because `RuleSummary`'s "Fires when" sentence opens with the same
 * series words the threshold evidence does. Only the list each row sits in
 * tells them apart, which is what the direct-child path below selects on.
 * Going through the `dt` also means a row that loses its term fails a test,
 * and the term is the half a screen reader announces first.
 */
function evidenceRow(container: HTMLElement, term: string): string {
	const terms = [...container.querySelectorAll('details > div > dl > div > dt')];
	const found = terms.find(node => node.textContent === term);
	if (found === undefined) {
		throw new Error(`no evidence row is termed '${term}': found ${terms.map(node => node.textContent).join(', ')}`);
	}
	return found.nextElementSibling?.textContent ?? '';
}

describe('citationDisclosure', () => {
	it('puts the Task\'s own text in a summary the reader has to open', () => {
		const { container } = render(
			<CitationDisclosure
				summary={windowTask.title}
				citation={windowTask.citation}
				rule={ruleFor(windowTask)}
			/>,
		);

		const details = container.querySelector('details');
		expect(details?.open).toBe(false);
		expect(details?.querySelector('summary')?.textContent)
			.toContain('Apply fall pre-emergent to the front lawn');
	});

	it('dates a window Citation with the day that fell inside the range', () => {
		const { container } = render(
			<CitationDisclosure
				summary={windowTask.title}
				citation={windowTask.citation}
				rule={ruleFor(windowTask)}
			/>,
		);

		expect(evidenceRow(container, 'Inside the window')).toBe('September 11, 2026');
		expect(container.querySelector('time[datetime="2026-09-11"]')?.textContent)
			.toBe('September 11, 2026');
	});

	it('names the run a threshold Citation was satisfied over, and invents no reading', () => {
		const { container } = render(
			<CitationDisclosure
				summary="Apply spring pre-emergent to the front lawn"
				citation={thresholdCitation}
				rule={rulesById.get('spring-pre-emergent') ?? null}
			/>,
		);

		expect(evidenceRow(container, 'Observed run'))
			.toBe('Daily mean soil temperature at 6 cm, March 12, 2026 through March 14, 2026');

		expect(container.querySelector('time[datetime="2026-03-12"]')).not.toBeNull();
		expect(container.querySelector('time[datetime="2026-03-14"]')).not.toBeNull();
	});

	it('shows what was observed on the days a threshold Citation names', () => {
		const { container } = render(
			<CitationDisclosure
				summary="Apply spring pre-emergent to the front lawn"
				citation={windowedCitation}
				rule={rulesById.get('spring-pre-emergent') ?? null}
				window={combinedNarratedArtifact.plan.window}
			/>,
		);

		const readings = evidenceRow(container, 'Readings');

		// Value and unit both come off the DailyAggregate, never off the Rule: the
		// Rule says what it is waiting for and the window says what happened.
		for (const day of citedDays) {
			expect(readings).toContain(`${day.value}°F`);
			expect(container.querySelector(`time[datetime="${day.date}"]`)).not.toBeNull();
		}
	});

	// A window can carry several series at once, so the row has to select the days
	// the Citation names instead of printing whatever the window opens with.
	it('leaves out the days the Citation does not cite', () => {
		const outside = combinedNarratedArtifact.plan.window
			.filter(day => !citedDays.includes(day))
			.map(day => day.value);

		const { container } = render(
			<CitationDisclosure
				summary="Apply spring pre-emergent to the front lawn"
				citation={windowedCitation}
				rule={rulesById.get('spring-pre-emergent') ?? null}
				window={combinedNarratedArtifact.plan.window}
			/>,
		);

		const readings = evidenceRow(container, 'Readings');

		for (const value of outside) {
			expect(readings).not.toContain(`${value}°F`);
		}
	});

	// A missing window is not a zero. The dates the Artifact recorded still
	// render, and nothing stands in for a reading nobody handed over.
	it('renders the run without readings when no window comes with it', () => {
		const { container } = render(
			<CitationDisclosure
				summary="Apply spring pre-emergent to the front lawn"
				citation={windowedCitation}
				rule={rulesById.get('spring-pre-emergent') ?? null}
			/>,
		);

		expect(evidenceRow(container, 'Observed run')).toContain('Daily mean soil temperature at 6 cm');
		expect(screen.queryByText('Readings')).toBeNull();
	});

	it('renders no readings when the window holds nothing for the cited days', () => {
		const { container } = render(
			<CitationDisclosure
				summary="Apply spring pre-emergent to the front lawn"
				citation={thresholdCitation}
				rule={rulesById.get('spring-pre-emergent') ?? null}
				window={combinedNarratedArtifact.plan.window}
			/>,
		);

		expect(evidenceRow(container, 'Observed run'))
			.toBe('Daily mean soil temperature at 6 cm, March 12, 2026 through March 14, 2026');
		expect(screen.queryByText('Readings')).toBeNull();
	});

	it('leaves the depth out of a series that has none', () => {
		const { container } = render(
			<CitationDisclosure
				summary="Skip the watering"
				citation={rainfallCitation}
				rule={null}
			/>,
		);

		expect(evidenceRow(container, 'Observed run'))
			.toBe('Daily total rainfall, March 12, 2026 through March 14, 2026');
	});

	it('renders a projection as expected rather than as observed', () => {
		const { citation } = projectionTask;
		if (citation.kind !== 'threshold-projection') {
			throw new Error('the approaching fixture Task no longer carries a projection Citation');
		}

		const { container } = render(
			<CitationDisclosure
				summary={projectionTask.title}
				citation={citation}
				rule={ruleFor(projectionTask)}
			/>,
		);

		const forecast = evidenceRow(container, 'Forecast');
		expect(forecast).toContain('Daily mean soil temperature at 6 cm is expected to meet the Rule on');
		expect(forecast).toContain('Nothing has met the Rule yet, and a forecast can be revised.');

		// The projected day is read off the fixture rather than retyped. The spring
		// window computes its own crossing, so a hardcoded date here would be a
		// second opinion about when that happens.
		expect(container.querySelector(`time[datetime="${citation.projectedDate}"]`)).not.toBeNull();

		// 'Observed run' is the threshold branch's term. A projection reaching it
		// would be a Task that has not fired reading exactly like one that has,
		// which is the confusion CONTEXT.md's Approaching Task entry forbids.
		expect(screen.queryByText('Observed run')).toBeNull();
	});

	it('shows the elapsed days and the Occurrence a cadence Citation counted from', () => {
		render(
			<CitationDisclosure
				summary={cadenceTask.title}
				citation={cadenceTask.citation}
				rule={ruleFor(cadenceTask)}
			/>,
		);

		expect(screen.getByText('deep-water-fig-2026-08-24')).toBeDefined();
		expect(screen.getByText('18 days')).toBeDefined();
	});

	it('says so when a cadence Rule had nothing to count from', () => {
		render(
			<CitationDisclosure
				summary="Deep water the fig"
				citation={{ kind: 'cadence', lastOccurrenceId: null, elapsedDays: null }}
				rule={ruleFor(cadenceTask)}
			/>,
		);

		expect(screen.getByText('No earlier Occurrence, which is what fired the Rule')).toBeDefined();
		// Both fields are nullable together, and an 'Elapsed' row with nothing
		// beside it would read as a number that failed to load.
		expect(screen.queryByText('Elapsed')).toBeNull();
	});

	it('composes the Rule summary rather than restating the Rule itself', () => {
		render(
			<CitationDisclosure
				summary={windowTask.title}
				citation={windowTask.citation}
				rule={ruleFor(windowTask)}
			/>,
		);

		expect(screen.getByText('Fall pre-emergent')).toBeDefined();
		expect(screen.getByText('· Texas A&M AgriLife Extension')).toBeDefined();
		expect(screen.getByText('August 20 through September 30')).toBeDefined();
	});

	it('hands the Planner\'s stamped delegable flag down to the Rule summary', () => {
		// The fig Rule is delegable on its own and carries no tag policy narrows,
		// so a component that re-derived the answer instead of reading the stamp
		// would print the opposite of this.
		render(
			<CitationDisclosure
				summary={cadenceTask.title}
				citation={cadenceTask.citation}
				rule={ruleFor(cadenceTask)}
				delegable={false}
			/>,
		);

		expect(screen.getByText('Not delegable')).toBeDefined();
	});

	it('names the gap when the rule set does not carry the cited Rule, and still shows the evidence', () => {
		render(
			<CitationDisclosure
				summary={cadenceTask.title}
				citation={cadenceTask.citation}
				rule={rulesByIdMissingDeepWaterFig.get(cadenceTask.ruleId) ?? null}
			/>,
		);

		expect(screen.getByText(/not in the current rule set/)).toBeDefined();
		// The Rule's name is also the Task's text, so absence is checked against
		// something only `RuleSummary` ever renders: the source badge beside it.
		expect(screen.queryByText('· Owner\'s own practice')).toBeNull();
		expect(screen.queryByText('Delegable')).toBeNull();

		// The Artifact carries the evidence whether or not the rule set still
		// carries the Rule, so losing one must not lose the other.
		expect(screen.getByText('deep-water-fig-2026-08-24')).toBeDefined();
		expect(screen.getByText('18 days')).toBeDefined();
	});

	it('renders its children inside the disclosure, below the evidence', () => {
		const { container } = render(
			<CitationDisclosure
				summary={windowTask.title}
				citation={windowTask.citation}
				rule={ruleFor(windowTask)}
			>
				<p>Water in with a quarter inch within 48 hours.</p>
			</CitationDisclosure>,
		);

		const child = screen.getByText('Water in with a quarter inch within 48 hours.');
		expect(container.querySelector('details')?.contains(child)).toBe(true);

		const evidence = container.querySelector('details > div > dl');
		if (evidence === null) {
			throw new Error('the disclosure body no longer carries the Citation\'s own evidence list');
		}
		// Contract: children render below the evidence, so a Task's annotations and
		// deferrals never come between a reader and what fired the work.
		expect(evidence.compareDocumentPosition(child) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it('adds no heading and puts no second control inside the summary', () => {
		// `tests/integration/smoke.spec.ts` runs axe over the home page, where many
		// of these render at once under the route's single h1. A heading here would
		// land at a level that is right in one composition and wrong in the next,
		// and a control nested in a summary fights the disclosure for the same
		// click.
		const { container } = render(
			<CitationDisclosure
				summary={windowTask.title}
				citation={windowTask.citation}
				rule={ruleFor(windowTask)}
			>
				<button type="button">Mark done</button>
			</CitationDisclosure>,
		);

		expect(container.querySelectorAll('h1, h2, h3, h4, h5, h6')).toHaveLength(0);
		expect(container.querySelectorAll('summary a, summary button, summary input')).toHaveLength(0);
	});
});
