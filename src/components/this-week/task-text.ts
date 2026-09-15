/**
 * The sentence a Task shows: the model's line where Narration wrote one, and
 * the Planner's title where it did not.
 *
 * One function and two callers, which is the whole reason it exists. `TaskItem`
 * puts this on the screen and `ThisWeek` speaks it into the live region after a
 * write, and a reader hearing a different sentence from the one they ticked has
 * no way to tell which of the two the yard recorded.
 *
 * Contract 14 and ADR 0001: the Planner writes `title` for every Task whether
 * or not the model ever ran, so the second branch is mechanical prose the
 * project ships on purpose rather than a hole in the page.
 *
 * A narration of only whitespace counts as none. Rendering it would leave the
 * Task with no words on it at all.
 */
export function taskText(title: string, narrated: string | null | undefined): string {
	return narrated !== undefined && narrated !== null && narrated.trim() !== ''
		? narrated
		: title;
}

/**
 * What a mechanical Task title still has to say once the job name and the
 * target are already on screen.
 *
 * `titleFor` in the Planner builds a title as the Rule's name, the Plant's name
 * in brackets, and sometimes a clause the Rule added: "Feed the Esperanza
 * (Esperanza), never recorded". This row already renders the first two as its
 * heading and its target, so printing the whole title underneath says the same
 * words twice.
 *
 * That matters because Narration is optional by construction. With the model
 * off, every Task falls back to its mechanical title, and without this every
 * row on the page would read its own name twice. The README's promise is that
 * turning the model off changes the prose and nothing else, so the structure
 * has to survive the switch as well as the sentences do.
 *
 * Returns null when the title carries nothing the row has not already said, and
 * the clause alone when it does.
 */
export function mechanicalRemainder(title: string, ruleName: string, plantName: string | null): string | null {
	const subject = plantName === null ? ruleName : `${ruleName} (${plantName})`;

	if (!title.startsWith(subject)) {
		// A title the Planner built some other way is information this row cannot
		// account for, so it passes through whole rather than being trimmed by a
		// rule that no longer describes it.
		return title.trim() === '' ? null : title;
	}

	const remainder = title.slice(subject.length).replace(/^,\s*/, '').trim();

	return remainder === '' ? null : remainder;
}
