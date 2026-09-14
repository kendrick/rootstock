import type { Artifact } from '@/artifact/artifact';
import type { GuardRule, Rule } from '@/rules/rule';
import type { Store } from '@/store/store';
import type { LawnDetail, Plant } from '@/yard/plant';
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
	createYardStore,
	figPlant,
	lawnPlant,
	occurrenceFixtures,
	plannedPlant,
	plantFixtures,
	ruleFixtures,
	unplacedPlantedPlant,
	yardArtifact,
} from './fixtures';
import { PlantSheet } from './plant-sheet';

function plantFixture(id: string): Plant {
	const plant = plantFixtures.find(candidate => candidate.id === id);
	if (plant === undefined) {
		throw new Error(`the plant fixtures carry no plant '${id}': this test has nothing to open.`);
	}
	return plant;
}

function lawnDetailOf(plant: Plant): LawnDetail {
	if (plant.lawn === null) {
		throw new Error(`fixture '${plant.id}' carries no lawn detail: this test has nothing to assert against.`);
	}
	return plant.lawn;
}

function guardFixture(effect: GuardRule['effect']): GuardRule {
	const rule = ruleFixtures.find(
		(candidate): candidate is GuardRule => candidate.kind === 'guard' && candidate.effect === effect,
	);
	if (rule === undefined) {
		throw new Error(`the rule fixtures carry no '${effect}' Guard: this test has nothing to render.`);
	}
	return rule;
}

/** The seed's Occurrences all name this one, so it is the only fixture Plant with a history to sort. */
const esperanzaPlant = plantFixture('esperanza-1');
/** The one seed Plant carrying `notes`, which is otherwise null everywhere and would leave the field untested. */
const notedPlant = plantFixture('hibiscus-watermelon-ruffles');

function renderSheet(plant: Plant | null, overrides: {
	rules?: Rule[];
	artifact?: Artifact;
	store?: Store;
} = {}): void {
	render(
		<PlantSheet
			plant={plant}
			rules={overrides.rules ?? ruleFixtures}
			plants={plantFixtures}
			artifact={overrides.artifact ?? yardArtifact}
			// Every test injects a Store. The default would reach for IndexedDB,
			// which jsdom does not have—and a spec that let it try would be
			// asserting against the failure state without meaning to.
			store={overrides.store ?? createYardStore()}
			onOpenChange={vi.fn()}
		/>,
	);
}

/**
 * Waits out the store read the sheet starts on open. Every assertion below runs
 * after it, so none lands mid-flight and no state update escapes into the next
 * test.
 */
async function settled(): Promise<void> {
	await waitFor(() => {
		expect(screen.queryByText(/Reading what has been recorded here/)).toBeNull();
	});
}

/** The section under one heading. The Rule an Occurrence names also appears in the Rules list, so history assertions have to be scoped to the part of the sheet that claims to be history. */
function section(heading: string): HTMLElement {
	const element = screen.getByRole('heading', { name: heading }).parentElement;
	if (element === null) {
		throw new Error(`the '${heading}' heading has no section around it.`);
	}
	return element;
}

