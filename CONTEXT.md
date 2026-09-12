# rootstock

A yard task planner for one property in North Texas. It answers a single question once a day: what does the yard need this week, and why. Every answer cites the rule that produced it and the reading that fired that rule.

## Language

**Planner**:
The pure function that turns an inventory, a rule set, observations and occurrences into a Plan for one date. It reads no clock and makes no network call: the date it plans for is an argument. It is the only thing in the system that may create a Task.
_Avoid_: Engine, generator, solver, brain, AI

**Rule**:
A declaration, stored as data rather than code, of something the yard needs and the condition that calls for it. Every Rule carries the region it applies to, the source it came from, and whether the work it produces may be delegated. Four kinds: Window, Threshold, Cadence, Guard.
_Avoid_: Task, job, trigger, policy, setting

**Window Rule**:
A Rule that fires while a date falls inside a range. Fall pre-emergent in mid-September is one.
_Avoid_: Calendar rule, seasonal rule, date rule

**Threshold Rule**:
A Rule that fires when an observed series holds at or past a value for a required number of consecutive days. It reads observed days only, so a forecast can never fire one.
_Avoid_: Sensor rule, condition, trigger

**Cadence Rule**:
A Rule that fires when an interval has elapsed since the most recent Occurrence, or when there is no Occurrence to measure from.
_Avoid_: Recurring task, schedule, interval, repeat

**Guard**:
A Rule that creates no work. Guards run as a pass after the Rules that create Tasks, and may defer or annotate a Task. A Guard has no way to remove one.
_Avoid_: Filter, blocker, veto, constraint, exclusion

**Task**:
One piece of work the Planner derived from exactly one Rule, carrying the Citation that produced it. A Task the model invented is not a Task, because the Planner is the only thing that makes them.
_Avoid_: Todo, item, action, chore, job

**Deferred Task**:
A Task a Guard held back. It stays in the Plan and stays on screen, carrying the Guard that deferred it and the condition that would release it. A Task that disappears is indistinguishable from one nobody thought of, so holding one back sets a status and keeps it in the Plan.
_Avoid_: Skipped, suppressed, hidden, cancelled, blocked

**Advisory**:
Something the model observed that no Rule produced. An Advisory carries no Citation, renders apart from Tasks, and never reaches the Away Card.
_Avoid_: Suggestion, tip, insight, recommendation, note

**Observation**:
One reading at one moment, carrying its depth, its source, and the time it was taken. A modeled value and a probe reading are both Observations; the source field is what separates them, and it is never dropped.
_Avoid_: Measurement (a modeled value is not one), data point, sample, reading

**Occurrence**:
An append-only record that work happened on a date. Cadence Rules read the most recent matching one. Marking a Task done writes a new Occurrence rather than changing an old one, so the yard accumulates a history nobody had to design.
_Avoid_: Completion, checkbox, done flag, log entry

**Citation**:
The pairing of the Rule that fired with the date or Observation that fired it. A Citation is checked by membership against the real Rule set, so a Citation naming a Rule nobody wrote fails validation.
_Avoid_: Reason, explanation, justification, source (Source is a field on a Rule)

**Delegable**:
Whether a Task may appear on the Away Card. Delegability is decided on the Rule at authoring time and narrowed by tag policy, never widened by it: a Rule tagged chemical stays undelegable however its own field is set.
_Avoid_: Safe, shareable, assignable, public

**Plan**:
What the Planner returns for one date: the Tasks, the Deferred Tasks, the Advisories, and the window of Observations the Rules actually read.
_Avoid_: Schedule, list, result, output

**Narration**:
The model's pass over a finished Plan. It may select, order, and write prose. It may not add, remove, or re-date anything. Narration is optional by construction, and the Artifact records whether it ran.
_Avoid_: Generation, AI output, summary, write-up

**Artifact**:
The committed JSON one generation run produces and the site reads: a Plan, the Observation window behind it, the time it was generated, and whether Narration ran. It never carries coordinates.
_Avoid_: Payload, snapshot, feed, build output, data file

**Staleness**:
How old the Artifact is, computed in the browser on every render from the generation time it carries. Staleness is never baked into the Artifact, because a baked answer becomes a lie the moment the daily run stops.
_Avoid_: Freshness, cache age, last updated

**Away Card**:
The read-only, printable view of Delegable Tasks for the rest of the household. It always exists and renders the same way whether or not anyone is travelling, so finding it tells a stranger nothing.
_Avoid_: Share link, guest view, public page, checklist
