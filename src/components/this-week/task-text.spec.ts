import { describe, expect, it } from 'vitest';
import { taskText } from './task-text';

describe('taskText', () => {
	it('prefers the line Narration wrote', () => {
		expect(taskText('Fall pre-emergent (Front lawn)', 'Apply fall pre-emergent to the front lawn.'))
			.toBe('Apply fall pre-emergent to the front lawn.');
	});

	// ADR 0001 treats a run without Narration as a whole output, so the title is
	// the deliverable here rather than a stand-in for one.
	it('falls back to the Planner title for a Task the model left out', () => {
		expect(taskText('Fall pre-emergent (Front lawn)', null))
			.toBe('Fall pre-emergent (Front lawn)');
		expect(taskText('Fall pre-emergent (Front lawn)', undefined))
			.toBe('Fall pre-emergent (Front lawn)');
	});

	it('treats a blank narration as none at all', () => {
		expect(taskText('Feed the Esperanza', '   ')).toBe('Feed the Esperanza');
		expect(taskText('Feed the Esperanza', '')).toBe('Feed the Esperanza');
	});

	// The reason this is a function and not two expressions. `TaskItem` reaches
	// it through a prop and `ThisWeek` through a Map, and the two answers have
	// to match or the live region announces a sentence that is not on screen.
	it('gives the screen and the announcement the same answer from either caller', () => {
		const narrationById = new Map([['fall-pre-emergent@front-lawn', 'Apply fall pre-emergent.']]);
		const fromMap = taskText('Fall pre-emergent (Front lawn)', narrationById.get('fall-pre-emergent@front-lawn'));
		const fromProp = taskText('Fall pre-emergent (Front lawn)', 'Apply fall pre-emergent.');

		expect(fromMap).toBe(fromProp);
	});
});
