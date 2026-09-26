import type { Plan } from '@/planner/plan';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { taskId } from '@/planner/task';
import {
	allFixtureRules,
	cadenceRule,
	extensionSourceRule,
	guardRule,
	ownerSourceRule,
	thresholdRule,
	windowRule,
} from './fixtures';
import { RuleList } from './rule-list';

/** A Plan with no Tasks, for specs that only care about the Rule list itself. */
const emptyPlan: Plan = { asOf: '2026-09-14', tasks: [], window: [] };

/**
 * A Plan that used two of `allFixtureRules`: `windowRule` produced a fired
 * Task directly, and a Task citing an unrelated Rule carries a Deferral
 * naming `guardRule`. That second shape is what proves a Guard is marked
 * through its Deferrals and Annotations rather than through `ruleId`, since a
 * Guard never owns a Task of its own (CONTEXT.md's Guard entry).
 */
const planWithTasks: Plan = {
	asOf: '2026-09-14',
	tasks: [
		{
			id: taskId(windowRule.id, null),
			ruleId: windowRule.id,
			plantId: null,
			status: 'fired',
			citation: { kind: 'window', date: '2026-09-14' },
			deferrals: [],
			annotations: [],
			delegable: false,
			tags: [],
			title: 'A task the window Rule produced',
		},
		{
			id: taskId('deep-water-fig', null),
			ruleId: 'deep-water-fig',
			plantId: null,
			status: 'deferred',
			citation: { kind: 'cadence', lastOccurrenceId: null, elapsedDays: null },
			deferrals: [{ guardId: guardRule.id, releaseWhen: 'Test release condition' }],
			annotations: [],
			delegable: true,
			tags: [],
			title: 'A task the Guard held back',
		},
	],
	window: [],
};

