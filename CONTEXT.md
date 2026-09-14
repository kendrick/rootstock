# rootstock

A yard task planner for one property in North Texas. It answers a single question once a day: what does the yard need this week, and why. Every answer cites the rule that produced it and the reading that fired that rule.

## Language

**Planner**:
The pure function that turns an inventory, a rule set, observations and occurrences into a Plan for one date. It reads no clock and makes no network call: the date it plans for is an argument. It is the only thing in the system that may create a Task.
_Avoid_: Engine, generator, solver, brain, AI

**Plant**:
The inventory record for one plant, container, bed, or the lawn: a stable ID, what it is, whether it is planted or only planned, the tags Rules target it by, and optionally where it sits on the yard photo. The lawn is a Plant carrying lawn-specific detail rather than a record of its own kind, because Rules address it through the same ID mechanism as everything else.
_Avoid_: Item, asset, entry, zone

**Pin**:
A Plant's marker on the yard photo, placed by the fractions of the photo's width and height the Plant carries. A Plant with no stored position has no Pin and is reached through the list instead. Fractions rather than pixels are what let the photo be replaced at another size without moving every marker.
_Avoid_: Marker, dot, point, location, coordinate (a Pin carries no coordinate; see ADR 0004)

**Plant detail**:
What one Plant's sheet shows: its site conditions, the Rules that reach it, the Occurrences recorded against it, and the soil series where a Threshold Rule applies. It is a sheet rather than a route, so a Plant from an import renders the same as one from seed data.
_Avoid_: Plant page, detail view, profile, card

**Rule**:
A declaration, stored as data rather than code, of something the yard needs and the condition that calls for it. Every Rule carries the region it applies to, the source it came from, and whether the work it produces may be delegated. Four kinds: Window, Threshold, Cadence, Guard.
_Avoid_: Task, job, trigger, policy, setting

**Window Rule**:
A Rule that fires while a date falls inside a range. Fall pre-emergent in mid-September is one.
_Avoid_: Calendar rule, seasonal rule, date rule

**Threshold Rule**:
A Rule that fires when an observed series holds at or past a value for a required number of consecutive days. It reads observed days only, so a forecast can never fire one. A Rule may also name the direction it crosses from and the season it watches; one naming neither is judged on the run alone.
_Avoid_: Sensor rule, condition, trigger

**Crossing**:
The arrival of a series at a Threshold Rule's value from the far side of it. A Rule naming a direction counts a run only where the calendar day before it sat strictly on the far side, so a spell already under way when the window opened is not one. Nothing revokes a Crossing that qualified, though the Rule stops speaking once its season ends.
_Avoid_: Trigger, event, transition, breach, threshold met

**Cadence Rule**:
A Rule that fires when an interval has elapsed since the most recent Occurrence, or when there is no Occurrence to measure from.
_Avoid_: Recurring task, schedule, interval, repeat

**Guard**:
A Rule that creates no work. Guards run as a pass after the Rules that create Tasks, and may defer or annotate a Task. A Guard has no way to remove one.
_Avoid_: Filter, blocker, veto, constraint, exclusion

**Guard pass**:
The stage that runs every Guard over the Tasks the task-creating Rules authored, between authoring and ordering. It returns one Task for each Task it was handed and has no path to drop one. Several Guards may reach the same Task and each applies independently, so one Task can come back carrying two Deferrals, or a Deferral beside an Annotation.
_Avoid_: Filter stage, post-processing, guard phase, validation

**RuleVerdict**:
What one Rule concluded about one target: whether it fired, the evidence behind it, and any clause it adds to the Task's title. A Rule module returns a RuleVerdict rather than a Task. ADR 0001 gives the Planner sole authority to author a Task, and a module that returned a finished one would leave the Guard pass nothing to defer.
_Avoid_: Result, outcome, decision, evaluation

**GuardVerdict**:
What one Guard's condition concluded on the planned date: `met`, `unmet`, or `unavailable`. The third value exists because `unmet` is a claim about the evidence rather than a gap in it. `unmet` says the Planner looked and the yard is clear, which lets the work go ahead. `unavailable` says there was nothing to look at. Without that distinction, a Guard handed an empty series reads it as a clear sky.
_Avoid_: Result, outcome, check, boolean

**Task**:
One piece of work the Planner derived from exactly one Rule, carrying the Citation that produced it. A Task the model invented is not a Task, because the Planner is the only thing that makes them.
_Avoid_: Todo, item, action, chore, job

