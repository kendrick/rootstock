# The planner authors every task, and the model only chooses the words

A deterministic function decides what the yard needs. The model receives a finished Plan and may select from it, order it, and write its prose. It may not add a Task, remove one, or change a date. Validation rejects any narration referencing a rule ID that was not in the Plan it was handed.

This is the decision the rest of the project hangs off, and it is the one that is invisible in a screenshot.

## The alternative, and why it loses

The obvious build puts the inventory, the rules and the weather in a prompt and asks for a task list. It is a day of work and it demos identically.

It also makes the product's central claim unverifiable. Every Task is supposed to carry the rule and the reading that produced it. When the model is what produced it, the citation is whatever the model says the citation is, and checking it means re-deriving the answer by hand, which is the work the app was supposed to do. There is no test that distinguishes a correct citation from a plausible one.

Putting the derivation in a pure function turns that problem into a set membership check. The Planner emits Tasks that already carry a real rule ID, a real trigger and a real date, because it read them off real Rules and real Observations. Narration can only refer to what it was given. A fabricated rule ID fails validation and the run falls back to mechanical prose rather than publishing a lie.

Hallucinated dates stop being possible rather than becoming unlikely, because the model never writes a date at all.

## What this costs the writing

Narration cannot rescue a bad Plan. If the Planner produces something wrong, the model's job is to describe it well, and it will.

That pushes the quality problem where it belongs: into rule data and fixture tests, which are both things a person can read and argue with at 7am on a Saturday.

## The property that proves it

Turning the model off leaves the Task list unchanged. Only the prose changes, from written sentences to terse mechanical ones, and the Artifact records which it carries.

Anyone can check that claim by switching the model off and diffing the output, so it is worth keeping runnable. It also means the entire application can be developed and shown with no model calls at all, which removes the usage allowance from the critical path of every local run.

## Consequences

The mechanical prose is a real deliverable. It is what the Away Card falls back to, and the household reads that card without knowing which version they have, so it has to read like notes from someone in a hurry. Writing it well is somebody's actual job.

A new kind of reasoning is a code change. Adding a rule kind means writing a case in the Planner and tests for it, where the prompt-shaped version would have been a paragraph. That is slower, and it is the trade being made deliberately.

The system is less impressive to describe. "A rules engine with a writer on top" undersells what this does, and describing it as something more autonomous would misrepresent the one property that makes it trustworthy.
