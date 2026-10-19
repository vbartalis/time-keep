#!/usr/bin/env bash
# Autopilot: run headless Claude Code sessions one after another and decide from
# files whether to continue. Usage: scripts/autopilot.sh [max-sessions] (default 10)
# Env: AUTOPILOT_CLAUDE (CLI to run, default claude), AUTOPILOT_DIR (default .autopilot)
# Exit: 0 round-complete or stop; 1 failed/invalid outcome/refused pass; 2 dirty tree;
#       3 max-sessions reached with work left.
set -euo pipefail

max=${1:-10}
root=$(git rev-parse --show-toplevel)
cd "$root"

claude=${AUTOPILOT_CLAUDE:-claude}
dir=${AUTOPILOT_DIR:-.autopilot}
outcome="$dir/outcome.json"
runs="$dir/runs.md"
stamp=$(date -u +%Y%m%d-%H%M%S)

mkdir -p "$dir/logs" "$dir/verdicts"

# Denied to every session by flag, above the repo's allow list: branch deletion,
# fetching, and writes to memory or to the operator's words.
disallowed=(
	'Bash(git branch -D *)'
	'Bash(git branch -d *)'
	'Bash(git branch --delete *)'
	'Bash(git pull *)'
	'Bash(git fetch *)'
	'Write(.claude/memory/**)'
	'Edit(.claude/memory/**)'
	'Write(docs/operator-voice.md)'
	'Edit(docs/operator-voice.md)'
)

for ((n = 1; n <= max; n++)); do
	if [[ -e "$dir/stop" ]]; then
		echo "autopilot: stop file present, stopping before session $n"
		exit 0
	fi
	if [[ -n "$(git status --porcelain)" ]]; then
		echo "autopilot: working tree is dirty before session $n" >&2
		git status --short >&2
		exit 2
	fi

	rm -f "$outcome"
	log="$dir/logs/$stamp-$n.log"
	"$claude" -p "Invoke the run-item skill and follow it." \
		--disallowedTools "${disallowed[@]}" \
		--permission-mode auto --output-format stream-json --verbose >"$log" 2>&1 || true

	if [[ ! -f "$outcome" ]] || ! jq -e '
		(.status | IN("passed", "continue", "round-complete", "failed"))
		and (.unit | type == "string") and (.summary | type == "string")' \
		"$outcome" >/dev/null 2>&1; then
		echo "autopilot: session $n wrote no valid outcome ($outcome); see $log" >&2
		exit 1
	fi

	status=$(jq -r .status "$outcome")
	unit=$(jq -r .unit "$outcome")
	summary=$(jq -r .summary "$outcome")
	echo "- $(date -u +%Y-%m-%dT%H:%M:%SZ) session $n unit $unit $status: $summary (log $log)" >>"$runs"
	echo "autopilot: session $n unit $unit $status: $summary"

	case "$status" in
	failed) exit 1 ;;
	round-complete) exit 0 ;;
	passed)
		if [[ ! "$unit" =~ ^[A-Za-z0-9._-]+$ ]]; then
			echo "autopilot: refusing pass: invalid unit id '$unit'" >&2
			exit 1
		fi
		verdict="$dir/verdicts/$unit.json"
		if [[ ! -f "$verdict" ]]; then
			echo "autopilot: refusing pass for $unit: no verdict at $verdict" >&2
			exit 1
		fi
		if [[ "$(jq -r '.pass' "$verdict" 2>/dev/null)" != "true" ]]; then
			echo "autopilot: refusing pass for $unit: verdict does not pass" >&2
			exit 1
		fi
		if ! jq -e '.by | IN("usability-gate", "operator-stand-in")' "$verdict" >/dev/null 2>&1; then
			echo "autopilot: refusing pass for $unit: verdict is not by the gate or the stand-in" >&2
			exit 1
		fi
		if ! jq -e --arg unit "$unit" '.unit == $unit' "$verdict" >/dev/null 2>&1; then
			echo "autopilot: refusing pass for $unit: verdict names another unit" >&2
			exit 1
		fi
		if [[ "$(jq -r '.tree' "$verdict")" != "$(git rev-parse 'main^{tree}')" ]]; then
			echo "autopilot: refusing pass for $unit: verdict tree differs from main's tree" >&2
			exit 1
		fi
		;;
	esac
done

echo "autopilot: reached max-sessions ($max) with work left" >&2
exit 3
