import type { Rule, TagPolicy } from '@/rules/rule';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { seedRules } from '@/seed';
import { RuleSummary } from './rule-summary';

/**
 * Reading the real seed set rather than a hand-rolled fixture, because the seed
 * data is the yard (CONTEXT.md's Seed data entry: "a fixture is test
 * scaffolding, this is the real yard"). Throwing on a missing ID means a Rule
 * renamed out of rules.json fails here by name instead of quietly rendering an
 * empty summary.
 */
function seedRule(id: string): Rule {
	const rule = seedRules.find(candidate => candidate.id === id);
	if (rule === undefined) {
		throw new Error(`rules.json no longer carries a rule with id '${id}'`);
	}
	return rule;
}

// A threshold Rule with none of the optional parts filled in: no published
// range, no depth, a single day. The seed set has no such Rule, and every
// nullable branch in the component is one somebody will eventually author.
const bareThreshold: Rule = {
	id: 'first-frost-watch',
	kind: 'threshold',
	name: 'First frost watch',
	region: { name: 'Southwest Fort Worth, Texas', hardinessZone: '8b' },
	variable: 'soil-temperature',
	depthCm: null,
	aggregate: 'min',
	comparison: 'lte',
	value: 36,
	unit: 'F',
	consecutiveDays: 1,
	direction: null,
	season: null,
	published: null,
	tags: ['container'],
	productLabel: null,
	source: { kind: 'owner', label: 'Owner\'s own practice', url: null },
	delegable: true,
	priority: 40,
	appliesTo: { plantIds: null, plantTags: null, ruleTags: null },
};

// The seed set's one Threshold Rule rises, so a falling one has to be built.
// ADR 0005's schema refine pairs 'falling' with 'lte', which bareThreshold
// already compares by, so this only has to name the direction.
const fallingThreshold: Rule = {
	...bareThreshold,
	id: 'late-season-cooldown',
	name: 'Late season cooldown',
	direction: 'falling',
};

const fixedInterval: Rule = {
	id: 'weekly-deep-water',
	kind: 'cadence',
	name: 'Deep water the beds',
	region: { name: 'Southwest Fort Worth, Texas', hardinessZone: '8b' },
	everyDays: { min: 7, max: 7 },
	season: null,
	after: null,
	tags: ['irrigation'],
	productLabel: null,
	source: { kind: 'owner', label: 'Owner\'s own practice', url: null },
	delegable: true,
	priority: 50,
	appliesTo: { plantIds: null, plantTags: null, ruleTags: null },
};

