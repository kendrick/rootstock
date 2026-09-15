# Running the Daily Job

`scripts/daily-run.sh` is the whole pipeline. It generates today's Artifact, commits the status record and the Artifact, and pushes. The push is what rebuilds the site, because GitHub Pages already watches `main`. There is no webhook to fire and no second generation running in CI.

It runs from a checkout on a box you control, on a schedule `pnpm schedule` installs. That box is the only place the coordinates exist ([ADR 0004](../adr/0004-coordinates-never-enter-the-repository.md)), and it is where the codex credentials live.

## What Runs Today

Nothing schedules this yet. Every step below the scheduler is proven: `scripts/daily-run.sh` ran end to end by hand on 2026-09-14, committed `4aaf111` and `5e8037c`, pushed over `GIT_SSH_COMMAND`, and `deploy.yml` fired from that push and went green. `data/status.json` has read `ok: true` with `consecutiveFailures: 0` ever since.

No machine runs it on a schedule yet, so the published Artifact is only as fresh as the last time somebody ran the script by hand. The site already accounts for that: Staleness is computed at render time against the Artifact's age, because the Artifact stops being true the moment the runs stop.

Run `pnpm schedule --status` on any machine to see whether that is still true there.

## Scheduling It

```sh
pnpm schedule            # write the config for this machine and load it
pnpm schedule --print    # render what it would write, and touch nothing
pnpm schedule --status   # report what is actually loaded here
pnpm schedule --uninstall
```

It picks the scheduler for the machine in front of it: a launchd agent on macOS, a systemd user timer where systemd is running, a crontab block otherwise. The first two run a job the machine slept through; cron does not, which is why it is the last resort rather than the default.

Default is 06:00 local, and `--at HH:MM` moves it. launchd and systemd timers both read the machine's own clock, so there is no UTC arithmetic to redo twice a year.

No plist or unit file is pasted here on purpose. Run `pnpm schedule --print` and you get the one for your machine, with the paths already resolved.

### The Env File

The coordinates cannot live in the plist. ADR 0004 keeps them out of the repository, and the same argument covers a scheduler config somebody will paste into an issue the first time a run misbehaves. So `daily-run.sh` reads them itself, from `~/.config/rootstock/env` at mode 0600, which `ROOTSTOCK_ENV_FILE` moves.

`pnpm schedule` writes that file with blank values when it finds none, and tells you which names are still empty when it finds one. It never fills them in, because it cannot know them.

The script reads the file only when `ROOTSTOCK_LATITUDE` is unset, so a hand-run with `.env.local` already sourced behaves exactly as it always did.

### What It Cannot Do

Four things have to be true on the machine before the first scheduled run, and none of them is the installer's to arrange:

- A deploy key as a **file**, registered on the repository with write access, with `ROOTSTOCK_DEPLOY_KEY` pointing at it. The owner's own git identity lives in the 1Password SSH agent, and an agent that wants an approval prompt cannot serve a run under `BatchMode=yes`. Those two cannot coexist, which is why the file is not optional.
- `codex login` completed under this machine's `CODEX_HOME`, confirmed by `codex login status`.
- `git config user.name` and `user.email`, or every run dies at the first commit.
- The three `ROOTSTOCK_` values in the env file.

### Two macOS Details

launchd runs a missed `StartCalendarInterval` when the machine wakes, but it does not wake the machine. `pmset repeat wake` is the separate thing to reach for if you want that.

`StandardOutPath` does not rotate. The log under `~/Library/Logs/rootstock/` grows until somebody truncates it.

## Two Machines

The job is safe to schedule on more than one box, and the second one will not pay for a Plan the first already published.

Before generating anything, a run fetches `origin` and fast-forwards. Then the generator compares the last successful run's stamp against today in the property's own time zone, and exits without writing a byte if they match. The log line says so:

```
daily-run: today's plan is already published, so nothing ran
```

Only a **successful** run closes the day. A failed one leaves it open on purpose, so the second machine is a free retry rather than a second box agreeing to publish nothing. `--force` generates anyway.

Stagger the two schedules, twenty minutes apart or so. A full run is one weather fetch and one `codex exec`, so twenty minutes closes the window where both boxes could look, both see an open day, and both start. If they do collide, the loser's push is rejected, it discards its own two commits, and exits 0; nothing is left wedged, and the cost is one wasted model call.

Four things stop a run before it spends anything, each with its own line on stderr:

- `on 'x' rather than main`: the checkout is on a feature branch. A run there would commit the day's Artifact to that branch and push it, which reports success and leaves main, and so the site, a day older. This matters most when the scheduled checkout is also the one somebody develops in.
- `could not reach origin`: the deploy key or the network. The box cannot tell whether another one already ran, so it refuses to guess.
- `the checkout has uncommitted changes`: either a previous run died before committing, or somebody edited the checkout. Both want a person.
- `has diverged from origin`: this box committed something the other does not have. Reconciling that unattended would invent a merge nobody reviewed.

## The Crontab (a Linux Box Without systemd)

This is what `pnpm schedule` writes when it finds neither launchd nor a running systemd, and it is the one target that skips a day the machine slept through. Prefer either of the others where you have them.

`pnpm schedule` manages the block between its two sentinel comments and leaves the rest of your crontab alone. To write it by hand instead, note that the assignments have to come before the schedule line, and that cron does not expand `$HOME` or anything else inside them, so use absolute paths:

