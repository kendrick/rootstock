# Adding a Plant

The inventory lives in `src/seed/plants.json`, and that file is the import format ([CONTEXT.md](../../CONTEXT.md), Seed data). You can edit it by hand, but `pnpm plant add` asks for each field and mints the id. It shows which Rules will reach the Plant before anything is written, then appends the record without reflowing the rest of the file.

Every record is a claim about the real yard. Add only Plants that exist or that you've decided to plant.

## Add One

```sh
pnpm plant add
```

It asks for these, in order:

- The name, as you'd say it. The id comes from it: "Turk's cap" becomes `turks-cap`, and a name already taken gets `-2`.
- The species, as a botanical name such as `Tecoma stans`, with any cultivar left in the name. Guidance is researched by species, so this is what a new Rule for the Plant gets sourced against. Leave it blank for a mixed bed or when you aren't sure.
- The kind: plant, container, bed, or lawn. A lawn also asks for grass, area, soil, and irrigation schedule.
- Whether it's planted. A Plant you haven't put in the ground is `planned`, and no Rule plans work for it until it's `planted`.
- Tags, comma separated. The prompt lists every tag in use and names the Rules that select on each one. Reuse a tag you see there rather than a near-miss spelling, since Rules match tags exactly.
- A site, picked by number from the sites already written, or typed new. The Yard's list groups Plants by site, so reusing "Back patio" keeps the patio together where "back patio, shade" would start a group of its own.
- Notes, if any.

Before it writes, it prints the id and which Rules will reach the Plant. A Plant no Rule reaches gets nothing planned for it. That's right for a native that needs no scheduled care. For anything you expect to feed or treat, check the tags first. If no Rule covers that species yet, the fix is a new Rule researched from a land-grant source for its species, not a tag borrowed from a different plant.

Answer `y` to write it. It then offers to place the Pin.

## Place Its Pin

```sh
pnpm site-plants --only <id>
```

This opens the yard photo in a browser. Click where the Plant sits, then press Enter in the terminal. Without `--only`, it walks every Plant in turn.

A Pin is a fraction of the photo, never a coordinate ([ADR 0004](../adr/0004-coordinates-never-enter-the-repository.md)). A planted Plant with no Pin needs a note saying why, such as "behind the house, off the photo".

## Check the Inventory

```sh
pnpm plant check
```

It lists every Plant with the Rules that reach it. It flags a planted Plant with no Pin and no note, and a Rule selecting a tag that no Plant carries. It exits nonzero when it flags anything. Run it after a batch, then `pnpm test`.

## Ids Never Change

History is kept under a Plant's id: the Occurrences in `src/seed/occurrences.json` and the ticks in every browser's Store. Renaming a Plant means changing its `name`, never its `id`.

## Working on a Copy

Both commands take `--plants <path>` to work on another file, which is how to try an entry without touching the seed.
