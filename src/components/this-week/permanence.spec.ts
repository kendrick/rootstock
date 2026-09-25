import { describe, expect, it } from 'vitest';
import { CANCELLED, pendingAnnouncement, permanenceNote, RECORD_DELAY_MS, recordedAnnouncement, UNDO_REFUSAL } from './permanence';

describe('the permanence copy', () => {
	// #62's criterion is that marking a task done says the record is permanent
	// before or as it is written. Both halves have to say it, and a string that
	// loses the claim renders as well as one that keeps it.
	it('says the record cannot be taken back, in both the note and the refusal', () => {
		expect(permanenceNote('2026-09-25')).toMatch(/cannot be taken back/i);
		expect(UNDO_REFUSAL).toMatch(/cannot be removed/i);
	});

	// The Occurrence is dated to the Plan, so the note names the Plan's day.
	// "Today" is false on any plan older than this morning.
	it('names the day the record will carry, and where it is kept', () => {
		const note = permanenceNote('2026-09-25');

		expect(note).toContain('on September 25');
		expect(note).not.toMatch(/today/i);
		expect(note).toMatch(/in this browser only/i);
	});

	// CONTEXT.md's Occurrence entry names the synonyms this copy may not reach
	// for. A household reader is the audience, and 'log entry' and 'done flag'
	// describe a database rather than a yard.
	it('avoids the words CONTEXT.md rules out for an Occurrence', () => {
		for (const copy of [permanenceNote('2026-09-25'), UNDO_REFUSAL]) {
			expect(copy).not.toMatch(/checkbox|done flag|log entry/i);
		}
	});
});

describe('recordedAnnouncement', () => {
	it('carries the Task it recorded and the reason it stands', () => {
		const spoken = recordedAnnouncement('Feed the Esperanza in its container.');

		expect(spoken).toContain('Feed the Esperanza in its container.');
		// The same policy sentence the refusal ends on, so the two cannot drift.
		expect(spoken).toMatch(/cannot be removed/i);
	});

	/*
	 * The Planner's mechanical titles end in a bracket, not a full stop, and the
	 * model's lines end in one. A screen reader handed the two joined runs
	 * "Fall pre-emergent (Front lawn) This one stays recorded" together as a
	 * single clause, so the sentence is closed here rather than in the caller.
	 */
	it('closes a title that was never written as a sentence', () => {
		expect(recordedAnnouncement('Fall pre-emergent (Front lawn)'))
			.toContain('Fall pre-emergent (Front lawn). ');
	});

	// The word 'Recorded' opens the sentence, so the tail may not open with it
	// too. 'Recorded: ... This one stays recorded' is why the policy sentence
	// lives in a constant both messages share rather than inside the refusal.
	it('does not repeat itself when it reuses the refusal\'s policy sentence', () => {
		expect(recordedAnnouncement('Feed the Esperanza.')).not.toContain('This one stays recorded');
	});

	it('adds no second full stop to a line that already ends in one', () => {
		expect(recordedAnnouncement('Feed the Esperanza.')).not.toContain('..');
	});

	it('closes a question the same way it closes a statement', () => {
		expect(recordedAnnouncement('Water the fig?')).toContain('Water the fig? ');
	});
});

describe('the sign-off wait', () => {
	// The sentence states the window's length, so it is read off the same
	// constant the timer runs on rather than typed in.
	it('states the length of the window the timer actually gives', () => {
		expect(pendingAnnouncement('Feed the Esperanza.')).toContain(`${RECORD_DELAY_MS / 1000} seconds`);
	});

	it('says how to cancel, and that a cancel records nothing', () => {
		expect(pendingAnnouncement('Feed the Esperanza.')).toMatch(/again to cancel/i);
		expect(CANCELLED).toMatch(/nothing was recorded/i);
	});
});
