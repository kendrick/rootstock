# Running the Daily Job

`scripts/daily-run.sh` is the whole pipeline. It generates today's Artifact, commits the status record and the Artifact, and pushes. The push is what rebuilds the site, because GitHub Pages already watches `main`. There is no webhook to fire and no second generation running in CI.

It is written to run on cron, from a checkout on a box you control. That box is the only place the coordinates exist ([ADR 0004](../adr/0004-coordinates-never-enter-the-repository.md)), and it is where the codex credentials live.

## What Runs Today

Nothing schedules this yet. Every step below the scheduler is proven: `scripts/daily-run.sh` ran end to end by hand on 2026-09-14, committed `4aaf111` and `5e8037c`, pushed over `GIT_SSH_COMMAND`, and `deploy.yml` fired from that push and went green. `data/status.json` has read `ok: true` with `consecutiveFailures: 0` ever since.

So read the crontab block below as the procedure for a box rather than as a description of one. No machine runs it on a schedule today, and the published Artifact is only as fresh as the last time somebody ran the script by hand. The site already accounts for that: Staleness is computed at render time against the Artifact's age, because the Artifact stops being true the moment the runs stop.

The scheduling work is #58, and one thing found while proving the push belongs to it. The owner's git identity is held by the 1Password SSH agent, and the push below hardcodes `-o BatchMode=yes`. An agent that wants to prompt for approval cannot serve an unattended run, so a scheduled box needs a real deploy-key file rather than the agent.

## The Crontab

Cron reads UTC. The property is in North Texas, so 11:00 UTC lands at 5am in winter and 6am in summer, early enough either way that the plan is waiting before anyone goes looking for it.

Install the whole block with `crontab -e`. The assignments have to come before the schedule line, and cron does not expand `$HOME` or anything else inside them, so write absolute paths:

```crontab
PATH=/home/rootstock/.local/share/pnpm:/usr/local/bin:/usr/bin:/bin
CODEX_HOME=/home/rootstock/.codex
ROOTSTOCK_LATITUDE=00.0000
ROOTSTOCK_LONGITUDE=-00.0000
ROOTSTOCK_TIME_ZONE=America/Chicago

0 11 * * * /srv/rootstock/scripts/daily-run.sh >> /srv/rootstock/daily-run.log 2>&1
```

The script finds the checkout from its own path, so the schedule line needs no `cd`. Send both streams somewhere you can read them. Cron's mail is the only other record of a run, and on most boxes nothing is delivering it.

If the hour drifting with daylight saving ever starts to matter, cron is the wrong tool. A systemd timer with `OnCalendar=*-*-* 05:00:00` runs in the box's own time zone and follows the clock through the shift. Two crontab lines guarded by month get there too, and cost more to read.

## What the Box Needs

`HOME` and `PATH` are re-exported rather than assumed. The narrator hands `codex exec` exactly `HOME`, `PATH` and `CODEX_HOME` and drops the rest of the environment, so a name missing here is missing again when codex goes looking for its config. `PATH` has to include the directory pnpm installed into; cron's two default entries will not find it.

`CODEX_HOME` is where codex keeps the credentials the Narration step spends. It defaults to `~/.codex`, which is where a plain `codex login` puts them.

`ROOTSTOCK_LATITUDE`, `ROOTSTOCK_LONGITUDE` and `ROOTSTOCK_TIME_ZONE` are the property. They sit in `.env.example` without values, and ADR 0004 explains why they will never have any. The repository is public, and Pages publishes a public site whatever the repository is. A missing one fails the run loudly rather than guessing a plausible coordinate and publishing a confidently wrong Plan.

`ROOTSTOCK_DEPLOY_KEY` is optional and points at the SSH private key the push uses. It defaults to `~/.ssh/rootstock_deploy`.

Git also needs a committer on the box, `git config user.name` and `user.email`, or every run dies at the first commit.

## Why the Flags Are There

`set -euo pipefail`, at the top of the script. Nothing watches this process. A step that fails quietly and lets the next one run would publish a status record and an Artifact that disagree, which is worse than a red run nobody notices until morning.

`< /dev/null` on `pnpm generate`. `codex exec` reads its prompt from stdin whenever it cannot find a positional argument, so a malformed call with an inherited stdin hangs forever instead of failing. The narrator hands its own child the null device for the same reason; the redirect here covers running the script by hand.

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
