# Environment

One development environment: the **devcontainer**, run on a workstation under VS Code.

Definition: [`.devcontainer/`](../.devcontainer/) (devcontainer.json, compose,
Dockerfile) and [`scripts/devcontainer-setup.sh`](../scripts/devcontainer-setup.sh)
(idempotent bootstrap run on create).

## Image

Ubuntu devcontainers base, plus: tmux, jq, ripgrep, GitHub CLI, Node.js 22 (the agent
tooling's hooks), Claude Code and CodeGraph. The language toolchain is added once the
stack is decided.

## State that survives a rebuild

| What | Where | Kept by |
|------|-------|---------|
| Working tree | `/workspaces/time-keep` | host bind mount of the repo |
| Claude Code plugins, credentials | `~/.claude` | named volume `claude-home` |
| Session memory | `.claude/memory/` | the working tree; linked from `~/.claude/projects/…/memory` by the setup script |
| `gh` credential | `~/.config/gh` | nothing: container filesystem |

A rebuild (VS Code "Rebuild Container") replaces the image and the container
filesystem and keeps the volumes. `gh auth login -s project` is needed again after a
rebuild. tmux sessions survive disconnects, not restarts.

The compose file sets `init: true`, so `tini` is PID 1 and reaps orphaned processes
that `sleep infinity` would leave as zombies.

## Sessions that outlive an editor

`dev` (alias of `scripts/dev-session.sh`) creates or reattaches the `main` tmux
session: a `claude` window and a `misc` window at the repo root. Detach with
`Ctrl-b d`; run `dev` again to resume. tmux is not auto-launched on login; that
breaks VS Code's container terminals.

The container itself stays up independently of any editor: `shutdownAction: none`
in devcontainer.json and `restart: unless-stopped` in the compose file.

## Line endings

`.gitattributes` keeps every file LF. The repo is checked out on Windows and mounted
into a Linux container, where CRLF breaks shell scripts.

## Rules that bind here

Never run the Docker CLI, on the host or in a container. Lifecycle and logs are
VS Code actions. See
[`.claude/rules/never-use-the-docker-cli.md`](../.claude/rules/never-use-the-docker-cli.md).
