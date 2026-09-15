/**
 * The instruction the Narrator is handed, kept where both the daily run and the site can read it.
 *
 * `scripts/codex-narrator.ts` sits outside `src/` so nothing the browser loads can import the
 * process that shells out to a binary. These are strings rather than that process, so they live
 * here: /about shows the brief word for word, and a copy pasted into a React component would be a
 * claim about the prompt instead of the prompt.
 *
 * Separate paragraphs because `buildPrompt` joins them around the Plan's JSON, and because the page
 * renders them as the four instructions they are.
 */
export const NARRATOR_BRIEF = [
	'You are writing this week\'s narration for a home gardener. The plan below is final: you are selecting and wording, not planning.',
	'Write a short summary of the week in the yard. Then, for each task worth reading, write one plain sentence, ordered the way a person should read them. Every taskId must be copied from the plan; never invent one, and leave out any task that is not worth a sentence.',
	'Add an advisory only for something you noticed that no rule in the plan produced. An empty advisories array is a normal answer.',
	'Answer with JSON matching the supplied schema, and nothing else.',
] as const;
