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
