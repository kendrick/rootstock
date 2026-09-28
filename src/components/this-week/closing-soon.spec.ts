import type { Task } from '@/planner/task';
import type { Rule } from '@/rules/rule';
import { describe, expect, it } from 'vitest';
import { firedTaskId, narratedArtifact } from '@/artifact/fixtures';
import { seedRules } from '@/seed';
import { closingSoon } from './closing-soon';

const rulesById = new Map<string, Rule>(seedRules.map(rule => [rule.id, rule]));
const fired = narratedArtifact.plan.tasks.find(task => task.id === firedTaskId);
if (fired === undefined) {
	throw new Error('narratedArtifact has no fall pre-emergent Task');
}

// Fall pre-emergent's window in the seed runs Aug 20 to Sep 30.
const preEmergent: Task = { ...fired, citation: { kind: 'window', date: '2026-09-28' } };

describe('closingSoon', () => {
	it('flags window work two days from its close', () => {
		expect(closingSoon([preEmergent], rulesById, '2026-09-28')).toEqual([{ task: preEmergent, closes: '2026-09-30', daysLeft: 2 }]);
	});

	it('flags it on the day the window closes', () => {
		expect(closingSoon([preEmergent], rulesById, '2026-09-30')).toEqual([{ task: preEmergent, closes: '2026-09-30', daysLeft: 0 }]);
	});

	it('leaves window work alone while the close is weeks off', () => {
		expect(closingSoon([preEmergent], rulesById, '2026-09-11')).toEqual([]);
	});

	it('counts held work, which is the collision this exists to show', () => {
		const held: Task = { ...preEmergent, status: 'deferred', deferrals: [{ guardId: 'rain-expected', releaseWhen: 'Once it is dry.' }] };

		expect(closingSoon([held], rulesById, '2026-09-28').map(entry => entry.daysLeft)).toEqual([2]);
	});

	it('closes a window that wraps the year in the new year', () => {
		const winter: Rule = { ...(rulesById.get('fall-pre-emergent') as Rule), id: 'winter-window', start: '11-15', end: '01-10' } as Rule;
		const task: Task = { ...preEmergent, id: 'winter-window@front-lawn', ruleId: 'winter-window' };

		expect(closingSoon([task], new Map([['winter-window', winter]]), '2026-12-30', 14)).toEqual([{ task, closes: '2027-01-10', daysLeft: 11 }]);
	});

	it('ignores work with no window to lose', () => {
		const cadence: Task = { ...preEmergent, id: 'esperanza-feeding@esperanza-1', ruleId: 'esperanza-feeding', citation: { kind: 'cadence', lastOccurrenceId: null, elapsedDays: null } };

		expect(closingSoon([cadence], rulesById, '2026-09-28')).toEqual([]);
	});
});
