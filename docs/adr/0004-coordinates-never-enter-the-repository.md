# Exact coordinates live in the generation environment and nowhere else

The daily run reads the property's latitude and longitude from its environment. No committed file carries them, and neither does the published Artifact. Seed data records a city and a hardiness zone, which is everything the Rules and the interface need.

## The constraint this is working inside

The repository is public, and that is not a preference. Reviewers read it: the README, the licence, the tests and these records are all part of what gets evaluated, and a private repository would mean granting access to each of them.

Making it private would not have bought much anyway. GitHub publishes Pages from a private repository only on a paid plan, and on every plan below an enterprise organization the resulting **site is public regardless**. GitHub's own documentation is direct about it: a Pages site is available on the internet even when its repository is not. Access-controlled Pages is an enterprise organization feature. A private repository buys private source and never a private site.

So the working assumption is that everything published is permanently public, and the effort goes into the one fact that actually matters.

## What is worth protecting

Very little of this is sensitive. A stranger learning that there is a fig in the northwest corner and a bermuda lawn on clay learns nothing worth having.

The exception is whether the house is empty. That is why the Away Card never states that anyone is travelling, never carries trip dates, and always renders the same way.

Coordinates are the second exception, and they are cheap to remove. The weather fetch needs them to a few decimal places. The interface needs them for nothing at all. A value used in exactly one place, by a process that already runs somewhere private, does not need to be committed to reach that place.

The drone photo is the same problem in a different format, so EXIF is stripped on the way in and the result is asserted rather than assumed.

## Why not a second, private repository

The shape that suggests itself is a private data repository feeding a public site repository. It was rejected for two reasons.

The build would publish the data anyway. A static export bakes whatever it reads into files served to anyone, so the split protects the source and not the output, which is the same trap as the private repository above.

It also is not free. A workflow's default token is scoped to its own repository and cannot read another, so a two-repository build needs a deploy key or a scoped token just to check out its own data. That is a real credential to rotate on a homelab box, bought to protect a plant list.

One environment variable achieves the entire benefit the split was going to deliver.

## Consequences

Nobody can run the generation without being handed the coordinates out of band, including the author on a new machine. The runner has to fail loudly and say which variable is missing, rather than defaulting to somewhere plausible and producing a confidently wrong Plan.

The seed data is not fully reproducible from the repository. Someone cloning it can run the Planner against fixture Observations, which is what the tests do, but cannot reproduce a real day's readings without supplying a location of their own. For a single-property prototype that is acceptable; for a tool other people run, the location becomes user data and this record is where that conversation starts.

There is now a value that exists only on one machine. If that box is lost, the coordinates are re-derivable from an address in about a minute, so this is an inconvenience rather than a risk. It is worth knowing it is on the list.
