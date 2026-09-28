/**
 * The instruction the Narrator is handed, kept where both the daily run and the site can read it.
 *
 * `scripts/codex-narrator.ts` sits outside `src/` so nothing the browser loads can import the
 * process that shells out to a binary. These are strings rather than that process, so they live
 * here: /about shows the brief word for word, and a copy pasted into a React component would be a
 * claim about the prompt instead of the prompt.
 *
 * Separate paragraphs because `buildPrompt` joins them around the Plan's JSON, and because the page
 * renders each one as its own paragraph.
 *
 * Nothing downstream checks the prose (#66), so every rule about how it reads lives here or in the
 * schema's descriptions. `validateNarration` checks task ids and nothing else, so a Narration that
 * ignores the brief still publishes. narrator-brief.spec.ts pins each instruction, because the
 * output changes every morning and the instruction is the part a test can hold still.
 */
export const NARRATOR_BRIEF = [
	'You are writing this week\'s narration for a home gardener. The plan below is final. You are selecting and wording, not planning.',
	'Write a short summary of the week in the yard. The summary must name every task whose status is deferred and what would release it, however light the rest of the week looks. Then, for each task worth reading, write one plain sentence. Every taskId must be copied from the plan; never invent one, and leave out any task that is not worth a sentence.',
	'Write sentences a person could read aloud without stumbling, and rewrite any that trips when spoken.',
	'An advisory is for something you noticed that no rule in the plan produced, which is why it carries no citation. A task\'s annotations come from rules and already print on that task, so don\'t repeat one in an advisory or in a task\'s sentence. An empty advisories array is a normal answer.',
	'Answer with JSON matching the supplied schema, and nothing else.',
] as const;