```crontab
# BEGIN rootstock daily-run (managed by `pnpm schedule`; edits here are overwritten)
PATH=/home/rootstock/.local/share/pnpm:/usr/local/bin:/usr/bin:/bin

0 6 * * * /srv/rootstock/scripts/daily-run.sh >> /home/rootstock/.local/state/rootstock/daily-run.log 2>&1
# END rootstock daily-run
```

No coordinates here, and no `CODEX_HOME`: those live in the env file the script reads for itself, for the reason the section above gives.

The log goes outside the checkout. An earlier version of this file sent it to `/srv/rootstock/daily-run.log`, which puts an untracked file in the directory the script runs `git diff` against.

The script finds the checkout from its own path, so the schedule line needs no `cd`. Send both streams somewhere you can read them. Cron's mail is the only other record of a run, and on most boxes nothing is delivering it.

Cron reads the box's own clock for `0 6`, but it will not follow a daylight saving shift the way a systemd timer with `OnCalendar` does, and it still skips a day the machine slept through. Both are reasons to reach for `--scheduler systemd` where the box has it.

## What the Box Needs

`HOME` and `PATH` are re-exported rather than assumed. The narrator hands `codex exec` exactly `HOME`, `PATH` and `CODEX_HOME` and drops the rest of the environment, so a name missing here is missing again when codex goes looking for its config. `PATH` has to include the directory pnpm installed into; cron's two default entries will not find it.

`CODEX_HOME` is where codex keeps the credentials the Narration step spends. It defaults to `~/.codex`, which is where a plain `codex login` puts them.

These are the names the env file carries, and `pnpm schedule` will tell you which are still blank.

`ROOTSTOCK_LATITUDE`, `ROOTSTOCK_LONGITUDE` and `ROOTSTOCK_TIME_ZONE` are the property. They sit in `.env.example` without values, and ADR 0004 explains why they will never have any. The repository is public, and Pages publishes a public site whatever the repository is. A missing one fails the run loudly rather than guessing a plausible coordinate and publishing a confidently wrong Plan.

`ROOTSTOCK_DEPLOY_KEY` is optional and points at the SSH private key the push uses. It defaults to `~/.ssh/rootstock_deploy`.

Git also needs a committer on the box, `git config user.name` and `user.email`, or every run dies at the first commit.

## Why the Flags Are There

`set -euo pipefail`, at the top of the script. Nothing watches this process. A step that fails quietly and lets the next one run would publish a status record and an Artifact that disagree, which is worse than a red run nobody notices until morning.

`< /dev/null` on the generator. `codex exec` reads its prompt from stdin whenever it cannot find a positional argument, so a malformed call with an inherited stdin hangs forever instead of failing. The narrator hands its own child the null device for the same reason; the redirect here covers running the script by hand.

`--ff-only` on the merge after the fetch, never a plain merge and never a rebase. A diverged checkout means this box committed something the other one does not have, and reconciling that with nobody watching would either invent a merge commit no one reviewed or replay local commits onto a remote the script cannot test.

`pnpm exec tsx scripts/generate.ts` rather than `pnpm generate`. `pnpm run` prints an `ELIFECYCLE` banner on any non-zero exit, and a run that correctly skipped would leave that line in a log somebody reads for failures.

`--force`, on the script and forwarded to the generator. It bypasses the already-published check and the main-branch check, and nothing else: a forced run on a dirty or diverged checkout still stops where it would have.

`--ephemeral`, `--skip-git-repo-check` and `-s read-only` on `codex exec`, inside the narrator. It is a one-shot call that leaves nothing behind: keep it out of session history, let it run from any directory, and give it a sandbox that cannot write, because the call asks for prose.

`-o BatchMode=yes` on the push. A key that no longer works should fail the push rather than sit at a passphrase prompt in front of a terminal nobody is at.

`-o StrictHostKeyChecking=no`, same line. A first run on a new box would otherwise stop to ask about GitHub's fingerprint. The key is write-only to this one repository, so the exposure is small, and the alternative is remembering to seed `known_hosts` on every rebuild.

`-o IdentitiesOnly=yes`, same line again. Without it, ssh offers whatever an agent happens to be holding before it reaches the key you named, and GitHub authenticates as the first identity that works, which may not be the deploy key.

A deploy key, and not a token. A personal access token is scoped to an account, so one sitting on a homelab box is a key to every repository that account owns. A deploy key covers this repository alone, and revoking it breaks nothing else.

## When the Credential Expires

The codex token in `$CODEX_HOME` does not last forever. When it goes, the generation fails at the Narration step and the run turns red. The message lands in `error` in `data/status.json`, which the script commits and pushes, so the site says so too.

`codex login` finishes in a browser, against a listener on the box's port 1455. Forward that port on the way in:

```sh
ssh -L 1455:localhost:1455 rootstock@box
CODEX_HOME=/home/rootstock/.codex codex login
```

Open the URL it prints in your own browser, then check that the login took:

```sh
CODEX_HOME=/home/rootstock/.codex codex login status
```

Drop the `CODEX_HOME=` prefix if that shell already exports the same path. An interactive shell often does not, and a login under the wrong `CODEX_HOME` writes a token the scheduled run never reads. Where forwarding a port is not an option, `printenv OPENAI_API_KEY | codex login --with-api-key` gets there without a browser.

The next run is the confirmation. `ok` goes back to `true` in `data/status.json` and `consecutiveFailures` resets to zero.