describe('plantSheet', () => {
	it('renders no dialog at all while no Plant is selected', () => {
		renderSheet(null);

		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('opens for the selected Plant, naming it and its kind', async () => {
		renderSheet(lawnPlant);
		await settled();

		expect(screen.getByRole('dialog')).toBeDefined();
		expect(screen.getByRole('heading', { name: lawnPlant.name })).toBeDefined();
		expect(screen.getByText('Lawn')).toBeDefined();
	});

	// The critique measured focus landing on the fourth of five focusables, the
	// "days as a table" summary, roughly 500px below the fold with no visual
	// cue that anything had happened. The heading is always the first thing a
	// reader of any kind meets in the sheet, so it is where focus belongs.
	it('puts focus on the heading when it opens', async () => {
		renderSheet(lawnPlant);
		await settled();

		expect(document.activeElement).toBe(screen.getByRole('heading', { name: lawnPlant.name }));
	});

	// Radix's Dialog primitive never sets this on its own in the version this
	// repo pins, though it already does everything else a modal dialog does:
	// traps focus, blocks the body, disables outside pointer events.
	it('marks the sheet as a modal dialog', async () => {
		renderSheet(lawnPlant);
		await settled();

		expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
	});

	// The critique measured this control last in DOM and tab order, after
	// three citation links, at a 16x16 hit target with no padding around it.
	it('puts the Close control first among the sheet\'s focusable elements, at a 24px hit target', async () => {
		renderSheet(lawnPlant);
		await settled();

		const dialog = screen.getByRole('dialog');
		const focusable = dialog.querySelectorAll('button, a[href], summary, [tabindex]:not([tabindex="-1"])');
		const close = screen.getByRole('button', { name: 'Close' });

		expect(focusable[0]).toBe(close);
		expect(close.className).toContain('size-6');
	});

	// The lawn is the one Plant carrying detail of its own, and every field of
	// it is something a person would otherwise have to remember.
	it('shows the lawn its grass, area, soil and irrigation schedule', async () => {
		renderSheet(lawnPlant);
		await settled();

		const conditions = section('Site conditions');
		const lawn = lawnDetailOf(lawnPlant);

		expect(conditions.textContent).toContain(lawn.grass);
		expect(conditions.textContent).toContain('4,100 sq ft');
		expect(conditions.textContent).toContain(lawn.soil);
		expect(conditions.textContent).toContain(lawn.irrigation.schedule);
	});

	// `irrigationSchema` keeps `source` to separate an owner's stated claim from
	// a measured one. A schedule rendered without it reads as fact.
	it('says the irrigation schedule is the owner\'s claim rather than a measurement', async () => {
		renderSheet(lawnPlant);
		await settled();

		expect(lawnDetailOf(lawnPlant).irrigation.source).toBe('asserted');
		expect(section('Site conditions').textContent).toContain('As the owner describes it, not measured.');
	});

	it('renders every tag the Plant carries', async () => {
		renderSheet(figPlant);
		await settled();

		const conditions = section('Site conditions');
		for (const tag of figPlant.tags) {
			expect(conditions.textContent).toContain(tag);
		}
	});

	it('shows the site and the notes on a Plant that carries them', async () => {
		renderSheet(notedPlant);
		await settled();

		const conditions = section('Site conditions');
		expect(conditions.textContent).toContain(notedPlant.site);
		expect(conditions.textContent).toContain(notedPlant.notes);
	});

	// A placeholder would claim the question was asked and came back empty. The
	// lawn has neither a site nor notes, so both labels have to be absent
	// outright rather than standing over a dash.
	it('leaves a null field out instead of standing a placeholder in for it', async () => {
		renderSheet(lawnPlant);
		await settled();

		expect(lawnPlant.site).toBeNull();
		expect(lawnPlant.notes).toBeNull();

		const conditions = section('Site conditions');
		expect(within(conditions).queryByText('Site')).toBeNull();
		expect(within(conditions).queryByText('Notes')).toBeNull();
		expect(conditions.textContent).not.toContain('—');
	});

	it('lists the Rules that reach this Plant and none that reach another', async () => {
		renderSheet(lawnPlant);
		await settled();

		const applicable = section('Rules that reach this plant');
		expect(applicable.textContent).toContain('Fall pre-emergent');
		expect(applicable.textContent).toContain('Spring pre-emergent');
		expect(applicable.textContent).not.toContain('Feed the Esperanza');
	});

	it('gives each Rule its source badge and the region it applies to', async () => {
		renderSheet(lawnPlant);
		await settled();

		const applicable = section('Rules that reach this plant');
		expect(within(applicable).getAllByText('Extension').length).toBeGreaterThan(0);
		expect(applicable.textContent).toContain(ruleFixtures[0]!.region.name);
	});

	// A Guard creates no work, so a reader who cannot tell one from a Rule that
	// does is reading the list wrong. Which of the two things it does matters
	// just as much: held work and an annotated go-ahead are different news.
	// `rain-expected` names no Plant and reaches the lawn only because its
	// ruleTags find `chemical` on the pre-emergents. It is the Guard actually
	// holding the herbicide, so the lawn's own page is where a reader has to
	// meet it—ADR 0002 keeps held work visible with its reason attached, and a
	// sheet that dropped the Guard would leave the reason nowhere.
	it('marks a deferring Guard as holding work back, on the plant it holds it on', async () => {
		renderSheet(lawnPlant);
		await settled();

		const applicable = section('Rules that reach this plant');
		expect(applicable.textContent).toContain('Rain expected');
		expect(applicable.textContent).toContain('Guard · holds work back');
	});

	// The Guard here is a copy under its own id and name rather than the seed's
	// own `water-in-after-application`. Both reach the lawn and both render the
	// annotate marker, so asserting the copy's name is what proves the sheet
	// listed the Guard it was handed instead of one the seed shipped with a
	// matching tag.
	it('marks an annotating Guard as adding a note', async () => {
		const annotating = guardFixture('annotate');
		const reaching: Rule = {
			...annotating,
			id: 'fixture-annotating-guard-reaches-lawn',
			name: 'Fixture: annotates the lawn',
			appliesTo: { ...annotating.appliesTo, ruleTags: ['chemical'] },
		};

		renderSheet(lawnPlant, { rules: [...ruleFixtures, reaching] });
		await settled();

		const applicable = section('Rules that reach this plant');
		expect(applicable.textContent).toContain(reaching.name);
		expect(applicable.textContent).toContain('Guard · adds a note');
	});

	// The other direction of the same rule. Neither seed Guard names fig-1 while
	// holding none of its work, so proving the case needs one built for it: a
	// Guard naming fig-1 outright, tagged for a Rule tag ('pesticide') that
	// neither of the fig's Rules carries. It has no work to hold, and listing it
	// anyway would be noise on the one screen meant to say what governs this
	// plant.
	it('leaves off a Guard that names the plant but has no work of its to hold', async () => {
		const annotating = guardFixture('annotate');
		const holdingNothing: Rule = {
			...annotating,
			id: 'fixture-fig-guard-holding-nothing',
			name: 'Fixture: holds nothing on the fig',
			appliesTo: { plantIds: ['fig-1'], plantTags: null, ruleTags: ['pesticide'] },
		};

		renderSheet(figPlant, { rules: [...ruleFixtures, holdingNothing] });
		await settled();

		expect(screen.queryByText(holdingNothing.name)).toBeNull();
	});

	// `targets()` drops a planned Plant until it is in the ground, so this is the
	// ordinary state of every planned row rather than an edge case.
	it('says so when no Rule reaches a planned Plant', async () => {
		renderSheet(plannedPlant);
		await settled();

		expect(plannedPlant.status).toBe('planned');
		expect(screen.getByText('No Rule reaches this plant.')).toBeDefined();
	});

	it('says so when no Rule reaches a planted Plant either', async () => {
		renderSheet(unplacedPlantedPlant);
		await settled();

		expect(unplacedPlantedPlant.status).toBe('planted');
		expect(unplacedPlantedPlant.position).toBeNull();
		expect(screen.getByText('No Rule reaches this plant.')).toBeDefined();
	});

	it('lists what has been recorded against this Plant, newest first', async () => {
		renderSheet(esperanzaPlant);
		await settled();

		const recorded = section('Recorded work');
		const dates = [...recorded.querySelectorAll('time')].map(element => element.getAttribute('datetime'));

		expect(dates).toEqual(
			occurrenceFixtures
				.map(occurrence => occurrence.completedAt)
				.sort((left, right) => right.localeCompare(left)),
		);
		expect(recorded.textContent).toContain('Feed the Esperanza');
	});

	it('shows only the Occurrences filed against this Plant', async () => {
		renderSheet(figPlant);
		await settled();

		// occurrenceFixtures never names fig-1, so the one row this section shows
		// has to be the seed's own recorded compost application rather than a leak
		// of the esperanza history the same store also carries.
		expect(occurrenceFixtures.every(occurrence => occurrence.plantId !== figPlant.id)).toBe(true);

		const recorded = section('Recorded work');
		expect(recorded.querySelectorAll('time')).toHaveLength(1);
		expect(recorded.textContent).toContain('Compost the fig');
		expect(recorded.textContent).not.toContain('Feed the Esperanza');
	});

	it('shows an empty state for a Plant nothing has been recorded against', async () => {
		renderSheet(esperanzaPlant, { store: createYardStore([]) });
		await settled();

		expect(screen.getByText('Nothing has been recorded against this plant yet.')).toBeDefined();
	});

	// The two have to read differently. An empty list is a fact about the yard, a
	// failed read is a fault in the browser, and they send a reader to different
	// places.
	it('distinguishes a history that failed to load from one that is empty', async () => {
		const broken: Store = {
			...createYardStore(),
			list: async () => {
				throw new Error('This browser refused to open its own storage.');
			},
		};

		renderSheet(esperanzaPlant, { store: broken });
		await settled();

		const recorded = section('Recorded work');
		expect(recorded.textContent).toContain('could not be read');
		expect(recorded.textContent).toContain('This browser refused to open its own storage.');
		expect(within(recorded).queryByText('Nothing has been recorded against this plant yet.')).toBeNull();
	});

	it('draws the series when a Threshold Rule reaches the Plant', async () => {
		renderSheet(lawnPlant);
		await settled();

		expect(screen.getByRole('img', { name: /threshold/i })).toBeDefined();
	});

	// No Threshold Rule means no chart, not an empty one: the threshold line is
	// the only line on it that says anything, and there is none to draw.
	it('draws nothing at all when no Threshold Rule reaches the Plant', async () => {
		renderSheet(figPlant);
		await settled();

		expect(screen.queryByRole('img')).toBeNull();
	});

	// The Planner writes one Task per (Rule, Plant) pair, so a Citation matched
	// on `ruleId` alone would mark the lawn's crossing day on any Plant the same
	// Rule reaches.
	it('marks the day the Task for this Plant cites', async () => {
		renderSheet(lawnPlant);
		await settled();

		// The label reads "Projected" and then the day, in one text node.
		expect(screen.getByText(/^Projected /)).toBeDefined();
	});

	it('marks no day when the citing Task names another Plant', async () => {
		const elsewhere: Artifact = {
			...yardArtifact,
			plan: {
				...yardArtifact.plan,
				tasks: yardArtifact.plan.tasks.map(task => ({ ...task, plantId: figPlant.id })),
			},
		};

		renderSheet(lawnPlant, { artifact: elsewhere });
		await settled();

		expect(screen.getByRole('img', { name: /threshold/i })).toBeDefined();
		expect(screen.queryByText(/^Projected /)).toBeNull();
	});
});
