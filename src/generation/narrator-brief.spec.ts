import { describe, expect, it } from 'vitest';
import { NARRATOR_BRIEF } from './narrator-brief';

// #66: the prose regenerates every morning, so a check on today's output goes stale by tomorrow.
// These pin the instructions instead. Each one has to sit whole in a single sentence, because terms
// scattered across the brief can all survive the deletion of the sentence that tied them together.
const sentences = NARRATOR_BRIEF.flatMap(paragraph => paragraph.split(/(?<=\.)\s+/));

function sentenceWith(...terms: RegExp[]): string | undefined {
	return sentences.find(sentence => terms.every(term => term.test(sentence)));
}

describe('the narrator brief', () => {
	it('asks for prose a person can read aloud without stumbling', () => {
		// The sentence that shipped was "irrigate it in according to the product label", which
		// validates fine and doesn't parse when spoken.
		expect(sentenceWith(/read (it )?aloud/i, /without stumbling/i)).toBeDefined();
	});

	it('says an advisory is for what no rule produced, which is why it has no citation', () => {
		expect(sentenceWith(/advisory/i, /no rule/i, /citation/i)).toBeDefined();
	});

	it('forbids restating an annotation the reader already sees on the task', () => {
		// The shipped Advisory repeated the water-in Guard's Annotation two blocks below it, which
		// blurs the cited/uncited line the page draws with a dashed border.
		expect(sentenceWith(/annotation/i, /already/i, /don't repeat|never repeat/i, /advisory/i)).toBeDefined();
	});

	it('makes the summary name every deferred task', () => {
		// The summary called a week "a simple feeding week" while a Guard held the fall
		// pre-emergent two days before its window closed. A held Task is the one a reader most
		// needs told about, and the summary is read first.
		expect(sentenceWith(/summary/i, /every task/i, /deferred/i)).toBeDefined();
	});

	it('still lets the Narrator skip a task', () => {
		// ADR 0001 lets the model select. The deferred-task rule is about the summary, and must not
		// read as "every task needs a sentence".
		expect(sentenceWith(/leave out/i, /task/i)).toBeDefined();
	});

	it('does not ask the model to order anything', () => {
		// The Planner sets the order and the schema says so. A brief asking for one would contradict
		// the schema the model reads alongside it.
		expect(NARRATOR_BRIEF.join(' ')).not.toMatch(/\border/i);
	});
});
