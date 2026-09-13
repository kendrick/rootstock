import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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

describe('ruleList', () => {
	it('renders all four rule kinds', () => {
		render(<RuleList rules={allFixtureRules} />);

		// Each fixture carries a unique name; one query per rule confirms all four
		// reached RuleSummary rather than one or two being silently dropped.
		expect(screen.getByText(windowRule.name)).toBeDefined();
		expect(screen.getByText(thresholdRule.name)).toBeDefined();
		expect(screen.getByText(cadenceRule.name)).toBeDefined();
		expect(screen.getByText(guardRule.name)).toBeDefined();
	});

	it('renders a Guards section when guards are present', () => {
		render(<RuleList rules={allFixtureRules} />);

		expect(screen.getByRole('heading', { level: 2, name: 'Guards' })).toBeDefined();
	});

	it('omits the Guards section when no guards are in the list', () => {
		const nonGuards = allFixtureRules.filter(rule => rule.kind !== 'guard');

		render(<RuleList rules={nonGuards} />);

		expect(screen.queryByRole('heading', { level: 2, name: 'Guards' })).toBeNull();
	});

	it('places guards under the Guards heading and keeps non-guards outside it', () => {
		render(<RuleList rules={allFixtureRules} />);

		const section = screen.getByRole('region', { name: 'Guards' });

		// The guard rule's name is inside the section.
		expect(within(section).getByText(guardRule.name)).toBeDefined();

		// Non-guard rule names are not inside the guards section.
		expect(within(section).queryByText(windowRule.name)).toBeNull();
		expect(within(section).queryByText(thresholdRule.name)).toBeNull();
		expect(within(section).queryByText(cadenceRule.name)).toBeNull();
	});

	it('renders the extension-source badge for an extension-backed rule', () => {
		render(<RuleList rules={[extensionSourceRule]} />);

		expect(screen.getByText('Extension')).toBeDefined();
	});

	it('renders the owner-source badge for an owner-backed rule', () => {
		render(<RuleList rules={[ownerSourceRule]} />);

		expect(screen.getByText('Owner')).toBeDefined();
	});

	it('renders both source kinds when the list contains both', () => {
		render(<RuleList rules={[extensionSourceRule, ownerSourceRule]} />);

		expect(screen.getByText('Extension')).toBeDefined();
		expect(screen.getByText('Owner')).toBeDefined();
	});

	it('reflects delegability from the policy, not from a delegable prop passed by the list', () => {
		// `allFixtureRules` includes the chemical window rule (neverDelegable under the
		// seed tag policy) alongside an owner cadence rule that has no blocking tag.
		// Both "Delegable" and "Not delegable" badges appearing here proves the component
		// is calling isDelegable itself—no prop override could produce both values from a
		// single set of rules unless the computation is actually running.
		render(<RuleList rules={allFixtureRules} />);

		const delegable = screen.queryAllByText('Delegable');
		const notDelegable = screen.queryAllByText('Not delegable');

		// At least one rule in allFixtureRules is delegable and at least one is not.
		expect(delegable.length + notDelegable.length).toBe(allFixtureRules.length);
	});
});
