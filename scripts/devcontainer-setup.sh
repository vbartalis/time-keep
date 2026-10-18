#!/usr/bin/env bash
# Idempotent bootstrap, run from the devcontainer's postCreateCommand.
# ~/.claude lives on a named volume so plugins and credentials survive
# rebuilds; this script is the safety net for a fresh volume. Enablement
# itself lives in .claude/settings.json.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# CodeGraph index — only on fresh clones; the daemon keeps it in sync after.
[ -f .codegraph/codegraph.db ] || codegraph init

# Session memory lives in the repo (.claude/memory), written only when asked.
# The harness insists on a home-directory path, so redirect it.
MEM_LINK="$HOME/.claude/projects/$(pwd | tr '/' '-')/memory"
if [ ! -L "$MEM_LINK" ]; then
    rm -rf "$MEM_LINK"
    mkdir -p "$(dirname "$MEM_LINK")"
    ln -s "$(pwd)/.claude/memory" "$MEM_LINK"
fi

# Plugins: superpowers is the process spine; ECC and impeccable extend it.
claude plugin marketplace add anthropics/claude-plugins-official 2>/dev/null || true
claude plugin marketplace add affaan-m/ECC 2>/dev/null || true
claude plugin marketplace add pbakaus/impeccable 2>/dev/null || true

for plugin in superpowers@claude-plugins-official ecc@ecc impeccable@impeccable; do
    claude plugin install "${plugin}" --scope project 2>/dev/null || true
done
