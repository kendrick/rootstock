#!/usr/bin/env bash
#
# The scheduled run. Generates today's Artifact, commits what came out, and pushes, which is what
# rebuilds the Pages site. There is no webhook and no CI generation.
#
# Nothing watches this process. A half-finished run that exits green would publish a site whose
# status record disagrees with the Artifact beside it, so every step either works or takes the
# script down with it.
#
# docs/operations/daily-run.md carries the crontab line and the box's environment.

set -euo pipefail

usage() {
	echo "usage: ${0##*/} [--dry-run]" >&2
}

dry_run=false
while [ $# -gt 0 ]; do
	case "$1" in
		--dry-run) dry_run=true ;;
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

# Run from the checkout, not from wherever cron started us. Every git command below is
# relative to it.
cd "$(dirname "$0")/.."

# cron runs a job with a near-empty environment: no profile, no login shell, a two-entry PATH.
# The narrator forwards exactly these three names to `codex exec` and drops everything else
# (scripts/codex-narrator.ts), so a name missing here is a name codex does not have when it
# goes looking for its credentials. Writing all three out means `set -u` stops the run right
# here, rather than leaving an auth error to explain it thirty seconds in.
export HOME="$HOME"
export PATH="$PATH"
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"

# A rehearsal writes to a temp directory and answers one question: is the pipeline wired up. It
# reaches no git command at all, so running it against a dirty tree cannot commit anything.
if [ "$dry_run" = true ]; then
	pnpm generate --dry-run < /dev/null
	exit 0
fi

# `pnpm generate` exits 1 when the generation failed, and that failure is exactly what the status
# record exists to publish. Catching the code keeps `set -e` from killing the script before the
# record is committed; the last line hands the code back.
#
# `codex exec`, down inside the narrator, reads its prompt from stdin whenever it cannot find a
# positional argument, so an inherited stdin turns a malformed call into a child that waits
# forever. The generator already hands its own child the null device; `< /dev/null` covers the
# same trap one level up, for whoever runs this script from a terminal.
generation_status=0
pnpm generate < /dev/null || generation_status=$?

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

# A deploy key, scoped to this one repository. A PAT on a homelab box would be a key to every
# repo the account owns, bought to publish a plant list. `IdentitiesOnly` keeps ssh from offering
# whatever an agent is holding before it reaches this key, `BatchMode` fails a dead credential
# instead of prompting a terminal nobody is at, and `StrictHostKeyChecking=no` spares a rebuilt
# box the fingerprint question. The key is write-only to one repo, so that last trade is cheap.
deploy_key="${ROOTSTOCK_DEPLOY_KEY:-$HOME/.ssh/rootstock_deploy}"
ssh_command="ssh -i $deploy_key -o IdentitiesOnly=yes"
ssh_command="$ssh_command -o StrictHostKeyChecking=no -o BatchMode=yes"
GIT_SSH_COMMAND="$ssh_command" git push

# The exit code reports the generation, not the bookkeeping around it. A scheduler has nowhere
# else to look.
exit "$generation_status"
