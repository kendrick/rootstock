# A guard holds a task back and says why, instead of removing it

Guards are the Rules that stop work: never spray before rain, evening only, no fig fertilizer until spring. A Guard runs after the Rules that create Tasks and may set a Task's status to deferred or attach an annotation. It has no path to remove a Task from the Plan.

A Deferred Task keeps its rule ID and its trigger, gains the ID of the Guard that deferred it, and gains the condition that would release it.

## Why deletion is the wrong shape

A Guard that removes a Task produces silence, and silence has two causes that look identical from outside: the Guard fired, or nobody ever wrote a Rule for this.

Those need different responses. The first means wait for Friday's rain to pass. The second means the yard has a gap nobody noticed. A user staring at a short list cannot tell which they are looking at, and neither can the person debugging it six months later.

Showing the held work resolves it in one line. "Insecticide held, 80% chance of rain Friday, rule PEST-NO-RAIN" is more useful than the task firing would have been, because it carries both the work and the reason not to do it yet.

## Deferral is a status, not a filter

The distinction matters for where the logic lives. A filter applied while rendering fails open: add a chemical rule next spring, forget the string match in the view, and the task shows up somewhere it should not.

Deferral is computed by the Planner and stored on the Task, so the interface renders what it is given rather than deciding. The same reasoning governs delegability, which is a required field on the Rule rather than a heuristic in the Away Card: a required field fails closed, because a rule cannot be authored without answering the question.

## Consequences

The Plan is larger than the work it describes, and some of it is work nobody will do this week. The interface pays for that with a section that is often empty and occasionally long.

A Guard cannot be used to silence a Rule that is simply wrong. There is no mechanism for removing a Task, so a bad Rule gets fixed or deleted. That is more friction than a suppression list would be, and the friction is deliberate: a suppression list accumulates entries nobody revisits.

Every Guard now owes the interface a release condition in a form it can render. A Guard that can only say "not now" without saying "until what" is incomplete, which constrains how Guards can be written.
