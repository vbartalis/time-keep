#!/usr/bin/env bash
# dev-session.sh — build-or-attach the dev tmux session (aliased `dev` / `tw`).
#
#   window 0  "claude"   ready shell at repo root (type `claude` when ready)
#   window 1  "misc"     ready shell at repo root
#
# App windows are added once there is an app to run.
# Panes, when they come, stack vertically only: the browser terminal cannot
# copy across vertical split borders.
#
# Idempotent: an existing session is reattached, never rebuilt. Detach with
# Ctrl-b d; reattach by running this again.
set -euo pipefail

SESSION=main
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

attach() {
  if [ -n "${TMUX:-}" ]; then
    tmux switch-client -t "$SESSION"
  else
    exec tmux attach -t "$SESSION"
  fi
}

if tmux has-session -t "$SESSION" 2>/dev/null; then
  attach
  exit 0
fi

tmux new-session -d -s "$SESSION" -n claude -c "$REPO"
tmux new-window -t "$SESSION" -n misc -c "$REPO"

tmux select-window -t "$SESSION:claude"
attach
