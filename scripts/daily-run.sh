#!/usr/bin/env bash
#
# The scheduled run. Generates today's Artifact, commits what came out, and pushes, which is what
# rebuilds the Pages site. There is no webhook and no CI generation.
#
# Nothing watches this process. A half-finished run that exits green would publish a site whose
# status record disagrees with the Artifact beside it, so every step either works or takes the
# script down with it.
#
# Schedule it with `pnpm schedule`. docs/operations/daily-run.md carries the rest: what the box
# needs, how two machines share a day, and what to do when the codex credential expires.

set -euo pipefail

usage() {
	echo "usage: ${0##*/} [--dry-run] [--force]" >&2
	echo "  --dry-run  rehearse the pipeline into a temp directory; reaches no git command" >&2
	echo "  --force    generate anyway: today already published, or not on main" >&2
	echo "  env: \$ROOTSTOCK_ENV_FILE, default ~/.config/rootstock/env" >&2
	echo "  schedule it: pnpm schedule      docs: docs/operations/daily-run.md" >&2
}

dry_run=false
force=false
while [ $# -gt 0 ]; do
	case "$1" in
		--dry-run) dry_run=true ;;
		--force) force=true ;;
		-h | --help)
			usage
			exit 0
			;;
		*)
			usage
			exit 2
			;;
	esac
	shift
done

# Run from the checkout, not from wherever the scheduler started us. Every git command below is
# relative to it.
cd "$(dirname "$0")/.."

# The property's coordinates live on this machine and nowhere in this checkout (ADR 0004), so the
# launchd plist and the crontab cannot carry them and this script has to go and fetch them itself.
#
# All or nothing, deliberately: a caller who already exported a latitude owns the whole environment,
# and half-merging a file into it would be the worst of both. That is also what keeps a hand-run
# working exactly as it did before this block existed, since `set -a; . .env.local` sets that name.
env_file="${ROOTSTOCK_ENV_FILE:-$HOME/.config/rootstock/env}"
if [ -z "${ROOTSTOCK_LATITUDE:-}" ] && [ -f "$env_file" ]; then
	set -a
	# shellcheck source=/dev/null
	. "$env_file"
	set +a
fi

# launchd and cron both hand a job a near-empty environment: no profile, no login shell, a two-entry
# PATH. The narrator forwards exactly these three names to `codex exec` and drops everything else
# (scripts/codex-narrator.ts), so a name missing here is a name codex does not have when it goes
# looking for its credentials. Writing all three out means `set -u` stops the run right here, rather
# than leaving an auth error to explain it thirty seconds in.
export HOME="$HOME"
export PATH="$PATH"
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"

# A deploy key, scoped to this one repository. A PAT on a scheduled box would be a key to every repo
# the account owns, bought to publish a plant list. `IdentitiesOnly` keeps ssh from offering whatever
# an agent is holding before it reaches this key, which is the whole reason a file is needed here:
# the owner's own identity lives in the 1Password agent, and an agent that wants an approval prompt
# cannot serve a run nobody is watching. `BatchMode` fails a dead credential instead of waiting at
# that prompt, and `StrictHostKeyChecking=no` spares a rebuilt box the fingerprint question. The key
# is write-only to one repo, so that last trade is cheap.
#
# Built up here rather than beside the push, because the fetch below needs it too.
deploy_key="${ROOTSTOCK_DEPLOY_KEY:-$HOME/.ssh/rootstock_deploy}"
ssh_command="ssh -i \"$deploy_key\" -o IdentitiesOnly=yes"
ssh_command="$ssh_command -o StrictHostKeyChecking=no -o BatchMode=yes"

# A rehearsal writes to a temp directory and answers one question: is the pipeline wired up. It
# reaches no git command at all, so running it against a dirty tree cannot commit anything, and it
# never consults today's record because a rehearsal that short-circuits answers nothing.
if [ "$dry_run" = true ]; then
	pnpm exec tsx scripts/generate.ts --dry-run < /dev/null
	exit 0
fi

# Everything from here to `pnpm exec` exists because this job runs on more than one machine. The
# second box has to see the first one's push before the generator reads data/status.json, or both
# decide the day is open and both spend a codex call. The same fetch is what keeps the push at the
# bottom from being rejected non-fast-forward, which under `set -e` would kill the run after the
# token had already been spent and leave the commits stranded locally.

# `symbolic-ref` and not `rev-parse --abbrev-ref`: the latter prints "HEAD" on a detached checkout
# and carries on, and a detached box has no branch to fast-forward or to push.
branch=$(git symbolic-ref --short HEAD)