describe('ruleSummary', () => {
	it('names the Rule and badges where it came from', () => {
		render(<RuleSummary rule={seedRule('fall-pre-emergent')} />);

		expect(screen.getByText('Fall pre-emergent')).toBeDefined();
		expect(screen.getByText('· Texas A&M AgriLife Extension')).toBeDefined();
	});

	it('renders the region with its hardiness zone', () => {
		render(<RuleSummary rule={seedRule('fall-pre-emergent')} />);

		expect(screen.getByText('Southwest Fort Worth, Texas · Zone 8b')).toBeDefined();
	});

	it('renders a window Rule\'s start and end as readable dates', () => {
		render(<RuleSummary rule={seedRule('fall-pre-emergent')} />);

		expect(screen.getByText('August 20 through September 30')).toBeDefined();
	});

	// The whole threshold row has to be legible at once: which series, at what
	// depth, reduced how, which way it crosses, against what value, in what unit,
	// for how long. Any one of those missing turns "55" into a number nobody can
	// act on.
	it('renders every part of a threshold Rule\'s condition', () => {
		render(<RuleSummary rule={seedRule('spring-pre-emergent')} />);

		expect(
			screen.getByText('Daily mean soil temperature at 6 cm, rising through 55°F for 3 consecutive days'),
		).toBeDefined();
	});

	// rule.ts's reason for `published`: picking 55 out of a printed 50-to-55 is a
	// local judgment, and the judgment only shows if both numbers are on screen.
	it('shows the published range beside the value the yard acts on', () => {
		render(<RuleSummary rule={seedRule('spring-pre-emergent')} />);

		expect(screen.getByText('50 to 55°F')).toBeDefined();
	});

	// Two badges, because the sheet that printed the range is its own document.
	it('gives the published range its own source badge', () => {
		render(<RuleSummary rule={seedRule('spring-pre-emergent')} />);

		expect(screen.getAllByText('Extension')).toHaveLength(2);
	});

	it('omits the published row when the Rule carries no published range', () => {
		render(<RuleSummary rule={bareThreshold} />);

		expect(screen.queryByText('Published range')).toBeNull();
		expect(screen.getByText('Daily minimum soil temperature, at or below 36°F for one day')).toBeDefined();
	});

	it('renders a cadence Rule\'s interval, season, and anchor', () => {
		render(<RuleSummary rule={seedRule('spring-pre-emergent-follow-up')} />);

		expect(screen.getByText('42 to 56 days')).toBeDefined();
		expect(screen.getByText('March 1 through June 30')).toBeDefined();
		// CONTEXT.md's Anchor: the follow-up measures from the Rule it follows.
		expect(screen.getByText('spring-pre-emergent')).toBeDefined();
	});

	it('omits the season and anchor rows when a cadence Rule has neither', () => {
		render(<RuleSummary rule={fixedInterval} />);

		expect(screen.getByText('7 days')).toBeDefined();
		expect(screen.queryByText('Season')).toBeNull();
		expect(screen.queryByText('Measured from')).toBeNull();
	});

	// ADR 0002: two effects and no third, and the difference between them is the
	// difference between held work and a note on work that is going ahead.
	it('marks a deferring Guard as creating no work', () => {
		render(<RuleSummary rule={seedRule('rain-expected')} />);

		expect(screen.getByText('Guard · creates no work')).toBeDefined();
		expect(screen.getByText('Defers the Task until its release condition is met')).toBeDefined();
	});

	it('marks an annotating Guard as creating no work, with the other effect', () => {
		render(<RuleSummary rule={seedRule('water-in-after-application')} />);

		expect(screen.getByText('Guard · creates no work')).toBeDefined();
		expect(screen.getByText('Annotates the Task, and holds no work back')).toBeDefined();
	});

	it('leaves the Guard marker off a Rule that does create work', () => {
		render(<RuleSummary rule={seedRule('last-nitrogen')} />);

		expect(screen.queryByText('Guard · creates no work')).toBeNull();
	});

	it('links the product label externally, and restates nothing from it', () => {
		render(<RuleSummary rule={seedRule('fall-pre-emergent')} />);

		const link = screen.getByRole('link', { name: /manufacturer/i });
		expect(link.getAttribute('href')).toBe('https://assets.greencastonline.com/pdf/labels/SCP%201139A-L10C%200121.pdf');
		expect(link.getAttribute('target')).toBe('_blank');
		expect(link.getAttribute('rel')).toBe('noopener noreferrer');
	});

	it('renders no product label row for a Rule without one', () => {
		render(<RuleSummary rule={seedRule('last-nitrogen')} />);

		expect(screen.queryByRole('link', { name: /manufacturer/i })).toBeNull();
	});

	it('falls back to isDelegable when no stamped answer is supplied', () => {
		render(<RuleSummary rule={seedRule('last-nitrogen')} />);

		expect(screen.getByText('Delegable')).toBeDefined();
	});

	it('falls back to isDelegable when the stamped answer is null', () => {
		render(<RuleSummary rule={seedRule('fall-pre-emergent')} delegable={null} />);

		expect(screen.getByText('Not delegable')).toBeDefined();
	});

	// The Planner stamped the Task, and its answer is already the narrowed one.
	// A view that recomputed here would be a second chance to disagree with it.
	it('prefers the stamped answer over its own fallback', () => {
		render(<RuleSummary rule={seedRule('last-nitrogen')} delegable={false} />);

		expect(screen.getByText('Not delegable')).toBeDefined();
		expect(screen.queryByText('Delegable')).toBeNull();
	});

	// Proves the tag policy actually reaches isDelegable rather than the component
	// carrying its own copy of which tags mean what.
	it('narrows delegability through the tag policy it is handed', () => {
		const policy: TagPolicy = { neverDelegableTags: ['fertilizer'], safetyTags: [] };
		render(<RuleSummary rule={seedRule('last-nitrogen')} tagPolicy={policy} />);

		expect(screen.getByText('Not delegable')).toBeDefined();
	});

	// Delegability used to be a word beside a distinct icon shape, so the
	// distinction survived a screen rendering no colour. The icons are gone with
	// the rest of the icon system, which leaves the word carrying it alone. The
	// requirement is the same one, WCAG 1.4.1: this must never be a colour, and
	// the two states have to read differently as plain text.
	it('distinguishes delegability in words, with no icon and no colour-only cue', () => {
		const { container: yes } = render(<RuleSummary rule={seedRule('last-nitrogen')} />);
		const { container: no } = render(<RuleSummary rule={seedRule('fall-pre-emergent')} />);

		const flagOf = (root: HTMLElement): string => {
			const match = [...root.querySelectorAll('span')]
				.map(span => span.textContent?.trim() ?? '')
				.find(text => text === 'Delegable' || text === 'Not delegable');

			return match ?? '';
		};

		expect(flagOf(yes)).toBe('Delegable');
		expect(flagOf(no)).toBe('Not delegable');
		expect(flagOf(yes)).not.toBe(flagOf(no));
	});

	// #14 reuses this component untouched, so every kind in rules.json has to
	// render standing alone—a Guard included, which never produces a Task.
	it('renders every Rule in the seed set, of every kind', () => {
		for (const rule of seedRules) {
			const { container, unmount } = render(<RuleSummary rule={rule} />);

			expect(screen.getByText(rule.name)).toBeDefined();
			expect(container.textContent).toContain('Zone 8b');

			unmount();
		}
	});

	// The route owns the page's only h1 and the sections above own the h2s. A
	// heading in here would land at whatever depth its composer happened to be
	// at, which axe flags on the This Week route (#16 widens that sweep).
	it('renders no heading element for any Rule kind', () => {
		for (const rule of seedRules) {
			const { container, unmount } = render(<RuleSummary rule={rule} />);

			expect(container.querySelector('h1, h2, h3, h4, h5, h6')).toBeNull();

			unmount();
		}
	});

	it('hides every decorative icon from screen readers', () => {
		const { container } = render(<RuleSummary rule={seedRule('fall-pre-emergent')} />);

		for (const svg of container.querySelectorAll('svg')) {
			expect(svg.getAttribute('aria-hidden')).toBe('true');
		}
	});

	// ADR 0005: a directed Rule is evidenced by a Crossing, so the undirected
	// "at or above" has to leave rather than sit beside the new wording. Two
	// sentences describing one Rule is the defect this replaced.
	it('drops "at or above" once a Rule names a rising Crossing', () => {
		render(<RuleSummary rule={seedRule('spring-pre-emergent')} />);

		expect(screen.queryByText(/at or above/)).toBeNull();
	});

	it('names a falling Crossing instead of "at or below"', () => {
		render(<RuleSummary rule={fallingThreshold} />);

		expect(
			screen.getByText('Daily minimum soil temperature, falling through 36°F for one day'),
		).toBeDefined();
		expect(screen.queryByText(/at or below/)).toBeNull();
	});

	// Same row, same formatMonthDay, same "through" as CadenceRows, because ADR
	// 0005 fences a threshold Rule to part of the year through the identical
	// seasonSchema. The term is asserted beside the dates: a `dd` that lost its
	// `dt` still matches the date string, and the term is the half a screen
	// reader announces first.
	it('renders a threshold Rule\'s season in the same form as a cadence Rule\'s', () => {
		render(<RuleSummary rule={seedRule('spring-pre-emergent')} />);

		expect(screen.getByText('Season')).toBeDefined();
		expect(screen.getByText('February 1 through April 30')).toBeDefined();
	});

	// The regression gate for ADR 0005: a Rule naming neither field renders the
	// sentence and the rows main renders today. Not `spring-pre-emergent`—the
	// seed set already gives that one both—so this reaches for the one
	// seed-shaped fixture that still names neither.
	it('renders the undirected sentence and no Season row when both fields are null', () => {
		render(<RuleSummary rule={bareThreshold} />);

		expect(
			screen.getByText('Daily minimum soil temperature, at or below 36°F for one day'),
		).toBeDefined();
		expect(screen.queryByText('Season')).toBeNull();
	});

	// #64: the Rules route hides the per-Rule Region row because every Rule in
	// this yard shares one, and renders it once for the page instead.
	it('omits the Region row when hideRegion is true', () => {
		render(<RuleSummary rule={seedRule('fall-pre-emergent')} hideRegion />);

		expect(screen.queryByText('Region')).toBeNull();
		expect(screen.queryByText(/Zone 8b/)).toBeNull();
	});

	it('keeps rendering the Region row when hideRegion is omitted', () => {
		render(<RuleSummary rule={seedRule('fall-pre-emergent')} />);

		expect(screen.getByText('Region')).toBeDefined();
	});

	// #64's cross-link criterion: whether this Rule's Task is in the committed
	// Artifact's Plan.
	it('marks a task-creating rule that produced a Task, when told it did', () => {
		render(<RuleSummary rule={seedRule('last-nitrogen')} inCurrentPlan />);

		expect(screen.getByText('Produced a Task this week')).toBeDefined();
	});

	// A Guard never produces a Task of its own (CONTEXT.md's Guard entry), so
	// its mark reads differently from a Rule that created work.
	it('marks a guard that acted on a Task, with wording distinct from a producing rule', () => {
		render(<RuleSummary rule={seedRule('rain-expected')} inCurrentPlan />);

		expect(screen.getByText('Acted on a Task this week')).toBeDefined();
		expect(screen.queryByText('Produced a Task this week')).toBeNull();
	});

	it('renders no plan mark by default', () => {
		render(<RuleSummary rule={seedRule('last-nitrogen')} />);

		expect(screen.queryByText('Produced a Task this week')).toBeNull();
		expect(screen.queryByText('Acted on a Task this week')).toBeNull();
	});

	// #64: the Rules route needs a heading landmark per Rule. asHeading swaps
	// the name's own element rather than adding a second one beside it, so the
	// visible name and the heading are the same node.
	it('renders the rule name as an h3 when asHeading is true', () => {
		render(<RuleSummary rule={seedRule('fall-pre-emergent')} asHeading />);

		const heading = screen.getByRole('heading', { level: 3, name: 'Fall pre-emergent' });
		expect(heading.tagName).toBe('H3');
	});

	it('keeps the rule name out of the heading tree by default', () => {
		render(<RuleSummary rule={seedRule('fall-pre-emergent')} />);

		expect(screen.queryByRole('heading')).toBeNull();
		expect(screen.getByText('Fall pre-emergent').tagName).toBe('SPAN');
	});
});