describe('ruleList', () => {
	it('renders all four rule kinds', () => {
		render(<RuleList rules={allFixtureRules} plan={emptyPlan} />);

		// Each fixture carries a unique name; one query per rule confirms all four
		// reached RuleSummary rather than one or two being silently dropped.
		for (const rule of [windowRule, thresholdRule, cadenceRule, guardRule]) {
			expect(screen.getByRole('heading', { level: 3, name: new RegExp(`^${rule.name},`, 'u') })).toBeDefined();
		}
	});

	it('renders a Guards section when guards are present', () => {
		render(<RuleList rules={allFixtureRules} plan={emptyPlan} />);

		expect(screen.getByRole('heading', { level: 2, name: 'Guards' })).toBeDefined();
	});

	it('omits the Guards section when no guards are in the list', () => {
		const nonGuards = allFixtureRules.filter(rule => rule.kind !== 'guard');

		render(<RuleList rules={nonGuards} plan={emptyPlan} />);

		expect(screen.queryByRole('heading', { level: 2, name: 'Guards' })).toBeNull();
	});

	it('places guards under the Guards heading and keeps non-guards outside it', () => {
		render(<RuleList rules={allFixtureRules} plan={emptyPlan} />);

		const section = screen.getByRole('region', { name: 'Guards' });

		// The guard rule's name is inside the section.
		expect(within(section).getByText(guardRule.name)).toBeDefined();

		// Non-guard rule names are not inside the guards section.
		expect(within(section).queryByText(windowRule.name)).toBeNull();
		expect(within(section).queryByText(thresholdRule.name)).toBeNull();
		expect(within(section).queryByText(cadenceRule.name)).toBeNull();
	});

	it('renders the extension-source badge for an extension-backed rule', () => {
		render(<RuleList rules={[extensionSourceRule]} plan={emptyPlan} />);

		expect(screen.getByText('Extension')).toBeDefined();
	});

	it('renders the owner-source badge for an owner-backed rule', () => {
		render(<RuleList rules={[ownerSourceRule]} plan={emptyPlan} />);

		expect(screen.getByText('Owner')).toBeDefined();
	});

	it('renders both source kinds when the list contains both', () => {
		render(<RuleList rules={[extensionSourceRule, ownerSourceRule]} plan={emptyPlan} />);

		expect(screen.getByText('Extension')).toBeDefined();
		expect(screen.getByText('Owner')).toBeDefined();
	});

	it('reflects delegability from the policy, not from a delegable prop passed by the list', () => {
		// `allFixtureRules` includes the chemical window rule (neverDelegable under the
		// seed tag policy) alongside an owner cadence rule that has no blocking tag.
		// Both "Delegable" and "Not delegable" badges appearing here proves the component
		// is calling isDelegable itself—no prop override could produce both values from a
		// single set of rules unless the computation is actually running.
		render(<RuleList rules={allFixtureRules} plan={emptyPlan} />);

		const delegable = screen.queryAllByText('Delegable');
		const notDelegable = screen.queryAllByText('Not delegable');

		// Both badges must appear: if either is missing, RuleList is overriding
		// the derivation rather than letting isDelegable run inside RuleSummary.
		expect(delegable.length).toBeGreaterThan(0);
		expect(notDelegable.length).toBeGreaterThan(0);
		// A Guard creates no Task, so it carries neither.
		expect(delegable.length + notDelegable.length).toBe(allFixtureRules.filter(rule => rule.kind !== 'guard').length);
	});

	// #64: the four kinds are the spine of CONTEXT.md, and a reader had no way to
	// tell one from another without inferring it from whichever rows a Rule
	// happened to render. The kinds no longer organise the page, because a reader
	// asks what is next rather than what taxonomy a Rule belongs to, so every row
	// names its own kind instead. The requirement survives; the sections do not.
	it('names every rule\'s kind in its heading', () => {
		render(<RuleList rules={allFixtureRules} plan={emptyPlan} />);

		for (const rule of allFixtureRules) {
			expect(screen.getByRole('heading', { level: 3, name: `${rule.name}, ${rule.kind} rule` })).toBeDefined();
		}
	});

	// A band with nothing in it is not drawn. An empty heading over an empty list
	// reads as a rendering failure rather than as a quiet week.
	it('omits a band entirely when no rule sits in it', () => {
		render(<RuleList rules={[windowRule]} plan={emptyPlan} />);

		expect(screen.queryByRole('region', { name: 'Guards' })).toBeNull();
		expect(screen.queryByRole('region', { name: 'Fired this week' })).toBeNull();
		expect(screen.getByRole('region', { name: 'Waiting' })).toBeDefined();
	});

	// The kind is printed in words among the row's marks, so no key is needed
	// to read it. A Guard's own mark already says it is one.
	it('prints each rule\'s kind in words, with no key to decode', () => {
		const { container } = render(<RuleList rules={allFixtureRules} plan={emptyPlan} />);

		expect(container.querySelector('dl[aria-hidden="true"]')).toBeNull();
		for (const rule of allFixtureRules.filter(candidate => candidate.kind !== 'guard')) {
			const row = screen.getByRole('heading', { level: 3, name: new RegExp(`^${rule.name},`, 'u') }).closest('li');
			expect(within(row as HTMLElement).getByText(`${rule.kind} rule`)).toBeDefined();
		}
	});

	// A reader tells one Rule from the next by a boundary rather than by the bold
	// name alone. This world has no cards, so the boundary is the ruled row it
	// sits in, and the requirement is the same one #64 asked for.
	it('separates each rule with a ruled row rather than the name alone', () => {
		const { container } = render(<RuleList rules={allFixtureRules} plan={emptyPlan} />);

		const rows = container.querySelectorAll('li.border-rule');
		expect(rows).toHaveLength(allFixtureRules.length);
	});

	// The band says whether a Rule fired, so neither a mark on the row nor its
	// status line says it a second time.
	it('states a fired Rule\'s standing once, through its band', () => {
		render(<RuleList rules={allFixtureRules} plan={planWithTasks} />);

		const fired = screen.getByRole('region', { name: 'Fired this week' });
		expect(within(fired).getByText(windowRule.name)).toBeDefined();
		expect(within(fired).queryByText(/Produced/u)).toBeNull();
		expect(within(fired).getByText('Window closes September 30')).toBeDefined();
	});

	// A screen reader otherwise runs the status into the marks before it.
	it('labels each row\'s status', () => {
		render(<RuleList rules={[windowRule]} plan={emptyPlan} />);

		expect(screen.getByText('Status:', { exact: false }).closest('p')?.textContent).toMatch(/^Status: /u);
	});

	// The release condition says what would free held work, so it shows only
	// while the Guard is holding some.
	it('gives a deferring Guard its release condition only while it holds work', () => {
		const { unmount } = render(<RuleList rules={[guardRule]} plan={emptyPlan} />);
		expect(screen.queryByText(/^Released once no day/u)).toBeNull();
		unmount();

		render(<RuleList rules={[guardRule]} plan={planWithTasks} />);
		expect(screen.getByText(/^Released once no day in the next two days/u)).toBeDefined();
	});

	// Delegable is a property of a Task (CONTEXT.md), and a Guard creates none.
	it('prints no delegability mark on a Guard', () => {
		render(<RuleList rules={[guardRule]} plan={emptyPlan} />);

		expect(screen.queryByText(/delegable/iu)).toBeNull();
	});

	it('links a follow-up to the row of the Rule it is measured from', () => {
		const { container } = render(<RuleList rules={allFixtureRules} plan={emptyPlan} />);

		const link = screen.getByRole('link', { name: thresholdRule.name });
		const target = container.querySelector(link.getAttribute('href') ?? '');
		expect(target?.querySelector('h3')?.textContent).toContain(thresholdRule.name);
	});
});
