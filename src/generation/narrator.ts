import type { Narration } from '@/artifact/narration';
import type { Plan } from '@/planner/plan';

/**
 * The seam between the generation run and whatever writes the prose. A Narrator takes a finished
 * Plan and answers with a Narration, and that is the whole of it—the run stage behind this type
 * never learns whether a model or a fake produced the answer.
 *
 * It returns a promise because the real implementation shells out to a model, and it takes the Plan
 * whole rather than some prompt-shaped projection of it because ADR 0001 makes the Plan the only
 * thing a Narration is allowed to be about. Narrowing the argument here would be the first step
 * toward a narrator that knows something the Plan does not.
 */
export type Narrator = (plan: Plan) => Promise<Narration>;

/**
 * Holds a Narration to the Plan it was written about, which is the check ADR 0001 trades the whole
 * prompt-shaped design for. The Planner is the only thing that may author a Task, so a Narration
 * citing a task id the Plan never contained is a fabrication, and the run drops back to the
 * Planner's own mechanical prose rather than publishing it.
 *
 * Omission is not a fabrication. The model is given leave to select, so a Narration naming two of
 * the Plan's three Tasks—or none of them—passes here; the Tasks it left out are still in the
 * Plan and still render, they just render with the title the Planner wrote. Requiring full coverage
 * would quietly revoke the one editorial power the ADR grants.
 *
 * There is no date to check and no advisory to check. Narration carries no date field at all (see
 * `@/artifact/narration`), so a re-dated Task is impossible by construction rather than rejected
 * here, and an Advisory by definition cites nothing, so there is nothing about one to hold against
 * the Plan.
 *
 * This throws rather than returning a result, because the caller is already wrapped in a catch for
 * a Narrator that rejects—one failure path covers a bad answer and a failed call alike—and
 * because a thrown sentence is what `@/validation/parse` established as the house shape for a
 * validation failure nobody is watching happen.
 */
export function validateNarration(narration: Narration, plan: Plan): void {
	const authored = new Set(plan.tasks.map(task => task.id));

	narration.tasks.forEach((task, index) => {
		if (!authored.has(task.taskId)) {
			throw new Error(
				`narration: tasks[${index}].taskId names a task the plan for ${plan.asOf} does not contain, but received ${JSON.stringify(task.taskId)}.`,
			);
		}
	});
}

/**
 * A Narrator that answers with whatever it was handed. Production code, not test scaffolding: the
 * generation run uses it to exercise the full pipeline with the model switched off, which is the
 * property ADR 0001 asks anyone to be able to check by diffing the output.
 *
 * One argument covers both outcomes because a Narrator has exactly two: it resolves with a
 * Narration or it rejects. Passing an `Error` configures the rejection, and it rejects with that
 * same instance rather than a copy, so a caller can assert on identity and a subclass carrying
 * extra fields survives the trip.
 */
export function fakeNarrator(result: Narration | Error): Narrator {
	return async () => {
		if (result instanceof Error) {
			throw result;
		}
		return result;
	};
}