**Deferred Task**:
A Task a Guard held back. It stays in the Plan and stays on screen, carrying the Guard that deferred it and the condition that would release it. A Task that disappears is indistinguishable from one nobody thought of, so holding one back sets a status and keeps it in the Plan. The Away Card keeps a Deferred Task in its Plan but counts it as Withheld and does not name it, because the release condition is a reason to act and that reader has no standing to act on it.
_Avoid_: Skipped, suppressed, hidden, cancelled, blocked

**Deferral**:
One Guard's record that it held a Task's work back, carrying the Guard's ID and the condition that would release it, verbatim from the Guard. A Task holds a list of them, because several Guards may hold the same work for different reasons, and the Task is deferred exactly when that list is not empty. Only the Guard that placed a Deferral has anything to say about it: a second Guard that cannot reach its own evidence leaves every existing Deferral standing.
_Avoid_: Block, suppression, hold, veto

**Annotation**:
A note a Guard attached to a Task without holding the work back. It carries the Guard's ID and the text to show, and it leaves the Task's status and its Deferrals alone. A Guard whose condition came back `unavailable` annotates and defers nothing, which is how work that went ahead unchecked says so on its face.
_Avoid_: Warning, flag, comment, tip

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
_Avoid_: Completion (as a name for the record; whether one covers a Task is a Completed Task), checkbox, done flag, log entry

**Evidence start**:
The earliest date an Occurrence may carry and still count toward a Task's current cycle rather than the last one. It follows the Citation's kind: a Window Rule's start in the planned year, the first day a Threshold Rule was satisfied, the planned date for a Cadence Task, and nothing for an Approaching Task. It is derived on demand and never stored.
_Avoid_: Cutoff, since, deadline, threshold (Threshold is a Rule kind), anchor (an Anchor is what a Cadence Rule counts from)

**Completed Task**:
A Task the yard already holds an Occurrence for, dated on or after the Task's Evidence start. Completion is derived on every render from the Occurrence history and never written onto the Task, and an Approaching Task is never complete. A Completed Task stays in the Plan and renders checked, so a reader sees that the work was called for and was done.
_Avoid_: Done, ticked, checked off (the checkbox is the control, not the state), finished

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

**Generation run**:
The daily composition of a location, the seed data, a clock, and a Narrator into one Artifact or one recorded failure. It fetches Observations, runs the Planner, narrates, and validates. It writes no file and reads no clock of its own; the wrapper that schedules it does the writing.
_Avoid_: Pipeline, job, build, generator, orchestrator, CI run

**Narrator**:
The function the generation run hands a finished Plan to and gets a Narration back from. What sits behind it changes nothing about the run, and a Narrator that fails is a run without Narration rather than a failed run.
_Avoid_: Model, LLM, AI, writer, prose generator

**Artifact gate**:
The client boundary that parses the committed Artifact and status record before anything below it renders. On a failure it renders the error state and nothing else, so no Task reaches a reader without the Citation behind it having been checked.
_Avoid_: Guard (a Guard is a Rule that defers work), validator, boundary, wrapper

**Staleness**:
How old the Artifact is, computed in the browser on every render from the generation time it carries. Staleness is never baked into the Artifact, because a baked answer becomes a lie the moment the daily run stops.
_Avoid_: Freshness, cache age, last updated

**Staleness band**:
Which of three ranges the Artifact's age falls in, computed on every render: fresh under thirty-six hours, stale out to seven days, expired past that. The band is derived and never stored, for the same reason Staleness is not.
_Avoid_: Level, tier, state, status

**Shell**:
The header, nav, and footer every route renders inside. The Shell holds no Plan data of its own and renders the same on every route.
_Avoid_: Layout, chrome, frame, wrapper

**Away Card**:
The read-only, printable view of Delegable Tasks for the rest of the household. It always exists and renders the same way whether or not anyone is travelling, so finding it tells a stranger nothing. An Approaching Task reaches neither its list nor its count, because there is no work yet and counting it would tell the household about work that does not exist.
_Avoid_: Share link, guest view, public page, checklist

**Withheld**:
A Task the Away Card holds in its Plan and does not show, because it is not Delegable or because a Guard deferred it. The card reports how many it withholds and in which of those two senses, and names none of them. A household that works the card to the bottom and reads a finished list as a finished yard is how a pre-emergent window closes.
_Avoid_: Hidden, filtered, excluded, suppressed, blocked