# The scheduled job publishes to whatever branch it finds, and this checkout is usually also the one
# somebody develops in. A run that fired during an afternoon on a feature branch would commit the
# day's Artifact there and push it, which reports success, puts nothing on main, and leaves the site
# quietly a day older. Refusing is the cheap half of the fix; a checkout dedicated to the job is the
# thorough one.
if [ "$branch" != "main" ] && [ "$force" != true ]; then
	echo "daily-run: on '$branch' rather than main, so this run would publish where nobody reads it; pass --force if that is what you meant" >&2
	exit 1
fi

# Each check below runs inside `if !`, which suspends `set -e` for that one command so the failure
# can say what it was instead of exiting silently on a bare number.
if ! GIT_SSH_COMMAND="$ssh_command" git fetch --quiet origin; then
	echo "daily-run: could not reach origin, so this box cannot tell whether another one already ran today" >&2
	exit 1
fi

# A dirty tracked tree means either data/ holds output from a run that died before committing, or
# somebody edited the checkout by hand. Stopping costs a day of plans; carrying on would overwrite
# the first case and generate against an unknown tree in the second. Untracked files are deliberately
# not checked, because a log file sitting in the checkout blocks nothing.
if ! git diff --quiet || ! git diff --quiet --cached; then
	echo "daily-run: the checkout has uncommitted changes; commit or discard them before the next run" >&2
	exit 1
fi

# `--ff-only`, never a merge and never a rebase. A diverged checkout means this box committed
# something the other one does not have, and reconciling that unattended would either invent a merge
# commit nobody reviewed or replay local commits onto a remote this script cannot test.
if ! git merge --ff-only --quiet "origin/$branch"; then
	echo "daily-run: local $branch has diverged from origin/$branch; reconcile the two checkouts by hand" >&2
	exit 1
fi

# `pnpm exec` and not `pnpm generate`: `pnpm run` prints an ELIFECYCLE banner on any non-zero exit,
# and a run that correctly skipped should not leave that line in a log somebody reads for failures.
#
# The generator exits 1 when the generation failed, and that failure is exactly what the status
# record exists to publish. Catching the code keeps `set -e` from killing the script before the
# record is committed; the last line hands the code back.
#
# `codex exec`, down inside the narrator, reads its prompt from stdin whenever it cannot find a
# positional argument, so an inherited stdin turns a malformed call into a child that waits forever.
# The generator already hands its own child the null device; `< /dev/null` covers the same trap one
# level up, for whoever runs this script from a terminal.
#
# `$generate_args` is unquoted on purpose: it is either empty or the single word `--force`, and
# quoting it would pass an empty argument the flag parser would reject.
generate_args=""
if [ "$force" = true ]; then
	generate_args="--force"
fi

generation_status=0
# shellcheck disable=SC2086
pnpm exec tsx scripts/generate.ts $generate_args < /dev/null || generation_status=$?

# 3 is EXIT_SKIPPED in scripts/generate.ts, pinned there by a spec because bash cannot import it.
# This has to be read before the next block, which treats an unchanged status record as a crash: a
# skip leaves the file unchanged too, for the opposite reason.
if [ "$generation_status" -eq 3 ]; then
	echo "daily-run: today's plan is already published, so nothing ran"
	exit 0
fi

today=$(date -u +%Y-%m-%d)

# The status record moves on every run, failed or not, because it carries the attempt timestamp.
# An unchanged file therefore means the generator died before writing one—a missing variable, a
# broken checkout—and there is nothing worth committing or pushing.
if git diff --quiet -- data/status.json; then
	echo "daily-run: no status record was written, so nothing was committed" >&2
	if [ "$generation_status" -eq 0 ]; then
		generation_status=1
	fi
	exit "$generation_status"
fi

git commit --quiet --only data/status.json -m "chore: daily status $today"

# The Artifact is committed only when it changed. A failed generation leaves the committed one
# untouched on purpose, so the site keeps serving yesterday's Plan rather than nothing.
if git diff --quiet -- data/artifact.json; then
	echo "daily-run: Artifact unchanged, keeping the committed Plan"
else
	git commit --quiet --only data/artifact.json -m "chore: daily artifact $today"
fi

# A rejected push means another box published first, in the window between this run's fetch and its
# push. The two commits above carry only this run's own status record and Artifact, both of which the
# winner has already published, so discarding them loses nothing. That is safe precisely because of
# the checks above: the tree was clean and HEAD was at origin when this run started, so nothing local
# predates them. Without this the loser would exit non-zero with commits stranded on top of a stale
# HEAD, and tomorrow's run would stop at the divergence check instead of planning the day.
if ! GIT_SSH_COMMAND="$ssh_command" git push --quiet; then
	echo "daily-run: another box published first, so this run's commits are being discarded" >&2
	GIT_SSH_COMMAND="$ssh_command" git fetch --quiet origin
	git reset --hard --quiet "origin/$branch"
	exit 0
fi

# The exit code reports the generation, not the bookkeeping around it. A scheduler has nowhere
# else to look.
exit "$generation_status"
