# rootstock

A yard task planner for one property in North Texas. It answers a single question once a day: what does the yard need this week, and why. Every answer cites the rule that produced it and the reading that fired that rule.

## Language

**Planner**:
The pure function that turns an inventory, a rule set, observations and occurrences into a Plan for one date. It reads no clock and makes no network call: the date it plans for is an argument. It is the only thing in the system that may create a Task.
_Avoid_: Engine, generator, solver, brain, AI

**Plant**:
The inventory record for one plant, container, bed, or the lawn: a stable ID, what it is, whether it is planted or only planned, the tags Rules target it by, and optionally where it sits on the yard photo. The lawn is a Plant carrying lawn-specific detail rather than a record of its own kind, because Rules address it through the same ID mechanism as everything else.
_Avoid_: Item, asset, entry, zone

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

**RuleVerdict**:
What one Rule concluded about one target: whether it fired, the evidence behind it, and any clause it adds to the Task's title. A Rule module returns a RuleVerdict rather than a Task. ADR 0001 gives the Planner sole authority to author a Task, and a module that returned a finished one would leave the Guard pass nothing to defer.
_Avoid_: Result, outcome, decision, evaluation

**Task**:
One piece of work the Planner derived from exactly one Rule, carrying the Citation that produced it. A Task the model invented is not a Task, because the Planner is the only thing that makes them.
_Avoid_: Todo, item, action, chore, job

**Deferred Task**:
A Task a Guard held back. It stays in the Plan and stays on screen, carrying the Guard that deferred it and the condition that would release it. A Task that disappears is indistinguishable from one nobody thought of, so holding one back sets a status and keeps it in the Plan.
_Avoid_: Skipped, suppressed, hidden, cancelled, blocked

**Approaching Task**:
A Task whose Threshold Rule has not been satisfied yet and is forecast to be. It carries a projection Citation naming the day the threshold is expected to be met, and renders apart from fired work. The separation is the whole point: forecasts get revised, and a Task that has fired must never un-fire because the weather changed its mind.
_Avoid_: Upcoming, pending, predicted, imminent, soon

**Advisory**:
Something the model observed that no Rule produced. An Advisory carries no Citation, renders apart from Tasks, and never reaches the Away Card.
_Avoid_: Suggestion, tip, insight, recommendation, note

**Observation**:
One reading at one moment, carrying its depth, its source, and the time it was taken. A modeled value and a probe reading are both Observations; the source field is what separates them, and it is never dropped.
_Avoid_: Measurement (a modeled value is not one), data point, sample, reading (as a name for the type; prose may still describe one as a reading)

**Adapter**:
The module that turns one provider's response into Observations, and the only place that provider's names, units, and failure modes are known. An Adapter reads no clock and computes no daily figure. It takes the current instant as an argument and returns hourly Observations for the Planner to reduce.
_Avoid_: Client, service, provider, integration, fetcher

**DailyAggregate**:
One local calendar day of one variable at one depth, reduced from Observations by the Planner. It carries which reduction produced it—mean, min, max, or sum—and whether the day was observed or forecast. `Plan.window` is a run of these, and the soil-temperature sparkline is drawn off them.
_Avoid_: Reading, data point, daily value, sample

**Occurrence**:
An append-only record that work happened on a date. Cadence Rules read the most recent matching one. Marking a Task done writes a new Occurrence rather than changing an old one, so the yard accumulates a history nobody had to design.
_Avoid_: Completion, checkbox, done flag, log entry

**Anchor**:
The most recent Occurrence a Cadence Rule counts its interval from. A Rule with `after` set anchors on the Rule it follows rather than on itself. That is how a split application measures from its first half, instead of carrying a second calendar date that drifts every year. Where the Rule it follows has no Occurrence, the follow-up stays silent, because recommending a second application when the first never happened would be wrong.
_Avoid_: Last done, baseline, start, reference

**Seed data**:
The committed inventory, rule set, tag policy, and occurrence history the repository ships, parsed through the schemas at import. It is also the documented add-a-plant path for this release, so its JSON shape is the import format rather than an internal convenience.
_Avoid_: Fixture (a fixture is test scaffolding, this is the real yard), sample, example data, defaults

**Store**:
The asynchronous interface the rest of the system reads and writes the yard through, and the implementations behind it. A Store holds records and derives nothing. Only the Planner may create a Task, and a Store never does.
_Avoid_: Database, repository, cache, persistence layer, backend

**Envelope**:
What a Store wraps a domain record in to file it, carrying the ID it is stored under, when it was last written, and whether it came from the seed or the browser. An Envelope is the Store's bookkeeping and never part of the record's own schema.
_Avoid_: Wrapper, row, entry, document

**Dump**:
Every collection written out under a version stamp and the moment it was taken. Export writes a Dump and import reads one. A Dump is a whole Store and never a fragment, so import rejects an unknown version outright instead of applying the part it understands.
_Avoid_: Backup, export file, snapshot, payload

**Citation**:
The pairing of a Rule with the dated evidence behind its Task: the days a Threshold Rule was satisfied, the window a date fell inside, the Occurrence a Cadence Rule counted from. A Citation on an Approaching Task names a forecast day instead, and its own kind says so, so evidence that has happened is never confused with evidence that is expected. A Citation is checked by membership against the real Rule set, so one naming a Rule nobody wrote fails validation.
_Avoid_: Reason, explanation, justification, trigger, source (Source is a field on a Rule)

**Delegable**:
Whether a Task may appear on the Away Card. Delegability is decided on the Rule at authoring time and narrowed by tag policy, never widened by it: a Rule tagged chemical stays undelegable however its own field is set.
_Avoid_: Safe, shareable, assignable, public

**Specificity**:
How narrowly a Rule reaches: 3 when it names plant IDs, 2 when it selects by tag alone, 1 for the whole yard. A Plan sorts by it directly after safety, so a Rule naming the fig outranks one sweeping everything tagged `fruit`.
_Avoid_: Precedence, weight, rank, score

**Plan**:
What the Planner returns for one date: the Tasks, the Deferred Tasks, and the window of DailyAggregates the Rules evaluated. Only the Planner knows which days those were, so the window travels with the Plan rather than being reassembled downstream. An Advisory is not part of one, because the Planner cannot author an Advisory and a Plan holds only what the Planner authored.
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
